-- 多数据库同步的图书馆管理系统数据库初始化脚本
-- 支持 MySQL、MariaDB、GreatSQL
-- 字符集：utf8mb4_general_ci
-- 更新日期：2025-11-27（与实际数据库结构同步）

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 删除已存在的表（按依赖关系逆序）
DROP TABLE IF EXISTS `conflict_records`;
DROP TABLE IF EXISTS `sync_log`;
DROP TABLE IF EXISTS `db_connections`;
DROP TABLE IF EXISTS `sync_config`;
DROP TABLE IF EXISTS `system_config`;
DROP TABLE IF EXISTS `borrow_records`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `reader_profiles`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `system_users`;

-- ===========================
-- 1. 系统用户表 (system_users)
-- ===========================
CREATE TABLE `system_users` (
    `user_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `password` VARCHAR(100) NOT NULL COMMENT '密码（加密）',
    `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
    `role` ENUM('admin','librarian','reader') NOT NULL COMMENT '角色：管理员/图书管理员/读者',
    `email` VARCHAR(100) COMMENT '邮箱',
    `phone` VARCHAR(20) COMMENT '电话',
    `last_login` DATETIME COMMENT '最后登录时间',
    `status` VARCHAR(20) DEFAULT '激活' COMMENT '状态：激活/停用',
    `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否，1-是',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `last_updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `db_source` VARCHAR(50) COMMENT '数据来源数据库',
    UNIQUE KEY `uk_username` (`username`),
    INDEX `idx_role` (`role`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统用户表';

-- ===========================
-- 2. 图书分类表 (categories)
-- ===========================
CREATE TABLE `categories` (
    `category_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '分类ID',
    `category_name` VARCHAR(50) NOT NULL COMMENT '分类名称',
    `parent_id` INT DEFAULT 0 COMMENT '父分类ID，0表示顶级分类',
    `description` TEXT COMMENT '分类描述',
    `sort_order` INT DEFAULT 0 COMMENT '排序序号',
    `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否，1-是',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `last_updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `db_source` VARCHAR(50) COMMENT '数据来源数据库',
    INDEX `idx_category_name` (`category_name`),
    INDEX `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='图书分类表';

-- ===========================
-- 3. 读者档案表 (reader_profiles)
-- ===========================
CREATE TABLE `reader_profiles` (
    `profile_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '档案ID',
    `user_id` INT NOT NULL COMMENT '关联系统用户ID',
    `card_number` VARCHAR(20) NOT NULL COMMENT '借书证号',
    `gender` ENUM('男','女') COMMENT '性别',
    `department` VARCHAR(100) COMMENT '所属部门/院系',
    `membership_type` ENUM('普通','VIP','教师','学生') DEFAULT '普通' COMMENT '会员类型',
    `register_date` DATE NOT NULL COMMENT '注册日期',
    `expire_date` DATE NOT NULL COMMENT '有效期至',
    `max_borrow` INT DEFAULT 5 COMMENT '最大借书数量',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `last_updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否，1-是',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `db_source` VARCHAR(50) COMMENT '数据来源数据库',
    UNIQUE KEY `uk_user_id` (`user_id`),
    UNIQUE KEY `uk_card_number` (`card_number`),
    INDEX `idx_department` (`department`),
    INDEX `idx_membership_type` (`membership_type`),
    FOREIGN KEY (`user_id`) REFERENCES `system_users`(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='读者档案表';

-- ===========================
-- 4. 图书表 (books)
-- ===========================
CREATE TABLE `books` (
    `book_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '图书ID',
    `isbn` VARCHAR(20) NOT NULL COMMENT 'ISBN编号',
    `title` VARCHAR(200) NOT NULL COMMENT '书名',
    `author` VARCHAR(100) NOT NULL COMMENT '作者',
    `publisher` VARCHAR(100) COMMENT '出版社',
    `publish_date` DATE COMMENT '出版日期',
    `category_id` INT NOT NULL COMMENT '分类ID',
    `total_copies` INT DEFAULT 1 COMMENT '总册数',
    `available_copies` INT DEFAULT 1 COMMENT '可借册数',
    `location` VARCHAR(100) COMMENT '存放位置',
    `price` DECIMAL(10,2) COMMENT '价格',
    `description` TEXT COMMENT '图书描述',
    `cover_image` VARCHAR(500) COMMENT '封面图片路径',
    `status` VARCHAR(20) DEFAULT '在库' COMMENT '状态：在库/下架/维修',
    `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否，1-是',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `last_updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `db_source` VARCHAR(50) COMMENT '数据来源数据库',
    UNIQUE KEY `uk_isbn` (`isbn`),
    INDEX `idx_title` (`title`),
    INDEX `idx_author` (`author`),
    INDEX `idx_category` (`category_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_cover_image` (`cover_image`),
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='图书表';

-- ===========================
-- 5. 借阅记录表 (borrow_records)
-- ===========================
CREATE TABLE `borrow_records` (
    `record_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '借阅记录ID',
    `reader_id` INT NOT NULL COMMENT '读者档案ID',
    `book_id` INT NOT NULL COMMENT '图书ID',
    `borrow_date` DATE NOT NULL COMMENT '借阅日期',
    `due_date` DATE NOT NULL COMMENT '应还日期',
    `return_date` DATE COMMENT '实际归还日期',
    `renew_count` INT DEFAULT 0 COMMENT '续借次数',
    `status` ENUM('借出','已还','逾期','丢失') DEFAULT '借出' COMMENT '状态',
    `fine_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '罚款金额',
    `operator_id` INT NOT NULL COMMENT '操作员ID',
    `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否，1-是',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `last_updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `db_source` VARCHAR(50) COMMENT '数据来源数据库',
    INDEX `idx_reader_book` (`reader_id`, `book_id`),
    INDEX `book_id` (`book_id`),
    INDEX `idx_due_date` (`due_date`),
    INDEX `idx_status` (`status`),
    INDEX `idx_borrow_date` (`borrow_date`),
    INDEX `operator_id` (`operator_id`),
    FOREIGN KEY (`reader_id`) REFERENCES `reader_profiles`(`profile_id`),
    FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`),
    FOREIGN KEY (`operator_id`) REFERENCES `system_users`(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='借阅记录表';

-- ===========================
-- 同步机制相关表
-- ===========================

-- 6. 数据库连接配置表
CREATE TABLE `db_connections` (
    `db_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '数据库配置ID',
    `db_name` VARCHAR(50) NOT NULL COMMENT '数据库名称标识',
    `db_type` ENUM('mysql','mariadb','greatsql') NOT NULL COMMENT '数据库类型',
    `host` VARCHAR(100) NOT NULL COMMENT '主机地址',
    `port` INT NOT NULL COMMENT '端口号',
    `database_name` VARCHAR(50) NOT NULL COMMENT '数据库名',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `password_enc` VARCHAR(200) NOT NULL COMMENT '加密密码',
    `status` ENUM('激活','停用','维护') DEFAULT '激活' COMMENT '状态',
    `sync_priority` INT DEFAULT 1 COMMENT '同步优先级',
    `last_sync_time` DATETIME COMMENT '最后同步时间',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY `uk_db_name` (`db_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='数据库连接配置表';

-- 7. 同步配置表
CREATE TABLE `sync_config` (
    `config_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT COMMENT '配置值',
    `description` VARCHAR(255) COMMENT '配置描述',
    `last_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    UNIQUE KEY `config_key` (`config_key`),
    INDEX `idx_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='同步配置表';

-- 8. 系统配置表
CREATE TABLE `system_config` (
    `config_id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT COMMENT '配置值',
    `description` VARCHAR(255) COMMENT '配置描述',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统配置表';

-- 9. 同步日志表
CREATE TABLE `sync_log` (
    `log_id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
    `table_name` VARCHAR(64) NOT NULL COMMENT '表名',
    `record_id` VARCHAR(255) NOT NULL COMMENT '记录ID',
    `operation` ENUM('INSERT','UPDATE','DELETE') NOT NULL COMMENT '操作类型',
    `change_data` JSON COMMENT '变更数据',
    `source_db` VARCHAR(50) NOT NULL COMMENT '源数据库',
    `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `sync_version` BIGINT DEFAULT 0 COMMENT '同步版本号',
    `sync_status` ENUM('待同步','同步中','同步成功','同步失败','冲突待处理') DEFAULT '待同步' COMMENT '同步状态',
    `retry_count` INT DEFAULT 0 COMMENT '重试次数',
    `change_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '变更时间',
    `last_retry_time` DATETIME COMMENT '最后重试时间',
    `error_message` TEXT COMMENT '错误信息',
    `sync_attempts` INT DEFAULT 0 COMMENT '同步尝试次数',
    `synced_databases` JSON COMMENT '已同步的数据库列表',
    INDEX `idx_table_operation` (`table_name`, `operation`),
    INDEX `idx_created_time` (`created_time`),
    INDEX `idx_source_db` (`source_db`),
    INDEX `idx_sync_status_retry` (`sync_status`, `retry_count`),
    INDEX `idx_change_time` (`change_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='同步日志表';

-- 10. 冲突记录表
CREATE TABLE `conflict_records` (
    `conflict_id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '冲突ID',
    `sync_log_id` BIGINT COMMENT '关联的同步日志ID',
    `table_name` VARCHAR(50) NOT NULL COMMENT '表名',
    `record_id` INT NOT NULL COMMENT '记录ID',
    `source_db` VARCHAR(50) NOT NULL COMMENT '源数据库',
    `source_data` JSON COMMENT '源数据',
    `target_db` VARCHAR(50) NOT NULL COMMENT '目标数据库',
    `target_data` JSON COMMENT '目标数据',
    `conflict_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '冲突发生时间',
    `resolve_status` ENUM('待处理','已解决','忽略') DEFAULT '待处理' COMMENT '解决状态',
    `resolve_action` VARCHAR(50) COMMENT '解决方案',
    `resolved_by` INT COMMENT '解决人ID',
    `resolved_time` DATETIME COMMENT '解决时间',
    `remarks` TEXT COMMENT '备注',
    FOREIGN KEY (`resolved_by`) REFERENCES `system_users`(`user_id`),
    INDEX `idx_resolve_status` (`resolve_status`),
    INDEX `idx_table_record` (`table_name`, `record_id`),
    INDEX `idx_conflict_time` (`conflict_time`),
    INDEX `idx_sync_log_id` (`sync_log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='冲突记录表';

SET FOREIGN_KEY_CHECKS = 1;

-- ===========================
-- 11. 视图定义
-- ===========================

-- 用户完整信息视图（关联system_users和reader_profiles）
DROP VIEW IF EXISTS `user_complete_info`;
CREATE VIEW `user_complete_info` AS
SELECT 
    su.user_id,
    su.username,
    su.real_name,
    su.role,
    su.email,
    su.phone,
    su.status,
    su.is_deleted,
    su.created_time,
    su.last_updated_time,
    su.last_login,
    rp.profile_id,
    rp.card_number,
    rp.gender,
    rp.department,
    rp.membership_type,
    rp.register_date,
    rp.expire_date,
    rp.max_borrow
FROM system_users su
LEFT JOIN reader_profiles rp ON su.user_id = rp.user_id AND rp.is_deleted = 0
WHERE su.is_deleted = 0;
