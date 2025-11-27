const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission, hashPassword } = require('../middleware/auth');
const { executeQuery, executeTransaction } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 公开的读者注册接口（不需要认证）
 */
router.post('/register', [
  body('username').notEmpty().isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50之间'),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('real_name').notEmpty().isLength({ max: 50 }).withMessage('真实姓名不能为空且长度不超过50'),
  body('email').optional().isEmail().withMessage('邮箱格式无效'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式无效'),
  body('gender').optional().isIn(['男', '女']).withMessage('性别值无效'),
  body('department').optional().isLength({ max: 100 }).withMessage('部门名称长度不超过100')
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
    username,
    password,
    real_name,
    email = '',
    phone = '',
    gender = '',
    department = ''
  } = req.body;

  try {
    // 检查用户名是否已存在
    const existingUser = await executeQuery('mysql', 
      'SELECT user_id FROM system_users WHERE username = ? AND is_deleted = 0', 
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await executeQuery('mysql', 
        'SELECT user_id FROM system_users WHERE email = ? AND is_deleted = 0', 
        [email]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被注册'
        });
      }
    }

    // 生成借书证号
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const cardNumber = `R${dateStr}${randomNum}`;

    // 创建系统用户
    const hashedPassword = await hashPassword(password);
    const insertUserSql = `
      INSERT INTO system_users (
        username, password, real_name, role, email, phone, status, db_source
      ) VALUES (?, ?, ?, 'reader', ?, ?, '激活', 'mysql')
    `;

    const userResult = await executeQuery('mysql', insertUserSql, [
      username, hashedPassword, real_name, email, phone
    ]);

    const userId = userResult.insertId;

    // 创建读者档案
    const registerDate = new Date().toISOString().split('T')[0];
    const expireDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const insertProfileSql = `
      INSERT INTO reader_profiles (
        user_id, card_number, gender, department, membership_type,
        register_date, expire_date, max_borrow, db_source
      ) VALUES (?, ?, ?, ?, '普通', ?, ?, 5, 'mysql')
    `;

    await executeQuery('mysql', insertProfileSql, [
      userId,
      cardNumber,
      gender,
      department,
      registerDate,
      expireDate
    ]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('system_users', ?, 'INSERT', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ 
      user_id: userId, 
      role: 'reader', 
      action: 'reader_register',
      card_number: cardNumber
    });
    
    await executeQuery('mysql', syncLogSql, [userId, changeData]);

    logger.info(`读者注册成功: ${real_name} (${username}) - 借书证号: ${cardNumber}`);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        user_id: userId,
        username,
        real_name,
        card_number: cardNumber,
        register_date: registerDate,
        expire_date: expireDate
      }
    });

  } catch (error) {
    logger.error('读者注册失败:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
}));

/**
 * 公开的用户名检查接口（不需要认证）
 */
router.get('/check-username/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username || username.length < 3 || username.length > 50) {
    return res.status(400).json({
      success: false,
      message: '用户名长度必须在3-50之间'
    });
  }

  try {
    const existingUser = await executeQuery('mysql', 
      'SELECT user_id FROM system_users WHERE username = ? AND is_deleted = 0', 
      [username]
    );

    res.json({
      success: true,
      available: existingUser.length === 0,
      message: existingUser.length === 0 ? '用户名可用' : '用户名已存在'
    });

  } catch (error) {
    logger.error('检查用户名失败:', error);
    res.status(500).json({
      success: false,
      message: '检查失败，请稍后重试'
    });
  }
}));

// 所有其他路由都需要认证
router.use(authenticate);

/**
 * 获取统一用户列表
 */
router.get('/', requirePermission('USER_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('search').optional().isLength({ max: 200 }).withMessage('搜索关键词长度不能超过200'),
  query('role').optional().isIn(['admin', 'librarian', 'reader', 'all']).withMessage('角色值无效'),
  query('status').optional().custom(value => {
    if (value === '' || value === null || value === undefined) return true;
    return ['激活', '停用'].includes(value);
  }).withMessage('状态值无效')
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
    role = 'all',
    status,
    sort_by = 'created_time',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['u.is_deleted = 0'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR rp.card_number LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (role && role !== 'all') {
      whereConditions.push('u.role = ?');
      queryParams.push(role);
    }

    if (status) {
      whereConditions.push('u.status = ?');
      queryParams.push(status);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 获取总数
    const countSql = `
      SELECT COUNT(DISTINCT u.user_id) as total
      FROM system_users u
      LEFT JOIN reader_profiles rp ON u.user_id = rp.user_id AND rp.is_deleted = 0
      ${whereClause}
    `;

    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult && countResult[0] ? countResult[0].total : 0;

    // 获取用户列表
    const listSql = `
      SELECT 
        u.user_id,
        u.username,
        u.real_name,
        u.role,
        u.email,
        u.phone,
        u.status,
        u.last_login,
        u.created_time,
        u.last_updated_time,
        -- 读者扩展信息
        rp.profile_id,
        rp.card_number,
        rp.gender,
        rp.department,
        rp.membership_type,
        rp.register_date,
        rp.expire_date,
        rp.max_borrow
      FROM system_users u
      LEFT JOIN reader_profiles rp ON u.user_id = rp.user_id AND rp.is_deleted = 0
      ${whereClause}
      ORDER BY u.user_id ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));
    const users = await executeQuery('mysql', listSql, queryParams);

    // 格式化返回数据
    const formattedUsers = users.map(user => {
      const baseUser = {
        user_id: user.user_id,
        username: user.username,
        real_name: user.real_name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        status: user.status,
        last_login: user.last_login,
        created_time: user.created_time,
        last_updated_time: user.last_updated_time
      };

      // 如果是读者，添加读者扩展信息
      if (user.role === 'reader' && user.profile_id) {
        baseUser.reader_profile = {
          profile_id: user.profile_id,
          card_number: user.card_number,
          gender: user.gender,
          department: user.department,
          membership_type: user.membership_type,
          register_date: user.register_date,
          expire_date: user.expire_date,
          max_borrow: user.max_borrow
        };
      }

      return baseUser;
    });

    res.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

/**
 * 获取单个用户详情
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
        u.user_id,
        u.username,
        u.real_name,
        u.role,
        u.email,
        u.phone,
        u.status,
        u.last_login,
        u.created_time,
        u.last_updated_time,
        -- 读者扩展信息
        rp.profile_id,
        rp.card_number,
        rp.gender,
        rp.department,
        rp.membership_type,
        rp.register_date,
        rp.expire_date,
        rp.max_borrow
      FROM system_users u
      LEFT JOIN reader_profiles rp ON u.user_id = rp.user_id AND rp.is_deleted = 0
      WHERE u.user_id = ? AND u.is_deleted = 0
    `;

    const users = await executeQuery('mysql', sql, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];
    const result = {
      user_id: user.user_id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      status: user.status,
      last_login: user.last_login,
      created_time: user.created_time,
      last_updated_time: user.last_updated_time
    };

    // 如果是读者，添加读者扩展信息
    if (user.role === 'reader' && user.profile_id) {
      result.reader_profile = {
        profile_id: user.profile_id,
        card_number: user.card_number,
        gender: user.gender,
        department: user.department,
        membership_type: user.membership_type,
        register_date: user.register_date,
        expire_date: user.expire_date,
        max_borrow: user.max_borrow
      };
    }

    res.json({
      success: true,
      data: result
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
 * 创建新用户
 */
router.post('/', requirePermission('USER_MANAGE'), [
  body('username').notEmpty().isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50之间'),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('real_name').notEmpty().isLength({ max: 50 }).withMessage('真实姓名不能为空且长度不超过50'),
  body('role').isIn(['admin', 'librarian', 'reader']).withMessage('角色值无效'),
  body('email').optional().isEmail().withMessage('邮箱格式无效'),
  body('phone').optional().matches(/^1[3-9]\d{9}$/).withMessage('手机号格式无效'),
  // 读者扩展字段验证
  body('card_number').if(body('role').equals('reader')).notEmpty().withMessage('读者必须提供借书证号'),
  body('department').optional().isLength({ max: 100 }).withMessage('部门长度不能超过100'),
  body('membership_type').optional().isIn(['普通', 'VIP', '教师', '学生']).withMessage('会员类型无效')
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
    username,
    password,
    real_name,
    role,
    email,
    phone,
    status = '激活',
    // 读者扩展字段
    card_number,
    gender,
    department,
    membership_type = '普通',
    register_date,
    expire_date,
    max_borrow = 5
  } = req.body;

  try {
    // 检查角色权限：图书管理员只能创建读者
    if (req.user.role === 'librarian' && role !== 'reader') {
      return res.status(403).json({
        success: false,
        message: '图书管理员只能添加读者账号'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await executeQuery('mysql', 
      'SELECT user_id FROM system_users WHERE username = ? AND is_deleted = 0', 
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 如果是读者，检查借书证号是否已存在
    if (role === 'reader' && card_number) {
      const existingCard = await executeQuery('mysql',
        'SELECT profile_id FROM reader_profiles WHERE card_number = ? AND is_deleted = 0',
        [card_number]
      );

      if (existingCard.length > 0) {
        return res.status(400).json({
          success: false,
          message: '借书证号已存在'
        });
      }
    }

    // 准备事务查询
    const hashedPassword = await hashPassword(password);
    const queries = [];

    // 创建系统用户
    const insertUserSql = `
      INSERT INTO system_users (
        username, password, real_name, role, email, phone, status, db_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'mysql')
    `;

    queries.push({
      sql: insertUserSql,
      params: [username, hashedPassword, real_name, role, email, phone, status]
    });

    // 执行事务
    const results = await executeTransaction('mysql', queries);
    const userId = results[0].insertId;

    // 如果是读者，创建读者档案
    if (role === 'reader') {
      const insertProfileSql = `
        INSERT INTO reader_profiles (
          user_id, card_number, gender, department, membership_type,
          register_date, expire_date, max_borrow, db_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'mysql')
      `;

      // 处理日期格式，确保是 YYYY-MM-DD 格式
      const formatDate = (dateValue) => {
        if (!dateValue) return null;
        const date = new Date(dateValue);
        return date.toISOString().split('T')[0];
      };

      const formattedRegisterDate = register_date ? formatDate(register_date) : new Date().toISOString().split('T')[0];
      const formattedExpireDate = expire_date ? formatDate(expire_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await executeQuery('mysql', insertProfileSql, [
        userId,
        card_number,
        gender,
        department,
        membership_type,
        formattedRegisterDate,
        formattedExpireDate,
        max_borrow
      ]);
    }

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('system_users', ?, 'INSERT', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ user_id: userId, role, action: 'create_user' });
    await executeQuery('mysql', syncLogSql, [userId, changeData]);

    logger.info(`用户创建成功: ${real_name} (${username}) - ${role} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: { user_id: userId }
    });

  } catch (error) {
    logger.error('创建用户失败:', error);
    res.status(500).json({
      success: false,
      message: '创建用户失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * 更新用户信息
 */
router.put('/:id', requirePermission('USER_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('real_name').optional().isLength({ max: 50 }).withMessage('真实姓名长度不超过50'),
  body('email').optional().isEmail().withMessage('邮箱格式无效'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式无效'),
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
    const existingUser = await executeQuery('mysql',
      'SELECT user_id, role FROM system_users WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = existingUser[0];

    // 更新系统用户基础信息
    const userFields = [];
    const userValues = [];

    ['real_name', 'email', 'phone', 'status'].forEach(field => {
      if (updateData[field] !== undefined) {
        userFields.push(`${field} = ?`);
        userValues.push(updateData[field]);
      }
    });

    if (userFields.length > 0) {
      userFields.push('last_updated_time = NOW()');
      userFields.push('sync_version = sync_version + 1');
      
      const updateUserSql = `UPDATE system_users SET ${userFields.join(', ')} WHERE user_id = ?`;
      userValues.push(userId);
      
      await executeQuery('mysql', updateUserSql, userValues);
    }

    // 如果是读者，更新读者档案
    if (user.role === 'reader') {
      const profileFields = [];
      const profileValues = [];

      ['gender', 'department', 'membership_type', 'expire_date', 'max_borrow'].forEach(field => {
        if (updateData[field] !== undefined) {
          profileFields.push(`${field} = ?`);
          
          // 处理日期字段格式
          if (field === 'expire_date' && updateData[field]) {
            // 将ISO日期格式转换为MySQL DATE格式 (YYYY-MM-DD)
            const dateValue = new Date(updateData[field]);
            const formattedDate = dateValue.toISOString().split('T')[0];
            profileValues.push(formattedDate);
          } else {
            profileValues.push(updateData[field]);
          }
        }
      });

      if (profileFields.length > 0) {
        profileFields.push('last_updated_time = NOW()');
        profileFields.push('sync_version = sync_version + 1');
        
        const updateProfileSql = `UPDATE reader_profiles SET ${profileFields.join(', ')} WHERE user_id = ?`;
        profileValues.push(userId);
        
        await executeQuery('mysql', updateProfileSql, profileValues);
      }
    }

    // 记录同步日志 - 只记录system_users表的字段
    const systemUsersFields = ['user_id', 'username', 'password', 'real_name', 'role', 'email', 'phone', 'last_login', 'status', 'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'];
    
    const systemUsersChangeData = { user_id: userId };
    Object.keys(updateData).forEach(key => {
      if (systemUsersFields.includes(key)) {
        systemUsersChangeData[key] = updateData[key];
      }
    });

    if (Object.keys(systemUsersChangeData).length > 1) { // 除了user_id还有其他字段
      const syncLogSql = `
        INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
        VALUES ('system_users', ?, 'UPDATE', ?, 'mysql')
      `;
      await executeQuery('mysql', syncLogSql, [userId, JSON.stringify(systemUsersChangeData)]);
    }

    // 如果更新了读者档案字段，记录reader_profiles的同步日志
    if (user.role === 'reader') {
      const readerProfilesFields = ['profile_id', 'user_id', 'card_number', 'gender', 'department', 'membership_type', 'register_date', 'expire_date', 'max_borrow', 'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'];
      
      const readerProfilesChangeData = {};
      Object.keys(updateData).forEach(key => {
        if (readerProfilesFields.includes(key)) {
          readerProfilesChangeData[key] = updateData[key];
        }
      });

      if (Object.keys(readerProfilesChangeData).length > 0) {
        // 获取profile_id
        const profileResult = await executeQuery('mysql', 'SELECT profile_id FROM reader_profiles WHERE user_id = ? AND is_deleted = 0', [userId]);
        if (profileResult.length > 0) {
          const profileId = profileResult[0].profile_id;
          readerProfilesChangeData.profile_id = profileId;
          
          const readerSyncLogSql = `
            INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
            VALUES ('reader_profiles', ?, 'UPDATE', ?, 'mysql')
          `;
          await executeQuery('mysql', readerSyncLogSql, [profileId, JSON.stringify(readerProfilesChangeData)]);
        }
      }
    }

    logger.info(`用户更新成功: ID=${userId} by ${req.user.username}`);

    res.json({
      success: true,
      message: '用户更新成功'
    });

  } catch (error) {
    logger.error('更新用户失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户失败',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

/**
 * 删除用户（软删除）
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
    const existingUser = await executeQuery('mysql',
      'SELECT user_id, real_name, role FROM system_users WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = existingUser[0];

    // 检查是否有未归还的借阅记录（如果是读者）
    if (user.role === 'reader') {
      const borrowSql = `
        SELECT COUNT(*) as count 
        FROM borrow_records br
        INNER JOIN reader_profiles rp ON br.reader_id = rp.profile_id
        WHERE rp.user_id = ? AND br.status IN ('借出', '逾期') AND br.is_deleted = 0
      `;
      const borrowResult = await executeQuery('mysql', borrowSql, [userId]);
      
      if (borrowResult[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: '该读者还有未归还的图书，无法删除'
        });
      }
    }

    // 准备事务查询
    const queries = [];

    // 软删除用户
    queries.push({
      sql: 'UPDATE system_users SET is_deleted = 1, sync_version = sync_version + 1 WHERE user_id = ?',
      params: [userId]
    });

    // 如果是读者，同时软删除读者档案
    if (user.role === 'reader') {
      queries.push({
        sql: 'UPDATE reader_profiles SET is_deleted = 1, sync_version = sync_version + 1 WHERE user_id = ?',
        params: [userId]
      });
    }

    // 记录同步日志
    const changeData = JSON.stringify({ user_id: userId });
    queries.push({
      sql: 'INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db) VALUES (?, ?, ?, ?, ?)',
      params: ['system_users', userId, 'DELETE', changeData, 'mysql']
    });

    // 执行事务
    await executeTransaction('mysql', queries);

    logger.info(`用户删除成功: ${user.real_name} (ID=${userId}) by ${req.user.username}`);

    res.json({
      success: true,
      message: '用户删除成功'
    });

  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * 重置用户密码
 */
router.post('/:id/reset-password', requirePermission('USER_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('new_password').notEmpty().isLength({ min: 6 }).withMessage('新密码长度至少6位')
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
    const existingUser = await executeQuery('mysql',
      'SELECT user_id, username FROM system_users WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = existingUser[0];
    const hashedPassword = await hashPassword(new_password);

    // 更新密码
    await executeQuery('mysql',
      'UPDATE system_users SET password = ?, last_updated_time = NOW(), sync_version = sync_version + 1 WHERE user_id = ?',
      [hashedPassword, userId]
    );

    logger.info(`密码重置成功: ${user.username} (ID=${userId}) by ${req.user.username}`);

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

module.exports = router;
