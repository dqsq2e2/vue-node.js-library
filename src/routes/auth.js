const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { loginUser, registerUser, changePassword, getUserInfo, authenticate } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * 用户登录
 */
router.post('/login', [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50个字符之间'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码长度至少6个字符')
], asyncHandler(async (req, res) => {
  // 检查验证结果
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    });
  }

  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);
    
    res.json({
      success: true,
      message: '登录成功',
      data: result
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message || '登录失败'
    });
  }
}));

// 存储验证码的临时对象（生产环境应使用Redis）
const verificationCodes = new Map();

/**
 * 发送注册验证码
 */
router.post('/send-verification-code', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  try {
    // 检查邮箱是否已注册
    const checkSql = 'SELECT user_id FROM system_users WHERE email = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', checkSql, [email]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 生成6位验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 存储验证码（10分钟有效期）
    verificationCodes.set(email, {
      code,
      expireAt: Date.now() + 10 * 60 * 1000
    });

    // 发送验证码邮件
    await emailService.sendVerificationCode(email, code);

    logger.info(`验证码已发送至: ${email}`);

    res.json({
      success: true,
      message: '验证码已发送，请查收邮件'
    });

  } catch (error) {
    logger.error('发送验证码失败:', error.message);
    res.status(500).json({
      success: false,
      message: '发送验证码失败: ' + error.message
    });
  }
}));

/**
 * 用户注册
 */
router.post('/register', [
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
    .optional()
    .isIn(['admin', 'librarian', 'reader'])
    .withMessage('角色必须是admin、librarian或reader'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式不正确'),
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确'),
  body('verificationCode')
    .optional()
    .isLength({ min: 6, max: 6 })
    .withMessage('验证码必须是6位数字')
], asyncHandler(async (req, res) => {
  // 检查验证结果
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    });
  }

  const { email, verificationCode } = req.body;

  try {
    // 如果提供了邮箱，验证验证码
    if (email && verificationCode) {
      const storedData = verificationCodes.get(email);
      
      if (!storedData) {
        return res.status(400).json({
          success: false,
          message: '验证码不存在或已过期，请重新获取'
        });
      }

      if (Date.now() > storedData.expireAt) {
        verificationCodes.delete(email);
        return res.status(400).json({
          success: false,
          message: '验证码已过期，请重新获取'
        });
      }

      if (storedData.code !== verificationCode) {
        return res.status(400).json({
          success: false,
          message: '验证码错误'
        });
      }

      // 验证成功，删除验证码
      verificationCodes.delete(email);
    }

    const user = await registerUser(req.body);
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: user
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || '注册失败'
    });
  }
}));

/**
 * 修改密码
 */
router.post('/change-password', authenticate, [
  body('oldPassword')
    .notEmpty()
    .withMessage('原密码不能为空'),
  body('newPassword')
    .notEmpty()
    .withMessage('新密码不能为空')
    .isLength({ min: 6 })
    .withMessage('新密码长度至少6个字符'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('确认密码与新密码不一致');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  // 检查验证结果
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    });
  }

  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    await changePassword(userId, oldPassword, newPassword);
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || '密码修改失败'
    });
  }
}));

/**
 * 获取当前用户信息
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  try {
    const user = await getUserInfo(req.user.id);
    
    res.json({
      success: true,
      message: '获取用户信息成功',
      data: user
    });
    
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || '获取用户信息失败'
    });
  }
}));

/**
 * 发送修改邮箱验证码
 */
router.post('/send-email-change-code', authenticate, [
  body('newEmail').isEmail().withMessage('请输入有效的邮箱地址')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { newEmail } = req.body;
  const userId = req.user.id;

  try {
    // 检查新邮箱是否已被其他用户使用
    const checkSql = 'SELECT user_id FROM system_users WHERE email = ? AND user_id != ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', checkSql, [newEmail, userId]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被其他用户使用'
      });
    }

    // 生成6位验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 存储验证码（10分钟有效期），使用特殊key标识是修改邮箱的验证码
    const verifyKey = `email_change_${userId}_${newEmail}`;
    verificationCodes.set(verifyKey, {
      code,
      userId,
      newEmail,
      expireAt: Date.now() + 10 * 60 * 1000
    });

    // 发送验证码邮件到新邮箱
    await emailService.sendVerificationCode(newEmail, code);

    logger.info(`邮箱修改验证码已发送至: ${newEmail}, 用户ID: ${userId}`);

    res.json({
      success: true,
      message: '验证码已发送到新邮箱，请查收'
    });

  } catch (error) {
    logger.error('发送邮箱修改验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败: ' + error.message
    });
  }
}));

/**
 * 更新用户信息
 */
router.put('/profile', authenticate, [
  body('email')
    .optional()
    .isEmail()
    .withMessage('请输入正确的邮箱地址'),
  body('emailCode')
    .optional()
    .isLength({ min: 6, max: 6 })
    .withMessage('验证码必须是6位数字'),
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('请输入正确的手机号')
], asyncHandler(async (req, res) => {
  // 检查验证结果
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    });
  }

  const { email, emailCode, phone } = req.body;
  const userId = req.user.id;

  try {
    // 如果要修改邮箱，必须提供验证码
    if (email) {
      if (!emailCode) {
        return res.status(400).json({
          success: false,
          message: '修改邮箱需要提供验证码'
        });
      }

      // 验证验证码
      const verifyKey = `email_change_${userId}_${email}`;
      const storedData = verificationCodes.get(verifyKey);

      if (!storedData) {
        return res.status(400).json({
          success: false,
          message: '验证码不存在或已过期，请重新获取'
        });
      }

      if (Date.now() > storedData.expireAt) {
        verificationCodes.delete(verifyKey);
        return res.status(400).json({
          success: false,
          message: '验证码已过期，请重新获取'
        });
      }

      if (storedData.code !== emailCode) {
        return res.status(400).json({
          success: false,
          message: '验证码错误'
        });
      }

      // 验证通过，删除验证码
      verificationCodes.delete(verifyKey);
    }

    // 更新用户信息
    const updateFields = [];
    const updateValues = [];

    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有需要更新的信息'
      });
    }

    updateFields.push('last_updated_time = NOW()');
    updateValues.push(userId);

    const sql = `
      UPDATE system_users 
      SET ${updateFields.join(', ')}
      WHERE user_id = ? AND is_deleted = 0
    `;
    
    const result = await executeQuery('mysql', sql, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取更新后的用户信息
    const user = await getUserInfo(userId);
    
    logger.info(`用户 ${userId} 更新个人信息${email ? ' (含邮箱)' : ''}`);
    
    res.json({
      success: true,
      message: '用户信息更新成功',
      data: user
    });
    
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新用户信息失败'
    });
  }
}));

/**
 * 刷新Token
 */
router.post('/refresh', authenticate, asyncHandler(async (req, res) => {
  try {
    const user = await getUserInfo(req.user.id);
    const { generateToken } = require('../middleware/auth');
    const newToken = generateToken(user);
    
    res.json({
      success: true,
      message: 'Token刷新成功',
      data: {
        token: newToken,
        user
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Token刷新失败'
    });
  }
}));

/**
 * 用户登出
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // 登出不需要认证，因为可能token已经过期
  // 这里可以实现Token黑名单机制
  
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    logger.info(`用户登出，Token: ${token ? '有效' : '无效'}`);
  } else {
    logger.info('用户登出，无Token');
  }
  
  res.json({
    success: true,
    message: '登出成功'
  });
}));

/**
 * 验证Token有效性
 */
router.get('/verify', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Token有效',
    data: {
      user: req.user
    }
  });
}));

module.exports = router;
