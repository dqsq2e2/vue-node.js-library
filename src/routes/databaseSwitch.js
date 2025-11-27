const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission } = require('../middleware/auth');
const databaseSwitchService = require('../services/databaseSwitchService');
const logger = require('../utils/logger');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticate);

/**
 * 获取数据库状态概览
 * GET /api/database-switch/overview
 */
router.get('/overview', requirePermission('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  try {
    const overview = await databaseSwitchService.getDatabaseOverview();
    
    res.json({
      success: true,
      message: '获取数据库状态概览成功',
      data: overview
    });
  } catch (error) {
    logger.error('获取数据库状态概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库状态概览失败',
      error: error.message
    });
  }
}));

/**
 * 获取当前主数据库
 * GET /api/database-switch/current
 */
router.get('/current', asyncHandler(async (req, res) => {
  try {
    const currentDB = databaseSwitchService.getCurrentPrimaryDB();
    const availableDatabases = databaseSwitchService.getAvailableDatabases();
    
    res.json({
      success: true,
      message: '获取当前主数据库成功',
      data: {
        currentPrimaryDB: currentDB,
        availableDatabases: availableDatabases
      }
    });
  } catch (error) {
    logger.error('获取当前主数据库失败:', error);
    res.status(500).json({
      success: false,
      message: '获取当前主数据库失败',
      error: error.message
    });
  }
}));

/**
 * 检查数据库健康状态
 * GET /api/database-switch/health?database=mysql
 */
router.get('/health', [
  query('database').optional().isIn(['mysql', 'mariadb', 'greatsql']).withMessage('数据库名称无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { database } = req.query;
    const healthStatus = await databaseSwitchService.checkDatabaseHealth(database);
    
    res.json({
      success: true,
      message: '数据库健康检查完成',
      data: healthStatus
    });
  } catch (error) {
    logger.error('数据库健康检查失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库健康检查失败',
      error: error.message
    });
  }
}));

/**
 * 验证数据一致性
 * POST /api/database-switch/validate-consistency
 */
router.post('/validate-consistency', requirePermission('SUPER_ADMIN'), [
  body('sourceDB').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('源数据库名称无效'),
  body('targetDB').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('目标数据库名称无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { sourceDB, targetDB } = req.body;
    
    if (sourceDB === targetDB) {
      return res.status(400).json({
        success: false,
        message: '源数据库和目标数据库不能相同'
      });
    }

    const consistencyReport = await databaseSwitchService.validateDataConsistency(sourceDB, targetDB);
    
    res.json({
      success: true,
      message: '数据一致性验证完成',
      data: consistencyReport
    });
  } catch (error) {
    logger.error('数据一致性验证失败:', error);
    res.status(500).json({
      success: false,
      message: '数据一致性验证失败',
      error: error.message
    });
  }
}));

/**
 * 触发数据同步
 * POST /api/database-switch/trigger-sync
 */
router.post('/trigger-sync', requirePermission('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  try {
    const result = await databaseSwitchService.triggerDataSync();
    
    logger.info(`数据同步已触发 by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '数据同步已触发',
      data: result
    });
  } catch (error) {
    logger.error('触发数据同步失败:', error);
    res.status(500).json({
      success: false,
      message: '触发数据同步失败',
      error: error.message
    });
  }
}));

/**
 * 切换主数据库
 * POST /api/database-switch/switch
 */
router.post('/switch', requirePermission('SUPER_ADMIN'), [
  body('targetDB').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('目标数据库名称无效'),
  body('force').optional().isBoolean().withMessage('force参数必须是布尔值'),
  body('skipConsistencyCheck').optional().isBoolean().withMessage('skipConsistencyCheck参数必须是布尔值'),
  body('reason').optional().isLength({ min: 1, max: 200 }).withMessage('切换原因长度必须在1-200字符之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { targetDB, force = false, skipConsistencyCheck = false, reason = '管理员手动切换' } = req.body;
    
    const currentDB = databaseSwitchService.getCurrentPrimaryDB();
    if (targetDB === currentDB) {
      return res.status(400).json({
        success: false,
        message: '目标数据库与当前主数据库相同'
      });
    }

    const switchResult = await databaseSwitchService.switchPrimaryDatabase(targetDB, {
      force,
      skipConsistencyCheck,
      reason,
      operator: req.user.username
    });

    logger.info(`主数据库切换成功: ${currentDB} -> ${targetDB} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '主数据库切换成功',
      data: switchResult
    });
  } catch (error) {
    logger.error('主数据库切换失败:', error);
    res.status(500).json({
      success: false,
      message: '主数据库切换失败',
      error: error.message
    });
  }
}));

/**
 * 回滚到上一个数据库
 * POST /api/database-switch/rollback
 */
router.post('/rollback', requirePermission('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  try {
    const rollbackResult = await databaseSwitchService.rollbackToPreviousDatabase(req.user.username);
    
    logger.info(`数据库回滚成功 by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '数据库回滚成功',
      data: rollbackResult
    });
  } catch (error) {
    logger.error('数据库回滚失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库回滚失败',
      error: error.message
    });
  }
}));

/**
 * 获取切换历史
 * GET /api/database-switch/history?limit=10
 */
router.get('/history', requirePermission('SUPER_ADMIN'), [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit必须是1-50之间的整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { limit = 10 } = req.query;
    const history = databaseSwitchService.getSwitchHistory(parseInt(limit));
    
    res.json({
      success: true,
      message: '获取切换历史成功',
      data: {
        history: history,
        total: history.length
      }
    });
  } catch (error) {
    logger.error('获取切换历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取切换历史失败',
      error: error.message
    });
  }
}));

/**
 * 获取切换预检报告
 * POST /api/database-switch/pre-check
 */
router.post('/pre-check', requirePermission('SUPER_ADMIN'), [
  body('targetDB').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('目标数据库名称无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { targetDB } = req.body;
    const currentDB = databaseSwitchService.getCurrentPrimaryDB();
    
    if (targetDB === currentDB) {
      return res.status(400).json({
        success: false,
        message: '目标数据库与当前主数据库相同'
      });
    }

    // 执行预检查
    const [healthStatus, consistencyReport] = await Promise.all([
      databaseSwitchService.checkDatabaseHealth(targetDB),
      databaseSwitchService.validateDataConsistency(currentDB, targetDB)
    ]);

    const preCheckResult = {
      currentDB: currentDB,
      targetDB: targetDB,
      targetHealth: healthStatus,
      dataConsistency: consistencyReport,
      canSwitch: healthStatus.status === 'healthy' && consistencyReport.consistent,
      warnings: [],
      recommendations: []
    };

    // 生成警告和建议
    if (healthStatus.status !== 'healthy') {
      preCheckResult.warnings.push(`目标数据库健康状态异常: ${healthStatus.error}`);
      preCheckResult.recommendations.push('建议先修复目标数据库的健康问题');
    }

    if (!consistencyReport.consistent) {
      preCheckResult.warnings.push(`数据不一致，影响 ${consistencyReport.totalTables - consistencyReport.consistentTables} 个表`);
      preCheckResult.recommendations.push('建议先触发数据同步，确保数据一致性');
    }

    if (healthStatus.responseTime > 1000) {
      preCheckResult.warnings.push(`目标数据库响应时间较慢: ${healthStatus.responseTime}ms`);
      preCheckResult.recommendations.push('建议检查目标数据库性能');
    }

    res.json({
      success: true,
      message: '切换预检完成',
      data: preCheckResult
    });
  } catch (error) {
    logger.error('切换预检失败:', error);
    res.status(500).json({
      success: false,
      message: '切换预检失败',
      error: error.message
    });
  }
}));

module.exports = router;
