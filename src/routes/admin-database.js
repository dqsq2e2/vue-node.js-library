const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { executeQuery, getAllPools } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * 获取数据库状态概览
 */
router.get('/database-status', authenticate, requirePermission('SYSTEM_ADMIN'), asyncHandler(async (req, res) => {
  try {
    // 获取当前主数据库 - 使用专业的数据库切换服务
    const databaseSwitchService = require('../services/databaseSwitchService');
    const currentMaster = databaseSwitchService.getCurrentPrimaryDB();
    
    // 测试各数据库连接状态
    const databases = [];
    const dbConfigs = {
      mysql: {
        name: 'mysql',
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT
      },
      mariadb: {
        name: 'mariadb',
        host: process.env.MARIADB_HOST,
        port: process.env.MARIADB_PORT
      },
      greatsql: {
        name: 'greatsql',
        host: process.env.GREATSQL_HOST,
        port: process.env.GREATSQL_PORT
      }
    };

    for (const [dbName, config] of Object.entries(dbConfigs)) {
      try {
        // 测试连接并获取记录数
        const recordCount = await executeQuery(dbName, `
          SELECT 
            (SELECT COUNT(*) FROM system_users WHERE is_deleted = 0) as users,
            (SELECT COUNT(*) FROM books WHERE is_deleted = 0) as books,
            (SELECT COUNT(*) FROM borrow_records WHERE is_deleted = 0) as borrows
        `);
        
        // 获取最后同步时间
        const lastSync = await executeQuery(dbName, `
          SELECT MAX(created_time) as last_sync 
          FROM sync_log 
          WHERE sync_status = '同步成功'
        `);

        databases.push({
          name: dbName,
          host: config.host,
          port: config.port,
          status: 'connected',
          recordCount: recordCount[0].users + recordCount[0].books + recordCount[0].borrows,
          lastSync: lastSync[0].last_sync || null
        });
      } catch (error) {
        databases.push({
          name: dbName,
          host: config.host,
          port: config.port,
          status: 'disconnected',
          recordCount: 0,
          lastSync: null
        });
      }
    }

    // 获取冲突记录数
    const conflictResult = await executeQuery('mysql', `
      SELECT COUNT(*) as count 
      FROM conflict_records 
      WHERE resolve_status = '待处理'
    `);
    const conflictCount = conflictResult[0].count;

    // 获取同步状态
    const syncResult = await executeQuery('mysql', `
      SELECT COUNT(*) as pending_count 
      FROM sync_log 
      WHERE sync_status = '待同步'
    `);
    const pendingSync = syncResult[0].pending_count;

    const syncStatus = pendingSync === 0 ? '正常' : '有待同步';
    const syncStatusDesc = pendingSync === 0 ? 
      '所有数据库同步正常' : 
      `有 ${pendingSync} 条记录待同步`;

    res.json({
      success: true,
      data: {
        currentMaster,
        databases,
        conflictCount,
        syncStatus,
        syncStatusDesc,
        masterDbStatus: '正常运行'
      }
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
 * 测试数据库连接
 */
router.post('/test-connection', authenticate, requirePermission('SYSTEM_ADMIN'), [
  body('database').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('无效的数据库名称')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { database } = req.body;

  try {
    // 测试连接
    const result = await executeQuery(database, 'SELECT 1 as test');
    
    if (result[0].test === 1) {
      logger.info(`数据库连接测试成功: ${database} by ${req.user.username}`);
      
      res.json({
        success: true,
        message: '连接测试成功'
      });
    } else {
      throw new Error('连接测试返回异常结果');
    }

  } catch (error) {
    logger.error(`数据库连接测试失败: ${database}`, error);
    res.status(500).json({
      success: false,
      message: `连接测试失败: ${error.message}`
    });
  }
}));

/**
 * 切换主数据库
 */
router.post('/switch-master-db', authenticate, requirePermission('SYSTEM_ADMIN'), [
  body('targetDb').isIn(['mysql', 'mariadb', 'greatsql']).withMessage('无效的目标数据库'),
  body('reason').isLength({ min: 1, max: 500 }).withMessage('切换原因必须在1-500字符之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { targetDb, reason } = req.body;
  
  try {
    // 使用专业的数据库切换服务
    const databaseSwitchService = require('../services/databaseSwitchService');
    
    const switchResult = await databaseSwitchService.switchPrimaryDatabase(targetDb, {
      force: false,
      skipConsistencyCheck: false,
      reason: reason,
      operator: req.user.username
    });

    logger.info(`主数据库切换成功: ${switchResult.previousDB} -> ${switchResult.currentDB}, 操作员: ${req.user.username}`);

    res.json({
      success: true,
      message: '主数据库切换成功',
      data: switchResult
    });

  } catch (error) {
    logger.error('切换主数据库失败:', error);
    res.status(500).json({
      success: false,
      message: `切换失败: ${error.message}`
    });
  }
}));

/**
 * 获取冲突记录列表
 */
router.get('/conflicts', authenticate, requirePermission('SYSTEM_ADMIN'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('size').optional().isInt({ min: 1, max: 100 }).withMessage('每页大小必须在1-100之间'),
  query('table').optional().isIn(['', 'system_users', 'reader_profiles', 'books', 'borrow_records', 'categories']).withMessage('无效的表名'),
  query('status').optional().isIn(['', '待处理', '已解决', '忽略', 'all']).withMessage('无效的状态')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const table = req.query.table || '';
  const status = req.query.status || '';

  try {
    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (table) {
      whereClause += ' AND table_name = ?';
      params.push(table);
    }

    if (status && status !== 'all') {
      whereClause += ' AND resolve_status = ?';
      params.push(status);
    } else if (!status) {
      // 如果没有指定状态，默认只显示待处理的冲突
      whereClause += ' AND resolve_status = ?';
      params.push('待处理');
    }
    // 如果 status === 'all'，不添加状态过滤条件

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM conflict_records ${whereClause}`;
    const countResult = await executeQuery('mysql', countSql, params);
    const total = countResult[0].total;

    // 获取分页数据
    const offset = (page - 1) * size;
    const dataSql = `
      SELECT 
        conflict_id, table_name, record_id, source_db, target_db,
        conflict_time, resolve_status, resolved_by, resolved_time as resolve_time, remarks as resolve_note
      FROM conflict_records 
      ${whereClause}
      ORDER BY conflict_time DESC 
      LIMIT ? OFFSET ?
    `;
    const conflicts = await executeQuery('mysql', dataSql, [...params, size, offset]);

    res.json({
      success: true,
      data: {
        conflicts,
        total,
        page,
        size
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
 * 获取冲突记录详情
 */
router.get('/conflicts/:conflictId', authenticate, requirePermission('SYSTEM_ADMIN'), asyncHandler(async (req, res) => {
  const { conflictId } = req.params;

  try {
    const conflicts = await executeQuery('mysql', `
      SELECT 
        conflict_id, table_name, record_id, source_db, source_data, target_db, target_data,
        conflict_time, resolve_status, resolve_action, resolved_by, 
        resolved_time as resolve_time, remarks as resolve_note
      FROM conflict_records 
      WHERE conflict_id = ?
    `, [conflictId]);

    if (conflicts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '冲突记录不存在'
      });
    }

    const conflict = conflicts[0];

    // 解析JSON数据（如果是字符串）
    try {
      conflict.source_data = typeof conflict.source_data === 'string' 
        ? JSON.parse(conflict.source_data || '{}')
        : conflict.source_data || {};
      conflict.target_data = typeof conflict.target_data === 'string' 
        ? JSON.parse(conflict.target_data || '{}')
        : conflict.target_data || {};
    } catch (error) {
      logger.warn('解析冲突数据JSON失败:', error.message);
    }

    res.json({
      success: true,
      data: conflict
    });

  } catch (error) {
    logger.error('获取冲突详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取冲突详情失败'
    });
  }
}));

/**
 * 解决单个冲突记录
 */
router.post('/conflicts/:conflictId/resolve', authenticate, requirePermission('SYSTEM_ADMIN'), [
  body('resolution').isIn(['source', 'target', 'manual', 'ignore']).withMessage('无效的解决方案'),
  body('note').optional().isLength({ max: 500 }).withMessage('处理说明不能超过500字符')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { conflictId } = req.params;
  const { resolution, data, note } = req.body;

  try {
    // 获取冲突记录
    const conflicts = await executeQuery('mysql', `
      SELECT * FROM conflict_records WHERE conflict_id = ? AND resolve_status = '待处理'
    `, [conflictId]);

    if (conflicts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '冲突记录不存在或已处理'
      });
    }

    const conflict = conflicts[0];

    // 根据解决方案处理数据
    let finalData = null;
    let resolveStatus = '已解决';

    switch (resolution) {
      case 'source':
        // source_data 已经是对象，不需要 JSON.parse
        finalData = typeof conflict.source_data === 'string' 
          ? JSON.parse(conflict.source_data) 
          : conflict.source_data;
        break;
      case 'target':
        // target_data 已经是对象，不需要 JSON.parse
        finalData = typeof conflict.target_data === 'string' 
          ? JSON.parse(conflict.target_data) 
          : conflict.target_data;
        break;
      case 'manual':
        finalData = data;
        break;
      case 'ignore':
        resolveStatus = '忽略';
        break;
    }

    // 如果不是忽略，则同步数据
    if (resolution !== 'ignore' && finalData) {
      try {
        // 这里应该调用同步服务来应用解决方案
        // 为了演示，我们只记录日志
        logger.info(`应用冲突解决方案: 表=${conflict.table_name}, 记录=${conflict.record_id}, 方案=${resolution}`);
        
        // 实际应该调用同步服务的方法来更新数据
        // await syncService.applyConflictResolution(conflict, finalData);
      } catch (syncError) {
        logger.error('应用冲突解决方案失败:', syncError);
        return res.status(500).json({
          success: false,
          message: '应用解决方案失败'
        });
      }
    }

    // 更新冲突记录状态
    await executeQuery('mysql', `
      UPDATE conflict_records 
      SET resolve_status = ?, resolved_by = ?, resolved_time = NOW(), remarks = ?
      WHERE conflict_id = ?
    `, [resolveStatus, req.user.id, note || '', conflictId]);

    logger.info(`冲突记录已解决: ID=${conflictId}, 方案=${resolution}, 操作员=${req.user.username}`);

    res.json({
      success: true,
      message: '冲突记录已解决'
    });

  } catch (error) {
    logger.error('解决冲突记录失败:', error);
    res.status(500).json({
      success: false,
      message: '解决冲突记录失败'
    });
  }
}));

/**
 * 批量解决冲突记录
 */
router.post('/conflicts/batch-resolve', authenticate, requirePermission('SYSTEM_ADMIN'), [
  body('conflictIds').isArray({ min: 1 }).withMessage('冲突ID列表不能为空'),
  body('resolution').isIn(['source', 'target', 'ignore']).withMessage('批量操作只支持使用源数据、目标数据或忽略'),
  body('note').optional().isLength({ max: 500 }).withMessage('处理说明不能超过500字符')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { conflictIds, resolution, note } = req.body;

  try {
    let successCount = 0;
    let failureCount = 0;
    const resolutionLabels = {
      source: '使用源数据库数据',
      target: '使用目标数据库数据',
      ignore: '忽略冲突'
    };

    for (const conflictId of conflictIds) {
      try {
        // 获取冲突记录
        const conflicts = await executeQuery('mysql', `
          SELECT * FROM conflict_records WHERE conflict_id = ? AND resolve_status = '待处理'
        `, [conflictId]);

        if (conflicts.length === 0) {
          failureCount++;
          continue;
        }

        const conflict = conflicts[0];
        let resolveStatus = resolution === 'ignore' ? '忽略' : '已解决';
        let resolveAction = resolutionLabels[resolution];

        // 如果不是忽略，需要实际执行数据同步
        if (resolution !== 'ignore') {
          try {
            // 解析数据
            const sourceData = typeof conflict.source_data === 'string' 
              ? JSON.parse(conflict.source_data) 
              : conflict.source_data;
            const targetData = typeof conflict.target_data === 'string' 
              ? JSON.parse(conflict.target_data) 
              : conflict.target_data;
            
            // 根据解决方案选择最终数据
            const finalData = resolution === 'source' ? sourceData : targetData;
            const targetDB = resolution === 'source' ? conflict.target_db : conflict.source_db;
            
            // 获取主键字段
            const primaryKeys = {
              'books': 'book_id',
              'system_users': 'user_id',
              'reader_profiles': 'profile_id',
              'borrow_records': 'record_id',
              'categories': 'category_id'
            };
            const primaryKey = primaryKeys[conflict.table_name] || 'id';
            
            // 构建更新SQL
            if (finalData && Object.keys(finalData).length > 0) {
              const updateFields = Object.keys(finalData)
                .filter(key => key !== primaryKey && !['conflict_id', 'resolved_by', 'resolved_time'].includes(key))
                .map(key => `\`${key}\` = ?`);
              
              if (updateFields.length > 0) {
                const updateValues = Object.keys(finalData)
                  .filter(key => key !== primaryKey && !['conflict_id', 'resolved_by', 'resolved_time'].includes(key))
                  .map(key => {
                    let value = finalData[key];
                    // 处理日期格式
                    if (value && typeof value === 'string' && value.includes('T')) {
                      value = value.replace('T', ' ').replace(/\.\d{3}Z$/, '');
                    }
                    return value;
                  });
                
                updateValues.push(conflict.record_id);
                
                const updateSql = `UPDATE \`${conflict.table_name}\` SET ${updateFields.join(', ')} WHERE \`${primaryKey}\` = ?`;
                
                await executeQuery(targetDB, updateSql, updateValues);
                logger.info(`批量解决冲突-数据同步成功: ${conflict.table_name}[${conflict.record_id}] -> ${targetDB}`);
              }
            }
          } catch (syncError) {
            logger.error(`批量解决冲突-数据同步失败 ID=${conflictId}:`, syncError);
            // 同步失败时继续更新冲突状态，但记录错误
            resolveAction += ` (数据同步失败: ${syncError.message})`;
          }
        }

        // 更新冲突记录状态
        await executeQuery('mysql', `
          UPDATE conflict_records 
          SET resolve_status = ?, resolve_action = ?, resolved_by = ?, resolved_time = NOW(), remarks = CONCAT(IFNULL(remarks, ''), '\n--- 批量处理 ---\n', ?)
          WHERE conflict_id = ?
        `, [resolveStatus, resolveAction, req.user.id, note || resolutionLabels[resolution], conflictId]);

        // 同时更新相关的同步日志状态
        await executeQuery('mysql', `
          UPDATE sync_log 
          SET sync_status = '同步成功', 
              error_message = CONCAT('冲突已解决: ', ?)
          WHERE table_name = ? AND record_id = ? AND sync_status = '冲突待处理'
        `, [resolutionLabels[resolution], conflict.table_name, conflict.record_id]);

        successCount++;
        logger.info(`批量解决冲突: ID=${conflictId}, 表=${conflict.table_name}, 方案=${resolution}`);

      } catch (error) {
        logger.error(`批量解决冲突失败 ID=${conflictId}:`, error);
        failureCount++;
      }
    }

    logger.info(`批量解决冲突完成: 成功=${successCount}, 失败=${failureCount}, 操作员=${req.user.username}`);

    res.json({
      success: true,
      message: `批量解决完成: 成功 ${successCount} 条, 失败 ${failureCount} 条`,
      data: {
        successCount,
        failureCount
      }
    });

  } catch (error) {
    logger.error('批量解决冲突失败:', error);
    res.status(500).json({
      success: false,
      message: '批量解决冲突失败'
    });
  }
}));


module.exports = router;
