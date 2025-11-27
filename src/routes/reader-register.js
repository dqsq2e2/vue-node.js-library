const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 读者自助注册
 */
router.post('/register', [
  body('username').notEmpty().isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50之间'),
  body('password').notEmpty().isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('real_name').notEmpty().isLength({ max: 50 }).withMessage('真实姓名不能为空且长度不超过50'),
  body('email').optional().isEmail().withMessage('邮箱格式无效'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式无效'),
  body('gender').optional().isIn(['男', '女']).withMessage('性别值无效'),
  body('department').optional().isLength({ max: 100 }).withMessage('部门名称长度不超过100'),
  body('id_card').optional().isLength({ min: 15, max: 18 }).withMessage('身份证号长度无效')
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
    email,
    phone,
    gender = '',
    department = '',
    id_card = ''
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

    // 检查手机号是否已存在（如果提供了手机号）
    if (phone) {
      const existingPhone = await executeQuery('mysql', 
        'SELECT user_id FROM system_users WHERE phone = ? AND is_deleted = 0', 
        [phone]
      );

      if (existingPhone.length > 0) {
        return res.status(400).json({
          success: false,
          message: '手机号已被注册'
        });
      }
    }

    // 生成借书证号（格式：R + 年月日 + 4位随机数）
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    let cardNumber = `R${dateStr}${randomNum}`;

    // 确保借书证号唯一
    let cardExists = true;
    let attempts = 0;
    while (cardExists && attempts < 10) {
      const existingCard = await executeQuery('mysql', 
        'SELECT profile_id FROM reader_profiles WHERE card_number = ? AND is_deleted = 0', 
        [cardNumber]
      );
      
      if (existingCard.length === 0) {
        cardExists = false;
      } else {
        attempts++;
        const newRandomNum = Math.floor(Math.random() * 9000) + 1000;
        cardNumber = `R${dateStr}${newRandomNum}`;
      }
    }

    if (cardExists) {
      return res.status(500).json({
        success: false,
        message: '生成借书证号失败，请稍后重试'
      });
    }

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
    const expireDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 一年后过期

    const insertProfileSql = `
      INSERT INTO reader_profiles (
        user_id, card_number, gender, department, membership_type,
        register_date, expire_date, max_borrow, id_card, db_source
      ) VALUES (?, ?, ?, ?, '普通', ?, ?, 5, ?, 'mysql')
    `;

    await executeQuery('mysql', insertProfileSql, [
      userId,
      cardNumber,
      gender,
      department,
      registerDate,
      expireDate,
      id_card
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
 * 检查用户名是否可用
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

/**
 * 获取注册配置信息
 */
router.get('/config', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      password_min_length: 6,
      username_min_length: 3,
      username_max_length: 50,
      membership_types: ['普通', 'VIP'],
      default_membership_type: '普通',
      default_max_borrow: 5,
      card_validity_days: 365,
      required_fields: ['username', 'password', 'real_name'],
      optional_fields: ['email', 'phone', 'gender', 'department', 'id_card']
    }
  });
}));

module.exports = router;
