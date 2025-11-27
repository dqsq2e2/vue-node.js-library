-- 初始化基础数据
-- 更新日期：2025-11-27（与实际数据库结构同步）
SET NAMES utf8mb4;

-- ===========================
-- 1. 初始化系统用户
-- ===========================
-- 注：默认密码都是 "123456"
INSERT INTO `system_users` (`username`, `password`, `real_name`, `role`, `email`, `phone`, `status`) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '系统管理员', 'admin', 'admin@library.com', '13800138000', '激活'),
('librarian1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '图书管理员1', 'librarian', 'librarian1@library.com', '13800138001', '激活'),
('reader_zhangsan', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '张三', 'reader', 'zhangsan@student.edu.cn', '13800138101', '激活'),
('reader_lisi', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '李四', 'reader', 'lisi@student.edu.cn', '13800138102', '激活'),
('reader_wangwu', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '王五', 'reader', 'wangwu@teacher.edu.cn', '13800138103', '激活'),
('reader_zhaoliu', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '赵六', 'reader', 'zhaoliu@vip.com', '13800138104', '激活'),
('reader_qianqi', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXIGfkPNi7bZbvbgWFnGukrKiAi', '钱七', 'reader', 'qianqi@student.edu.cn', '13800138105', '激活');

-- ===========================
-- 2. 初始化图书分类
-- ===========================
INSERT INTO `categories` (`category_name`, `parent_id`, `description`, `sort_order`) VALUES
('文学', 0, '文学类图书', 1),
('科技', 0, '科技类图书', 2),
('教育', 0, '教育类图书', 3),
('历史', 0, '历史类图书', 4),
('艺术', 0, '艺术类图书', 5),
('小说', 1, '各类小说', 1),
('诗歌', 1, '诗歌散文', 2),
('计算机', 2, '计算机技术', 1),
('数学', 2, '数学相关', 2),
('物理', 2, '物理学', 3),
('教材', 3, '各类教材', 1),
('参考书', 3, '工具参考书', 2),
('中国历史', 4, '中国历史', 1),
('世界历史', 4, '世界历史', 2),
('绘画', 5, '绘画艺术', 1),
('音乐', 5, '音乐艺术', 2);

-- ===========================
-- 3. 初始化读者档案信息 (reader_profiles)
-- ===========================
-- 关联 system_users 中 role='reader' 的用户
INSERT INTO `reader_profiles` (`user_id`, `card_number`, `gender`, `department`, `membership_type`, `register_date`, `expire_date`, `max_borrow`) VALUES
(3, 'R001001', '男', '计算机学院', '学生', '2024-01-01', '2025-12-31', 5),
(4, 'R001002', '女', '文学院', '学生', '2024-01-01', '2025-12-31', 5),
(5, 'R001003', '男', '数学学院', '教师', '2024-01-01', '2026-12-31', 10),
(6, 'R001004', '女', '外语学院', 'VIP', '2024-01-01', '2025-12-31', 15),
(7, 'R001005', '男', '物理学院', '学生', '2024-01-01', '2025-12-31', 5);

-- ===========================
-- 4. 初始化图书信息
-- ===========================
INSERT INTO `books` (`isbn`, `title`, `author`, `publisher`, `publish_date`, `category_id`, `total_copies`, `available_copies`, `location`, `price`, `description`) VALUES
('9787111213826', 'Java核心技术', 'Cay S. Horstmann', '机械工业出版社', '2023-01-01', 8, 5, 5, 'A区1层001', 89.00, 'Java编程经典教材'),
('9787302257646', '数据结构与算法分析', 'Mark Allen Weiss', '清华大学出版社', '2023-02-01', 8, 3, 3, 'A区1层002', 75.00, '数据结构经典教材'),
('9787115428028', 'Python编程：从入门到实践', 'Eric Matthes', '人民邮电出版社', '2023-03-01', 8, 4, 4, 'A区1层003', 69.00, 'Python入门经典'),
('9787020002207', '红楼梦', '曹雪芹', '人民文学出版社', '2022-01-01', 6, 10, 10, 'B区2层001', 45.00, '中国古典文学名著'),
('9787020008735', '西游记', '吴承恩', '人民文学出版社', '2022-02-01', 6, 8, 8, 'B区2层002', 42.00, '中国古典文学名著'),
('9787544270878', '平凡的世界', '路遥', '南海出版公司', '2022-03-01', 6, 6, 6, 'B区2层003', 38.00, '现代文学经典'),
('9787040396638', '高等数学', '同济大学数学系', '高等教育出版社', '2023-01-01', 9, 15, 15, 'C区1层001', 56.00, '高等数学教材'),
('9787040396645', '线性代数', '同济大学数学系', '高等教育出版社', '2023-02-01', 9, 10, 10, 'C区1层002', 32.00, '线性代数教材'),
('9787040396652', '概率论与数理统计', '同济大学数学系', '高等教育出版社', '2023-03-01', 9, 8, 8, 'C区1层003', 35.00, '概率统计教材'),
('9787010009261', '中国通史', '白寿彝', '人民出版社', '2022-01-01', 13, 5, 5, 'D区3层001', 128.00, '中国历史通史');

-- ===========================
-- 5. 初始化数据库连接配置
-- ===========================
-- 注：db_connections 配置由 init-all-databases.js 脚本根据 .env 环境变量自动插入

-- ===========================
-- 6. 初始化同步配置
-- ===========================
INSERT INTO `sync_config` (`config_key`, `config_value`, `description`) VALUES
('sync_enabled', 'true', '是否启用数据同步'),
('sync_interval', '60000', '同步间隔时间（毫秒）'),
('sync_batch_size', '100', '每批同步记录数'),
('sync_retry_count', '3', '同步失败重试次数'),
('conflict_notification_enabled', 'true', '是否启用冲突通知'),
('auto_resolve_conflicts', 'false', '是否自动解决冲突'),
('sync_tables', '["system_users","categories","reader_profiles","books","borrow_records"]', '需要同步的表列表'),
('exclude_fields', '["password","password_enc"]', '同步时排除的敏感字段'),
('is_master_database', 'true', '当前数据库是否为主库'),
('database_role', 'master', '数据库角色'),
('sync_direction', 'master_to_slave', '同步方向'),
('system_users_primary_key', 'user_id', 'system_users表主键'),
('categories_primary_key', 'category_id', 'categories表主键'),
('reader_profiles_primary_key', 'profile_id', 'reader_profiles表主键'),
('books_primary_key', 'book_id', 'books表主键'),
('borrow_records_primary_key', 'record_id', 'borrow_records表主键');

-- ===========================
-- 7. 初始化系统配置（触发器使用）
-- ===========================
INSERT INTO `system_config` (`config_key`, `config_value`, `description`) VALUES
('primary_database', 'mysql', '当前主数据库标识');

-- ===========================
-- 8. 初始化一些借阅记录（示例数据）
-- ===========================
-- reader_id 对应 reader_profiles.profile_id
INSERT INTO `borrow_records` (`reader_id`, `book_id`, `borrow_date`, `due_date`, `return_date`, `status`, `operator_id`) VALUES
(1, 1, '2024-01-15', '2024-02-15', '2024-02-10', '已还', 2),
(1, 2, '2024-01-20', '2024-02-20', NULL, '借出', 2),
(2, 4, '2024-01-18', '2024-02-18', '2024-02-15', '已还', 2),
(2, 5, '2024-01-25', '2024-02-25', NULL, '借出', 2),
(3, 7, '2024-01-10', '2024-02-10', '2024-02-08', '已还', 2),
(3, 8, '2024-01-22', '2024-02-22', NULL, '借出', 2),
(4, 6, '2024-01-12', '2024-02-12', NULL, '逾期', 2),
(5, 9, '2024-01-28', '2024-02-28', NULL, '借出', 2);

-- 更新借出图书的可借数量
UPDATE `books` SET `available_copies` = `available_copies` - 1 WHERE `book_id` IN (2, 5, 6, 8, 9);
