const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission, hashPassword } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// 所有用户管理相关路由都需要认证
router.use(authenticate);

/**
 * 获取用户列表
 */
router.get('/', requirePermission('USER_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('search').optional().isLength({ max: 200 }).withMessage('搜索关键词长度不能超过200'),
  query('role').optional().isIn(['admin', 'librarian', 'reader']).withMessage('角色值无效'),
  query('status').optional().isIn(['激活', '停用']).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    search = '',
    role,
    status,
    sort_by = 'created_time',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['is_deleted = 0'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(username LIKE ? OR real_name LIKE ? OR email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (role) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }

    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM system_users WHERE ${whereClause}`;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取用户列表
    const listSql = `
      SELECT 
        user_id,
        username,
        real_name,
        role,
        email,
        phone,
        status,
        last_login,
        created_time,
        last_updated_time
      FROM system_users
      WHERE ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const users = await executeQuery('mysql', listSql, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      message: '获取用户列表成功',
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
}));

/**
 * 获取用户详情
 */
router.get('/:id', requirePermission('USER_VIEW'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const userId = req.params.id;

  try {
    const sql = `
      SELECT 
        user_id,
        username,
        real_name,
        role,
        email,
        phone,
        status,
        last_login,
        created_time,
        last_updated_time
      FROM system_users 
      WHERE user_id = ? AND is_deleted = 0
    `;

    const results = await executeQuery('mysql', sql, [userId]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '获取用户详情成功',
      data: results[0]
    });

  } catch (error) {
    logger.error('获取用户详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户详情失败'
    });
  }
}));

/**
 * 添加用户
 */
router.post('/', requirePermission('USER_MANAGE'), [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码长度至少6个字符'),
  body('real_name')
    .notEmpty()
    .withMessage('真实姓名不能为空')
    .isLength({ max: 50 })
    .withMessage('真实姓名长度不能超过50个字符'),
  body('role')
    .isIn(['admin', 'librarian', 'reader'])
    .withMessage('角色必须是admin、librarian或reader'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式不正确'),
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { username, password, real_name, role, email, phone } = req.body;

  try {
    // 检查用户名是否已存在
    const existingSql = 'SELECT user_id FROM system_users WHERE username = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [username]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 插入用户记录
    const insertSql = `
      INSERT INTO system_users (username, password, real_name, role, email, phone, status, db_source)
      VALUES (?, ?, ?, ?, ?, ?, '激活', 'mysql')
    `;

    const result = await executeQuery('mysql', insertSql, [
      username, hashedPassword, real_name, role, email, phone
    ]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('system_users', ?, 'INSERT', ?, 'mysql')
    `;

    const changeData = JSON.stringify({
      user_id: result.insertId,
      username, real_name, role, email, phone, status: '激活'
    });

    await executeQuery('mysql', syncLogSql, [result.insertId, changeData]);

    logger.info(`用户添加成功: ${username} (${role}) by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: '用户添加成功',
      data: {
        user_id: result.insertId
      }
    });

  } catch (error) {
    logger.error('添加用户失败:', error);
    res.status(500).json({
      success: false,
      message: '添加用户失败'
    });
  }
}));

/**
 * 更新用户信息
 */
router.put('/:id', requirePermission('USER_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('real_name').optional().notEmpty().withMessage('真实姓名不能为空').isLength({ max: 50 }).withMessage('真实姓名长度不能超过50个字符'),
  body('role').optional().isIn(['admin', 'librarian', 'reader']).withMessage('角色必须是admin、librarian或reader'),
  body('email').optional().isEmail().withMessage('邮箱格式不正确'),
  body('phone').optional().matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('status').optional().isIn(['激活', '停用']).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const userId = req.params.id;
  const updateData = req.body;

  try {
    // 检查用户是否存在
    const existingSql = 'SELECT * FROM system_users WHERE user_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [userId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const currentUser = existing[0];

    // 防止修改自己的角色和状态
    if (req.user.id == userId) {
      if (updateData.role && updateData.role !== currentUser.role) {
        return res.status(400).json({
          success: false,
          message: '不能修改自己的角色'
        });
      }
      if (updateData.status && updateData.status !== currentUser.status) {
        return res.status(400).json({
          success: false,
          message: '不能修改自己的状态'
        });
      }
    }

    // 构建更新SQL
    const updateFields = [];
    const updateValues = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'user_id' && key !== 'username') {
        updateFields.push(`${key} = ?`);
        updateValues.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有需要更新的字段'
      });
    }

    updateFields.push('sync_version = sync_version + 1');
    updateValues.push(userId);

    const updateSql = `
      UPDATE system_users 
      SET ${updateFields.join(', ')}
      WHERE user_id = ?
    `;

    await executeQuery('mysql', updateSql, updateValues);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('system_users', ?, 'UPDATE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ user_id: userId, ...updateData });
    await executeQuery('mysql', syncLogSql, [userId, changeData]);

    logger.info(`用户更新成功: ID=${userId} by ${req.user.username}`);

    res.json({
      success: true,
      message: '用户信息更新成功'
    });

  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
}));

/**
 * 重置用户密码
 */
router.post('/:id/reset-password', requirePermission('USER_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('new_password')
    .notEmpty()
    .withMessage('新密码不能为空')
    .isLength({ min: 6 })
    .withMessage('新密码长度至少6个字符')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const userId = req.params.id;
  const { new_password } = req.body;

  try {
    // 检查用户是否存在
    const existingSql = 'SELECT username FROM system_users WHERE user_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [userId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const username = existing[0].username;

    // 加密新密码
    const hashedPassword = await hashPassword(new_password);

    // 更新密码
    const updateSql = `
      UPDATE system_users 
      SET password = ?, sync_version = sync_version + 1
      WHERE user_id = ?
    `;

    await executeQuery('mysql', updateSql, [hashedPassword, userId]);

    logger.info(`用户密码重置成功: ${username} (ID=${userId}) by ${req.user.username}`);

    res.json({
      success: true,
      message: '密码重置成功'
    });

  } catch (error) {
    logger.error('重置密码失败:', error);
    res.status(500).json({
      success: false,
      message: '重置密码失败'
    });
  }
}));

/**
 * 删除用户
 */
router.delete('/:id', requirePermission('USER_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const userId = req.params.id;

  try {
    // 检查用户是否存在
    const existingSql = 'SELECT * FROM system_users WHERE user_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [userId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = existing[0];

    // 不能删除自己
    if (req.user.id == userId) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己'
      });
    }

    // 检查是否有相关的操作记录
    const recordSql = `
      SELECT COUNT(*) as count 
      FROM borrow_records 
      WHERE operator_id = ? AND is_deleted = 0
    `;
    const recordResult = await executeQuery('mysql', recordSql, [userId]);
    
    if (recordResult[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该用户有相关操作记录，无法删除'
      });
    }

    // 软删除用户
    const deleteSql = `
      UPDATE system_users 
      SET is_deleted = 1, sync_version = sync_version + 1
      WHERE user_id = ?
    `;

    await executeQuery('mysql', deleteSql, [userId]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('system_users', ?, 'DELETE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ user_id: userId });
    await executeQuery('mysql', syncLogSql, [userId, changeData]);

    logger.info(`用户删除成功: ${user.username} (ID=${userId}) by ${req.user.username}`);

    res.json({
      success: true,
      message: '用户删除成功'
    });

  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
}));

/**
 * 获取用户统计信息
 */
router.get('/statistics/overview', requirePermission('USER_VIEW'), asyncHandler(async (req, res) => {
  try {
    // 用户角色统计
    const roleStatsSql = `
      SELECT 
        role,
        COUNT(*) as count
      FROM system_users 
      WHERE is_deleted = 0
      GROUP BY role
    `;
    const roleStats = await executeQuery('mysql', roleStatsSql);

    // 用户状态统计
    const statusStatsSql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM system_users 
      WHERE is_deleted = 0
      GROUP BY status
    `;
    const statusStats = await executeQuery('mysql', statusStatsSql);

    // 最近登录用户
    const recentLoginSql = `
      SELECT 
        user_id,
        username,
        real_name,
        role,
        last_login
      FROM system_users 
      WHERE is_deleted = 0 AND last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 10
    `;
    const recentLogins = await executeQuery('mysql', recentLoginSql);

    // 新注册用户（最近30天）
    const newUsersSql = `
      SELECT COUNT(*) as count
      FROM system_users 
      WHERE is_deleted = 0 
      AND created_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const newUsersResult = await executeQuery('mysql', newUsersSql);
    const newUsersCount = newUsersResult[0].count;

    res.json({
      success: true,
      message: '获取用户统计成功',
      data: {
        roleStats,
        statusStats,
        recentLogins,
        newUsersCount
      }
    });

  } catch (error) {
    logger.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户统计失败'
    });
  }
}));

module.exports = router;
