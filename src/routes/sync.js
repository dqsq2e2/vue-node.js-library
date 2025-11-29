const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const { triggerSync, getSyncStats } = require('../services/syncService');
const logger = require('../utils/logger');

const router = express.Router();

// 所有同步相关路由都需要认证
router.use(authenticate);

/**
 * 获取同步状态概览
 */
router.get('/status', requirePermission('SYNC_VIEW'), asyncHandler(async (req, res) => {
  try {
    // 获取同步统计
    const stats = await getSyncStats();
    
    // 获取待同步记录数（不包括同步失败的记录）
    const pendingSql = `
      SELECT COUNT(*) as count 
      FROM sync_log 
      WHERE sync_status = '待同步'
    `;
    const pendingResult = await executeQuery('mysql', pendingSql);
    const pendingCount = pendingResult[0].count;

    // 获取冲突记录数
    const conflictSql = `
      SELECT COUNT(*) as count 
      FROM conflict_records 
      WHERE resolve_status = '待处理'
    `;
    const conflictResult = await executeQuery('mysql', conflictSql);
    const conflictCount = conflictResult[0].count;

    // 获取数据库连接状态
    const { testDatabaseConnections } = require('../config/database');
    const connectionStatus = await testDatabaseConnections();

    res.json({
      success: true,
      message: '获取同步状态成功',
      data: {
        stats,
        pendingCount,
        conflictCount,
        connectionStatus
      }
    });

  } catch (error) {
    logger.error('获取同步状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步状态失败'
    });
  }
}));

/**
 * 获取同步日志列表
 */
router.get('/logs', requirePermission('SYNC_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('table_name').optional().isLength({ max: 50 }).withMessage('表名长度不能超过50'),
  query('operation').optional().isIn(['INSERT', 'UPDATE', 'DELETE']).withMessage('操作类型无效'),
  query('sync_status').optional().isIn(['待同步', '同步中', '同步成功', '同步失败']).withMessage('同步状态无效'),
  query('source_db').optional().isLength({ max: 50 }).withMessage('源数据库名称长度不能超过50')
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
    table_name,
    operation,
    sync_status,
    source_db,
    start_date,
    end_date,
    sort_by = 'change_time',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (table_name) {
      whereConditions.push('table_name = ?');
      queryParams.push(table_name);
    }

    if (operation) {
      whereConditions.push('operation = ?');
      queryParams.push(operation);
    }

    if (sync_status) {
      whereConditions.push('sync_status = ?');
      queryParams.push(sync_status);
    }

    if (source_db) {
      whereConditions.push('source_db = ?');
      queryParams.push(source_db);
    }

    if (start_date) {
      whereConditions.push('DATE(change_time) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(change_time) <= ?');
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM sync_log WHERE ${whereClause}`;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取同步日志列表
    const listSql = `
      SELECT 
        log_id,
        table_name,
        record_id,
        operation,
        change_time,
        source_db,
        synced_databases,
        sync_status,
        retry_count,
        last_retry_time,
        error_message
      FROM sync_log
      WHERE ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const logs = await executeQuery('mysql', listSql, [...queryParams, parseInt(limit), parseInt(offset)]);

    // 解析JSON字段
    logs.forEach(log => {
      if (log.synced_databases) {
        try {
          log.synced_databases = JSON.parse(log.synced_databases);
        } catch (e) {
          log.synced_databases = [];
        }
      }
    });

    res.json({
      success: true,
      message: '获取同步日志成功',
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取同步日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步日志失败'
    });
  }
}));

/**
 * 获取冲突记录列表
 */
router.get('/conflicts', requirePermission('SYNC_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('table_name').optional().isLength({ max: 50 }).withMessage('表名长度不能超过50'),
  query('resolve_status').optional().isIn(['待处理', '已解决', '忽略']).withMessage('解决状态无效')
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
    table_name,
    resolve_status,
    sort_by = 'conflict_time',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (table_name) {
      whereConditions.push('table_name = ?');
      queryParams.push(table_name);
    }

    if (resolve_status) {
      whereConditions.push('resolve_status = ?');
      queryParams.push(resolve_status);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM conflict_records WHERE ${whereClause}`;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取冲突记录列表
    const listSql = `
      SELECT 
        cr.conflict_id,
        cr.table_name,
        cr.record_id,
        cr.source_db,
        cr.source_data,
        cr.target_db,
        cr.target_data,
        cr.conflict_time,
        cr.resolve_status,
        cr.resolve_action,
        cr.resolved_by,
        su.real_name as resolved_by_name,
        cr.resolved_time,
        cr.remarks
      FROM conflict_records cr
      LEFT JOIN system_users su ON cr.resolved_by = su.user_id
      WHERE ${whereClause}
      ORDER BY cr.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const conflicts = await executeQuery('mysql', listSql, [...queryParams, parseInt(limit), parseInt(offset)]);

    // 解析JSON字段
    conflicts.forEach(conflict => {
      if (conflict.source_data) {
        try {
          conflict.source_data = JSON.parse(conflict.source_data);
        } catch (e) {
          conflict.source_data = {};
        }
      }
      if (conflict.target_data) {
        try {
          conflict.target_data = JSON.parse(conflict.target_data);
        } catch (e) {
          conflict.target_data = {};
        }
      }
    });

    res.json({
      success: true,
      message: '获取冲突记录成功',
      data: {
        conflicts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取冲突记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取冲突记录失败'
    });
  }
}));

/**
 * 手动触发同步
 */
router.post('/trigger', requirePermission('SYNC_MANAGE'), asyncHandler(async (req, res) => {
  try {
    await triggerSync();
    
    logger.info(`手动触发同步 by ${req.user.username}`);
    
    res.json({
      success: true,
      message: '同步任务已触发'
    });

  } catch (error) {
    logger.error('触发同步失败:', error);
    res.status(500).json({
      success: false,
      message: '触发同步失败'
    });
  }
}));

/**
 * 解决冲突
 */
router.post('/conflicts/:id/resolve', requirePermission('SYNC_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('冲突ID必须是正整数'),
  body('resolve_action')
    .isIn(['USE_SOURCE', 'USE_TARGET', 'MANUAL_MERGE', 'IGNORE'])
    .withMessage('解决方案无效'),
  body('manual_data').optional().isObject().withMessage('手动合并数据必须是对象'),
  body('remarks').optional().isLength({ max: 500 }).withMessage('备注长度不能超过500')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const conflictId = req.params.id;
  const { resolve_action, manual_data, remarks } = req.body;
  const resolvedBy = req.user.id;

  try {
    // 获取冲突记录
    const conflictSql = `
      SELECT * FROM conflict_records 
      WHERE conflict_id = ? AND resolve_status = '待处理'
    `;
    const conflictResult = await executeQuery('mysql', conflictSql, [conflictId]);
    
    if (conflictResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: '冲突记录不存在或已处理'
      });
    }

    const conflict = conflictResult[0];

    // 根据解决方案执行相应操作
    let finalData = null;
    
    switch (resolve_action) {
      case 'USE_SOURCE':
        finalData = JSON.parse(conflict.source_data);
        break;
      case 'USE_TARGET':
        finalData = JSON.parse(conflict.target_data);
        break;
      case 'MANUAL_MERGE':
        if (!manual_data) {
          return res.status(400).json({
            success: false,
            message: '手动合并需要提供合并后的数据'
          });
        }
        finalData = manual_data;
        break;
      case 'IGNORE':
        // 忽略冲突，不执行数据更新
        break;
    }

    // 如果不是忽略操作，则更新目标数据库
    if (resolve_action !== 'IGNORE' && finalData) {
      // 这里需要根据表名和记录ID更新目标数据库
      // 简化处理，实际应该调用同步服务的相关方法
      const { executeQuery: targetExecuteQuery } = require('../config/database');
      
      // 构建更新SQL（简化版本）
      const updateFields = Object.keys(finalData)
        .filter(key => key !== conflict.table_name.replace('s', '') + '_id')
        .map(key => `${key} = ?`);
      
      if (updateFields.length > 0) {
        const updateValues = Object.keys(finalData)
          .filter(key => key !== conflict.table_name.replace('s', '') + '_id')
          .map(key => finalData[key]);
        
        updateValues.push(conflict.record_id);
        
        const updateSql = `
          UPDATE ${conflict.table_name} 
          SET ${updateFields.join(', ')} 
          WHERE ${conflict.table_name.replace('s', '')}_id = ?
        `;
        
        await targetExecuteQuery(conflict.target_db, updateSql, updateValues);
      }
    }

    // 更新冲突记录状态
    const updateConflictSql = `
      UPDATE conflict_records 
      SET resolve_status = ?, 
          resolve_action = ?, 
          resolved_by = ?, 
          resolved_time = CURRENT_TIMESTAMP,
          remarks = ?
      WHERE conflict_id = ?
    `;

    const newStatus = resolve_action === 'IGNORE' ? '忽略' : '已解决';
    
    await executeQuery('mysql', updateConflictSql, [
      newStatus, resolve_action, resolvedBy, remarks, conflictId
    ]);

    // 同时更新相关的同步日志状态（与批量解决保持一致）
    const resolutionLabels = {
      'USE_SOURCE': '使用源数据库数据',
      'USE_TARGET': '使用目标数据库数据',
      'MANUAL_MERGE': '手动合并数据',
      'IGNORE': '忽略冲突'
    };
    
    await executeQuery('mysql', `
      UPDATE sync_log 
      SET sync_status = '同步成功', 
          error_message = CONCAT('冲突已解决: ', ?)
      WHERE table_name = ? AND record_id = ? AND sync_status = '冲突待处理'
    `, [resolutionLabels[resolve_action] || resolve_action, conflict.table_name, conflict.record_id]);

    logger.info(`冲突解决成功: conflict_id=${conflictId}, action=${resolve_action} by ${req.user.username}`);

    res.json({
      success: true,
      message: '冲突解决成功'
    });

  } catch (error) {
    logger.error('解决冲突失败:', error);
    res.status(500).json({
      success: false,
      message: '解决冲突失败'
    });
  }
}));

/**
 * 获取同步配置
 */
router.get('/config', requirePermission('SYNC_MANAGE'), asyncHandler(async (req, res) => {
  try {
    const sql = `
      SELECT config_key, config_value, description, last_updated
      FROM sync_config
      ORDER BY config_key
    `;

    const configs = await executeQuery('mysql', sql);

    // 转换为键值对格式
    const configMap = {};
    configs.forEach(config => {
      let value = config.config_value;
      
      // 尝试解析JSON值
      try {
        if (value && (value.startsWith('[') || value.startsWith('{'))) {
          value = JSON.parse(value);
        }
      } catch (e) {
        // 保持原始值
      }
      
      configMap[config.config_key] = {
        value,
        description: config.description,
        last_updated: config.last_updated
      };
    });

    res.json({
      success: true,
      message: '获取同步配置成功',
      data: configs.map(config => {
        let value = config.config_value;
        
        // 尝试解析JSON值
        try {
          if (value && (value.startsWith('[') || value.startsWith('{'))) {
            value = JSON.parse(value);
          }
        } catch (e) {
          // 保持原始值
        }
        
        return {
          config_key: config.config_key,
          config_value: value,
          description: config.description,
          last_updated: config.last_updated
        };
      }),
      // 保留对象格式以兼容其他客户端
      config_map: configMap
    });

  } catch (error) {
    logger.error('获取同步配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步配置失败'
    });
  }
}));

/**
 * 更新同步配置
 */
router.put('/config', requirePermission('SYNC_MANAGE'), [
  body('configs').isObject().withMessage('配置必须是对象格式')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { configs } = req.body;

  try {
    // 更新配置
    for (const [key, value] of Object.entries(configs)) {
      const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      const updateSql = `
        UPDATE sync_config 
        SET config_value = ?, last_updated = CURRENT_TIMESTAMP
        WHERE config_key = ?
      `;
      
      await executeQuery('mysql', updateSql, [configValue, key]);
    }

    logger.info(`同步配置更新成功 by ${req.user.username}`);

    res.json({
      success: true,
      message: '同步配置更新成功'
    });

  } catch (error) {
    logger.error('更新同步配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新同步配置失败'
    });
  }
}));

/**
 * 获取数据库连接状态
 */
router.get('/databases/status', requirePermission('SYNC_VIEW'), asyncHandler(async (req, res) => {
  try {
    const { testDatabaseConnections } = require('../config/database');
    const connectionStatus = await testDatabaseConnections();

    // 获取数据库配置信息
    const configSql = `
      SELECT db_name, db_type, host, port, database_name, status, last_sync_time
      FROM db_connections
      ORDER BY sync_priority
    `;
    const dbConfigs = await executeQuery('mysql', configSql);

    // 合并连接状态和配置信息
    const databaseStatus = dbConfigs.map(config => ({
      ...config,
      connection_status: connectionStatus[config.db_name] || { status: 'unknown', error: '未测试' }
    }));

    res.json({
      success: true,
      message: '获取数据库状态成功',
      data: databaseStatus
    });

  } catch (error) {
    logger.error('获取数据库状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库状态失败'
    });
  }
}));

/**
 * 清理同步日志
 */
router.delete('/logs/cleanup', requirePermission('SYNC_MANAGE'), [
  body('days').optional().isInt({ min: 1, max: 365 }).withMessage('保留天数必须在1-365之间'),
  body('status').optional().isIn(['同步成功', '同步失败', 'all']).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { days = 30, status = 'all' } = req.body;

  try {
    let whereCondition = 'change_time < DATE_SUB(NOW(), INTERVAL ? DAY)';
    let queryParams = [days];

    if (status !== 'all') {
      whereCondition += ' AND sync_status = ?';
      queryParams.push(status);
    }

    const deleteSql = `DELETE FROM sync_log WHERE ${whereCondition}`;
    const result = await executeQuery('mysql', deleteSql, queryParams);

    logger.info(`同步日志清理完成: 删除了 ${result.affectedRows} 条记录 by ${req.user.username}`);

    res.json({
      success: true,
      message: `清理完成，删除了 ${result.affectedRows} 条日志记录`
    });

  } catch (error) {
    logger.error('清理同步日志失败:', error);
    res.status(500).json({
      success: false,
      message: '清理同步日志失败'
    });
  }
}));

module.exports = router;
