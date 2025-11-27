-- 存储过程定义
-- 更新日期：2025-11-27（与实际数据库结构同步）
SET NAMES utf8mb4;

DELIMITER //

-- ===========================
-- 1. 借书存储过程
-- ===========================
DROP PROCEDURE IF EXISTS `borrow_book`//
CREATE PROCEDURE `borrow_book`(
    IN p_reader_id INT,
    IN p_book_id INT,
    IN p_operator_id INT,
    OUT p_result INT,
    OUT p_message VARCHAR(200)
)
BEGIN
    DECLARE v_available_copies INT DEFAULT 0;
    DECLARE v_reader_status VARCHAR(20) DEFAULT '';
    DECLARE v_current_borrow INT DEFAULT 0;
    DECLARE v_max_borrow INT DEFAULT 5;
    DECLARE v_book_status VARCHAR(20) DEFAULT '';
    DECLARE v_due_date DATE;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 0;
        SET p_message = '系统错误，借书失败';
    END;
    
    START TRANSACTION;
    
    -- 检查图书状态和可借数量
    SELECT `available_copies`, `status` INTO v_available_copies, v_book_status
    FROM `books` 
    WHERE `book_id` = p_book_id AND `is_deleted` = 0
    FOR UPDATE;
    
    -- 检查读者状态和借书限制（p_reader_id是profile_id）
    SELECT su.`status`, COALESCE(rp.`max_borrow`, 5) INTO v_reader_status, v_max_borrow
    FROM `reader_profiles` rp
    JOIN `system_users` su ON rp.`user_id` = su.`user_id`
    WHERE rp.`profile_id` = p_reader_id AND su.`is_deleted` = 0 AND su.`role` = 'reader';
    
    -- 检查当前借书数量
    SELECT COUNT(*) INTO v_current_borrow 
    FROM `borrow_records` 
    WHERE `reader_id` = p_reader_id AND `status` = '借出' AND `is_deleted` = 0;
    
    -- 检查是否已借阅此书
    IF EXISTS (
        SELECT 1 FROM `borrow_records` 
        WHERE `reader_id` = p_reader_id AND `book_id` = p_book_id 
        AND `status` = '借出' AND `is_deleted` = 0
    ) THEN
        SET p_result = 0;
        SET p_message = '您已借阅此书，不能重复借阅';
    ELSEIF v_available_copies IS NULL THEN
        SET p_result = 0;
        SET p_message = '图书不存在或已删除';
    ELSEIF v_available_copies <= 0 THEN
        SET p_result = 0;
        SET p_message = '图书已全部借出';
    ELSEIF v_book_status != '在库' THEN
        SET p_result = 0;
        SET p_message = CONCAT('图书状态异常：', v_book_status);
    ELSEIF v_reader_status IS NULL THEN
        SET p_result = 0;
        SET p_message = '读者不存在或已删除';
    ELSEIF v_reader_status != '激活' THEN
        SET p_result = 0;
        SET p_message = CONCAT('读者状态异常：', v_reader_status);
    ELSEIF v_current_borrow >= v_max_borrow THEN
        SET p_result = 0;
        SET p_message = CONCAT('已达到最大借书量：', v_max_borrow, '本');
    ELSE
        -- 计算应还日期（默认30天）
        SET v_due_date = DATE_ADD(CURDATE(), INTERVAL 30 DAY);
        
        -- 插入借阅记录
        INSERT INTO `borrow_records` (
            `reader_id`, `book_id`, `borrow_date`, `due_date`, 
            `status`, `operator_id`
        ) VALUES (
            p_reader_id, p_book_id, CURDATE(), v_due_date, 
            '借出', p_operator_id
        );
        
        -- 更新图书可借数量
        UPDATE `books` 
        SET `available_copies` = `available_copies` - 1,
            `sync_version` = `sync_version` + 1
        WHERE `book_id` = p_book_id;
        
        SET p_result = 1;
        SET p_message = CONCAT('借书成功，应还日期：', DATE_FORMAT(v_due_date, '%Y-%m-%d'));
        COMMIT;
    END IF;
    
    IF p_result = 0 THEN
        ROLLBACK;
    END IF;
END//

-- ===========================
-- 2. 还书存储过程
-- ===========================
DROP PROCEDURE IF EXISTS `return_book`//
CREATE PROCEDURE `return_book`(
    IN p_record_id INT,
    IN p_operator_id INT,
    OUT p_result INT,
    OUT p_message VARCHAR(200)
)
BEGIN
    DECLARE v_book_id INT DEFAULT 0;
    DECLARE v_due_date DATE;
    DECLARE v_fine_amount DECIMAL(10,2) DEFAULT 0;
    DECLARE v_overdue_days INT DEFAULT 0;
    DECLARE v_record_status VARCHAR(20) DEFAULT '';
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 0;
        SET p_message = '系统错误，还书失败';
    END;
    
    START TRANSACTION;
    
    -- 获取借阅记录信息
    SELECT `book_id`, `due_date`, `status` 
    INTO v_book_id, v_due_date, v_record_status
    FROM `borrow_records` 
    WHERE `record_id` = p_record_id AND `is_deleted` = 0 
    FOR UPDATE;
    
    IF v_book_id IS NULL THEN
        SET p_result = 0;
        SET p_message = '借阅记录不存在';
    ELSEIF v_record_status != '借出' AND v_record_status != '逾期' THEN
        SET p_result = 0;
        SET p_message = '图书已归还或状态异常';
    ELSE
        -- 计算逾期天数和罚款金额
        SET v_overdue_days = GREATEST(0, DATEDIFF(CURDATE(), v_due_date));
        SET v_fine_amount = v_overdue_days * 0.5; -- 每天0.5元罚款
        
        -- 更新借阅记录
        UPDATE `borrow_records` 
        SET `return_date` = CURDATE(), 
            `status` = '已还',
            `fine_amount` = v_fine_amount,
            `operator_id` = p_operator_id,
            `sync_version` = `sync_version` + 1
        WHERE `record_id` = p_record_id;
        
        -- 更新图书可借数量
        UPDATE `books` 
        SET `available_copies` = `available_copies` + 1,
            `sync_version` = `sync_version` + 1
        WHERE `book_id` = v_book_id;
        
        SET p_result = 1;
        IF v_fine_amount > 0 THEN
            SET p_message = CONCAT('还书成功，逾期', v_overdue_days, '天，产生罚款：', v_fine_amount, '元');
        ELSE
            SET p_message = '还书成功';
        END IF;
        
        COMMIT;
    END IF;
    
    IF p_result = 0 THEN
        ROLLBACK;
    END IF;
END//

-- ===========================
-- 3. 续借存储过程
-- ===========================
DROP PROCEDURE IF EXISTS `renew_book`//
CREATE PROCEDURE `renew_book`(
    IN p_record_id INT,
    IN p_operator_id INT,
    OUT p_result INT,
    OUT p_message VARCHAR(200)
)
BEGIN
    DECLARE v_renew_count INT DEFAULT 0;
    DECLARE v_due_date DATE;
    DECLARE v_new_due_date DATE;
    DECLARE v_record_status VARCHAR(20) DEFAULT '';
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 0;
        SET p_message = '系统错误，续借失败';
    END;
    
    START TRANSACTION;
    
    -- 获取借阅记录信息
    SELECT `renew_count`, `due_date`, `status` 
    INTO v_renew_count, v_due_date, v_record_status
    FROM `borrow_records` 
    WHERE `record_id` = p_record_id AND `is_deleted` = 0 
    FOR UPDATE;
    
    IF v_renew_count IS NULL THEN
        SET p_result = 0;
        SET p_message = '借阅记录不存在';
    ELSEIF v_record_status != '借出' THEN
        SET p_result = 0;
        SET p_message = '只有借出状态的图书才能续借';
    ELSEIF v_renew_count >= 2 THEN
        SET p_result = 0;
        SET p_message = '已达到最大续借次数（2次）';
    ELSEIF CURDATE() > v_due_date THEN
        SET p_result = 0;
        SET p_message = '图书已逾期，不能续借，请先归还';
    ELSE
        -- 计算新的应还日期（延长30天）
        SET v_new_due_date = DATE_ADD(v_due_date, INTERVAL 30 DAY);
        
        -- 更新借阅记录
        UPDATE `borrow_records` 
        SET `due_date` = v_new_due_date,
            `renew_count` = `renew_count` + 1,
            `operator_id` = p_operator_id,
            `sync_version` = `sync_version` + 1
        WHERE `record_id` = p_record_id;
        
        SET p_result = 1;
        SET p_message = CONCAT('续借成功，新的应还日期：', DATE_FORMAT(v_new_due_date, '%Y-%m-%d'));
        COMMIT;
    END IF;
    
    IF p_result = 0 THEN
        ROLLBACK;
    END IF;
END//

-- ===========================
-- 4. 逾期图书处理存储过程
-- ===========================
DROP PROCEDURE IF EXISTS `process_overdue_books`//
CREATE PROCEDURE `process_overdue_books`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_record_id INT;
    DECLARE v_overdue_days INT;
    DECLARE v_fine_amount DECIMAL(10,2);
    
    -- 声明游标
    DECLARE overdue_cursor CURSOR FOR
        SELECT `record_id`, DATEDIFF(CURDATE(), `due_date`) AS overdue_days
        FROM `borrow_records`
        WHERE `status` = '借出' 
        AND `due_date` < CURDATE() 
        AND `is_deleted` = 0;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN overdue_cursor;
    
    read_loop: LOOP
        FETCH overdue_cursor INTO v_record_id, v_overdue_days;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- 计算罚款金额
        SET v_fine_amount = v_overdue_days * 0.5;
        
        -- 更新记录状态为逾期
        UPDATE `borrow_records`
        SET `status` = '逾期',
            `fine_amount` = v_fine_amount,
            `sync_version` = `sync_version` + 1
        WHERE `record_id` = v_record_id;
        
    END LOOP;
    
    CLOSE overdue_cursor;
    
    -- 返回处理结果
    SELECT ROW_COUNT() AS '处理的逾期记录数';
END//

DELIMITER ;
