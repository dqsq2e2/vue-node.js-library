-- 同步触发器初始化脚本
-- 更新日期：2025-11-27（与实际数据库结构同步）
-- 用于 MySQL/MariaDB/GreatSQL
-- 触发器在主数据库上记录变更到 sync_log 表

SET NAMES utf8mb4;
DELIMITER //

-- ===========================
-- 删除已存在的触发器
-- ===========================
DROP TRIGGER IF EXISTS sync_books_insert//
DROP TRIGGER IF EXISTS sync_books_update//
DROP TRIGGER IF EXISTS sync_books_delete//
DROP TRIGGER IF EXISTS sync_borrow_records_insert//
DROP TRIGGER IF EXISTS sync_borrow_records_update//
DROP TRIGGER IF EXISTS sync_borrow_records_delete//
DROP TRIGGER IF EXISTS sync_categories_insert//
DROP TRIGGER IF EXISTS sync_categories_update//
DROP TRIGGER IF EXISTS sync_categories_delete//
DROP TRIGGER IF EXISTS sync_reader_profiles_insert//
DROP TRIGGER IF EXISTS sync_reader_profiles_update//
DROP TRIGGER IF EXISTS sync_reader_profiles_delete//
DROP TRIGGER IF EXISTS sync_system_users_insert//
DROP TRIGGER IF EXISTS sync_system_users_update//
DROP TRIGGER IF EXISTS sync_system_users_delete//

-- ===========================
-- books 表触发器
-- ===========================
CREATE TRIGGER sync_books_insert
AFTER INSERT ON books
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    -- 检查是否为同步操作（防循环）
    IF @sync_in_progress IS NULL THEN
        -- 获取当前主数据库标识
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        -- 检查当前数据库是否为主数据库
        SET is_master = (current_primary = 'mysql');
        
        -- 只有主数据库才记录同步日志
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'books', NEW.book_id, 'INSERT',
                JSON_OBJECT('book_id', NEW.book_id, 'title', NEW.title, 'author', NEW.author, 'isbn', NEW.isbn, 'publisher', NEW.publisher, 'publish_date', NEW.publish_date, 'category_id', NEW.category_id, 'location', NEW.location, 'status', NEW.status, 'description', NEW.description, 'cover_image', NEW.cover_image, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_books_update
AFTER UPDATE ON books
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    -- 检查是否为同步操作（防循环）
    IF @sync_in_progress IS NULL THEN
        -- 获取当前主数据库标识
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        -- 检查当前数据库是否为主数据库
        SET is_master = (current_primary = 'mysql');
        
        -- 只有主数据库才记录同步日志
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'books', NEW.book_id, 'UPDATE',
                JSON_OBJECT('book_id', NEW.book_id, 'title', NEW.title, 'author', NEW.author, 'isbn', NEW.isbn, 'publisher', NEW.publisher, 'publish_date', NEW.publish_date, 'category_id', NEW.category_id, 'location', NEW.location, 'status', NEW.status, 'description', NEW.description, 'cover_image', NEW.cover_image, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_books_delete
AFTER UPDATE ON books
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    -- 检查是否为同步操作（防循环）和软删除操作
    IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
        -- 获取当前主数据库标识
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        -- 检查当前数据库是否为主数据库
        SET is_master = (current_primary = 'mysql');
        
        -- 只有主数据库才记录同步日志
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'books', NEW.book_id, 'DELETE',
                JSON_OBJECT('book_id', NEW.book_id, 'is_deleted', NEW.is_deleted),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

-- ===========================
-- borrow_records 表触发器
-- ===========================
CREATE TRIGGER sync_borrow_records_insert
AFTER INSERT ON borrow_records
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'borrow_records', NEW.record_id, 'INSERT',
                JSON_OBJECT('record_id', NEW.record_id, 'reader_id', NEW.reader_id, 'book_id', NEW.book_id, 'borrow_date', NEW.borrow_date, 'due_date', NEW.due_date, 'return_date', NEW.return_date, 'renew_count', NEW.renew_count, 'status', NEW.status, 'fine_amount', NEW.fine_amount, 'operator_id', NEW.operator_id, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_borrow_records_update
AFTER UPDATE ON borrow_records
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'borrow_records', NEW.record_id, 'UPDATE',
                JSON_OBJECT('record_id', NEW.record_id, 'reader_id', NEW.reader_id, 'book_id', NEW.book_id, 'borrow_date', NEW.borrow_date, 'due_date', NEW.due_date, 'return_date', NEW.return_date, 'renew_count', NEW.renew_count, 'status', NEW.status, 'fine_amount', NEW.fine_amount, 'operator_id', NEW.operator_id, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_borrow_records_delete
AFTER UPDATE ON borrow_records
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'borrow_records', NEW.record_id, 'DELETE',
                JSON_OBJECT('record_id', NEW.record_id, 'is_deleted', NEW.is_deleted),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

-- ===========================
-- categories 表触发器
-- ===========================
CREATE TRIGGER sync_categories_insert
AFTER INSERT ON categories
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'categories', NEW.category_id, 'INSERT',
                JSON_OBJECT('category_id', NEW.category_id, 'category_name', NEW.category_name, 'parent_id', NEW.parent_id, 'description', NEW.description, 'sort_order', NEW.sort_order, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_categories_update
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'categories', NEW.category_id, 'UPDATE',
                JSON_OBJECT('category_id', NEW.category_id, 'category_name', NEW.category_name, 'parent_id', NEW.parent_id, 'description', NEW.description, 'sort_order', NEW.sort_order, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_categories_delete
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'categories', NEW.category_id, 'DELETE',
                JSON_OBJECT('category_id', NEW.category_id, 'is_deleted', NEW.is_deleted),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

-- ===========================
-- reader_profiles 表触发器
-- ===========================
CREATE TRIGGER sync_reader_profiles_insert
AFTER INSERT ON reader_profiles
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'reader_profiles', NEW.profile_id, 'INSERT',
                JSON_OBJECT('profile_id', NEW.profile_id, 'user_id', NEW.user_id, 'card_number', NEW.card_number, 'gender', NEW.gender, 'department', NEW.department, 'membership_type', NEW.membership_type, 'register_date', NEW.register_date, 'expire_date', NEW.expire_date, 'max_borrow', NEW.max_borrow, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'is_deleted', NEW.is_deleted, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_reader_profiles_update
AFTER UPDATE ON reader_profiles
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'reader_profiles', NEW.profile_id, 'UPDATE',
                JSON_OBJECT('profile_id', NEW.profile_id, 'user_id', NEW.user_id, 'card_number', NEW.card_number, 'gender', NEW.gender, 'department', NEW.department, 'membership_type', NEW.membership_type, 'register_date', NEW.register_date, 'expire_date', NEW.expire_date, 'max_borrow', NEW.max_borrow, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'is_deleted', NEW.is_deleted, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_reader_profiles_delete
AFTER UPDATE ON reader_profiles
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'reader_profiles', NEW.profile_id, 'DELETE',
                JSON_OBJECT('profile_id', NEW.profile_id, 'is_deleted', NEW.is_deleted),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

-- ===========================
-- system_users 表触发器
-- ===========================
CREATE TRIGGER sync_system_users_insert
AFTER INSERT ON system_users
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'system_users', NEW.user_id, 'INSERT',
                JSON_OBJECT('user_id', NEW.user_id, 'username', NEW.username, 'password', NEW.password, 'real_name', NEW.real_name, 'role', NEW.role, 'email', NEW.email, 'phone', NEW.phone, 'last_login', NEW.last_login, 'status', NEW.status, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_system_users_update
AFTER UPDATE ON system_users
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'system_users', NEW.user_id, 'UPDATE',
                JSON_OBJECT('user_id', NEW.user_id, 'username', NEW.username, 'password', NEW.password, 'real_name', NEW.real_name, 'role', NEW.role, 'email', NEW.email, 'phone', NEW.phone, 'last_login', NEW.last_login, 'status', NEW.status, 'is_deleted', NEW.is_deleted, 'created_time', NEW.created_time, 'last_updated_time', NEW.last_updated_time, 'sync_version', NEW.sync_version, 'db_source', NEW.db_source),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

CREATE TRIGGER sync_system_users_delete
AFTER UPDATE ON system_users
FOR EACH ROW
BEGIN
    DECLARE is_master BOOLEAN DEFAULT FALSE;
    DECLARE current_primary VARCHAR(50) DEFAULT '';
    
    IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
        SELECT config_value INTO current_primary
        FROM system_config
        WHERE config_key = 'primary_database'
        LIMIT 1;
        
        SET is_master = (current_primary = 'mysql');
        
        IF is_master THEN
            INSERT INTO sync_log (
                table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
                'system_users', NEW.user_id, 'DELETE',
                JSON_OBJECT('user_id', NEW.user_id, 'is_deleted', NEW.is_deleted),
                'mysql', '待同步', NOW(), 0
            );
        END IF;
    END IF;
END//

DELIMITER ;
