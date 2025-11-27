const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const { requirePermission } = require('../middleware/auth');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * 发送验证码邮件
 */
router.post('/verification-code', [
  body('to').isEmail().withMessage('请输入有效的邮箱地址'),
  body('code').notEmpty().withMessage('验证码不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { to, code } = req.body;

  try {
    const result = await emailService.sendVerificationCode(to, code);
    
    logger.info(`验证码邮件发送成功: ${to}`);
    
    res.json({
      success: true,
      message: '验证码邮件发送成功',
      data: result
    });
  } catch (error) {
    logger.error('验证码邮件发送失败:', error.message);
    res.status(500).json({
      success: false,
      message: '邮件发送失败: ' + error.message
    });
  }
}));

/**
 * 发送逾期通知邮件
 */
router.post('/overdue-notification', requirePermission('BOOK_MANAGE'), [
  body('to').isEmail().withMessage('请输入有效的邮箱地址'),
  body('bookInfo').isObject().withMessage('图书信息必须是对象'),
  body('bookInfo.title').notEmpty().withMessage('图书名称不能为空'),
  body('bookInfo.borrowDate').notEmpty().withMessage('借阅日期不能为空'),
  body('bookInfo.dueDate').notEmpty().withMessage('应还日期不能为空'),
  body('bookInfo.overdueDays').isInt({ min: 1 }).withMessage('逾期天数必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { to, bookInfo } = req.body;

  try {
    const result = await emailService.sendOverdueNotification(to, bookInfo);
    
    logger.info(`逾期通知邮件发送成功: ${to} - ${bookInfo.title} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '逾期通知邮件发送成功',
      data: result
    });
  } catch (error) {
    logger.error('逾期通知邮件发送失败:', error.message);
    res.status(500).json({
      success: false,
      message: '邮件发送失败: ' + error.message
    });
  }
}));

/**
 * 发送同步冲突通知邮件
 */
router.post('/sync-conflict-notification', requirePermission('USER_MANAGE'), [
  body('to').isEmail().withMessage('请输入有效的邮箱地址'),
  body('conflictInfo').isObject().withMessage('冲突信息必须是对象'),
  body('conflictInfo.tableName').notEmpty().withMessage('表名不能为空'),
  body('conflictInfo.recordId').notEmpty().withMessage('记录ID不能为空'),
  body('conflictInfo.conflictTime').notEmpty().withMessage('冲突时间不能为空'),
  body('conflictInfo.conflictType').notEmpty().withMessage('冲突类型不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { to, conflictInfo } = req.body;

  try {
    const result = await emailService.sendSyncConflictNotification(to, conflictInfo);
    
    logger.info(`同步冲突通知邮件发送成功: ${to} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '同步冲突通知邮件发送成功',
      data: result
    });
  } catch (error) {
    logger.error('同步冲突通知邮件发送失败:', error.message);
    res.status(500).json({
      success: false,
      message: '邮件发送失败: ' + error.message
    });
  }
}));

module.exports = router;
