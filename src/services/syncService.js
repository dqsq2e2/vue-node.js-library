const cron = require('cron');
const { getAllPools, executeQuery, executeTransaction } = require('../config/database');
const logger = require('../utils/logger').syncLogger;
const { ConflictError } = require('../middleware/errorHandler');
const emailService = require('./emailService');

class DatabaseSyncService {
  constructor() {
    this.isRunning = false;
    this.syncJob = null;
    this.io = null;
    this.batchSize = parseInt(process.env.SYNC_BATCH_SIZE) || 100;
    this.retryCount = parseInt(process.env.SYNC_RETRY_COUNT) || 3;
    this.syncTables = ['system_users', 'categories', 'reader_profiles', 'books', 'borrow_records'];
    this.excludeFields = ['password_enc']; // 移除password，允许同步密码字段
    this.primaryDB = null; // 缓存主数据库
    this.lastPrimaryDBCheck = null; // 上次检查时间
  }

  /**
   * 获取当前主数据库
   */
  async getPrimaryDatabase() {
    try {
      // 缓存5分钟，避免频繁查询
      const now = Date.now();
      if (this.primaryDB && this.lastPrimaryDBCheck && (now - this.lastPrimaryDBCheck < 300000)) {
        logger.debug(`使用缓存的主数据库: ${this.primaryDB}`);
        return this.primaryDB;
      }

      logger.debug('开始查询主数据库配置...');
      
      // 从所有数据库中查找主库
      // 注意：必须直接访问连接池，不能使用 executeQuery，否则会被重定向
      const { getAllPools } = require('../config/database');
      const pools = getAllPools();
      const databases = ['mysql', 'mariadb', 'greatsql'];
      
      for (const db of databases) {
        try {
          logger.debug(`检查 ${db} 是否为主库...`);
          
          const pool = pools[db];
          if (!pool) {
            logger.debug(`${db} 连接池不存在`);
            continue;
          }
          
          // 直接使用连接池查询，避免被 executeQuery 重定向
          const [result] = await pool.query(`
            SELECT config_value 
            FROM sync_config 
            WHERE config_key = 'is_master_database'
            LIMIT 1
          `);
          
          logger.debug(`${db} 查询结果: ${JSON.stringify(result)}`);
          
          if (Array.isArray(result) && result.length > 0 && result[0].config_value === 'true') {
            this.primaryDB = db;
            this.lastPrimaryDBCheck = now;
            logger.info(`✅ 当前主数据库: ${db}`);
            return db;
          } else if (Array.isArray(result) && result.length > 0) {
            logger.debug(`${db} 的 is_master_database = '${result[0].config_value}' (不是主库)`);
          } else {
            logger.debug(`${db} 没有 is_master_database 配置或查询结果为空`);
          }
        } catch (error) {
          logger.warn(`检查 ${db} 是否为主库失败: ${error.message}`);
        }
      }
      
      // 如果都找不到，默认使用 mysql（向后兼容）
      logger.warn('⚠️  未找到主数据库配置，使用默认值: mysql');
      this.primaryDB = 'mysql';
      this.lastPrimaryDBCheck = now;
      return 'mysql';
      
    } catch (error) {
      logger.error('❌ 获取主数据库失败:', error);
      return this.primaryDB || 'mysql'; // 返回缓存值或默认值
    }
  }

  /**
   * 清除主数据库缓存（在切换主数据库后调用）
   */
  clearPrimaryDBCache() {
    this.primaryDB = null;
    this.lastPrimaryDBCheck = null;
    logger.info('主数据库缓存已清除');
  }

  /**
   * 启动同步服务
   */
  start(io) {
    this.io = io;
    
    if (process.env.SYNC_ENABLED !== 'true') {
      logger.info('数据同步服务已禁用');
      return;
    }

    const interval = parseInt(process.env.SYNC_INTERVAL) || 60000;
    
    // 创建定时任务 - 每1分钟执行一次
    this.syncJob = new cron.CronJob('*/1 * * * *', () => {
      this.processSync();
    }, null, true, 'Asia/Shanghai');

    // 立即执行一次同步
    setTimeout(() => {
      this.processSync();
    }, 5000);

    logger.info(`数据同步服务已启动，间隔: ${interval}ms`);
  }

  /**
   * 停止同步服务
   */
  stop() {
    if (this.syncJob) {
      this.syncJob.stop();
      this.syncJob = null;
    }
    this.isRunning = false;
    logger.info('数据同步服务已停止');
  }

  /**
   * 处理同步任务
   */
  async processSync() {
    if (this.isRunning) {
      logger.debug('同步任务正在运行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('开始执行数据同步任务');
      
      // 获取待同步的日志
      const pendingLogs = await this.getPendingSyncLogs();
      
      if (pendingLogs.length === 0) {
        logger.debug('没有待同步的数据');
        return;
      }

      logger.info(`发现 ${pendingLogs.length} 条待同步记录`);

      let successCount = 0;
      let failureCount = 0;

      // 处理每条同步日志
      for (const log of pendingLogs) {
        try {
          await this.updateSyncStatus(log.log_id, '同步中');
          
          const result = await this.syncRecordToTargetDBs(log);
          
          if (result.success) {
            await this.updateSyncStatus(log.log_id, '同步成功');
            successCount++;
          } else if (result.hasConflict) {
            // 冲突已在 syncRecordToTargetDBs 中标记为 '冲突待处理'，不要覆盖状态
            failureCount++;
          } else {
            await this.updateSyncStatus(log.log_id, '同步失败');
            failureCount++;
          }
        } catch (error) {
          logger.error(`同步记录失败 [log_id: ${log.log_id}]:`, error);
          await this.handleSyncError(log, error);
          failureCount++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`同步任务完成: 成功 ${successCount}, 失败 ${failureCount}, 耗时 ${duration}ms`);

      // 通过WebSocket通知前端
      if (this.io) {
        this.io.emit('sync_status', {
          type: 'batch_complete',
          success: successCount,
          failure: failureCount,
          duration
        });
      }

    } catch (error) {
      // 对于数据库表不存在等初始化问题，使用warn级别
      if (error.message.includes("doesn't exist") || error.message.includes("Table") || error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn('同步任务跳过 - 数据库表未初始化:', error.message);
      } else {
        logger.error('同步任务执行失败:', error);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 获取待同步的日志
   */
  async getPendingSyncLogs() {
    try {
      const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
      
      const sql = `
        SELECT log_id, table_name, record_id, operation, change_data, source_db, retry_count
        FROM sync_log 
        WHERE sync_status IN ('待同步', '同步失败') 
        AND retry_count < ?
        ORDER BY change_time ASC 
        LIMIT ?
      `;
      
      // 注意：排除 '冲突待处理' 状态的记录，这些记录需要人工处理，不应该自动重试
      
      return await executeQuery(primaryDB, sql, [this.retryCount, this.batchSize]);
    } catch (error) {
      // 如果是表不存在的错误，只记录debug级别日志
      if (error.message.includes("doesn't exist") || error.message.includes("Table") || error.code === 'ER_NO_SUCH_TABLE') {
        logger.debug('同步日志表不存在，跳过同步:', error.message);
      } else {
        logger.warn('获取待同步日志失败:', error.message);
      }
      return [];
    }
  }

  /**
   * 同步记录到目标数据库
   */
  async syncRecordToTargetDBs(log) {
    const targetDBs = this.getTargetDatabases(log.source_db);
    let allSuccess = true;
    const syncedDatabases = [];
    const conflictTargets = []; // 收集冲突的目标数据库
    let hasConflict = false;
    let conflictError = null;

    for (const targetDB of targetDBs) {
      try {
        await this.syncToDatabase(log, targetDB);
        syncedDatabases.push(targetDB);
        
        // 通知前端同步进度
        if (this.io) {
          this.io.emit('sync_progress', {
            log_id: log.log_id,
            table_name: log.table_name,
            target_db: targetDB,
            status: 'success'
          });
        }
        
      } catch (error) {
        allSuccess = false;
        
        if (error instanceof ConflictError) {
          // 记录冲突，但不在循环中处理（避免重复发邮件）
          hasConflict = true;
          conflictError = error;
          conflictTargets.push(targetDB);
          
          // 记录冲突到数据库（但不发邮件）
          await this.recordConflictOnly(log, targetDB, error);
          
          logger.warn(`检测到冲突: ${log.table_name}[${log.record_id}] -> ${targetDB}`);
        } else {
          logger.error(`同步到 ${targetDB} 失败:`, error);
        }
        
        // 通知前端同步失败
        if (this.io) {
          this.io.emit('sync_progress', {
            log_id: log.log_id,
            table_name: log.table_name,
            target_db: targetDB,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    // 如果有冲突，统一处理（只发一次邮件，只标记一次状态）
    if (hasConflict) {
      await this.markSyncConflictStatus(log.log_id, conflictTargets.join(','), 
        `冲突目标: ${conflictTargets.join(', ')}`);
      
      // 发送一次汇总邮件
      await this.sendConflictNotification(log, conflictTargets, conflictError);
    }

    // 更新已同步的数据库列表
    if (syncedDatabases.length > 0) {
      await this.updateSyncedDatabases(log.log_id, syncedDatabases);
    }

    // 如果所有数据库都同步成功，标记为已完成
    if (allSuccess && syncedDatabases.length === targetDBs.length) {
      await this.markSyncCompleted(log.log_id);
    }

    // 返回详细结果
    return {
      success: allSuccess,
      hasConflict: hasConflict,
      syncedCount: syncedDatabases.length,
      conflictCount: conflictTargets.length
    };
  }

  /**
   * 同步到指定数据库
   */
  async syncToDatabase(log, targetDB) {
    // 验证必要的日志数据
    if (!log.record_id || log.record_id === 'null' || log.record_id === 'undefined') {
      logger.warn(`跳过无效的同步记录: ${log.table_name}[${log.record_id}] - record_id 无效`);
      return;
    }

    // change_data字段是JSON类型，MySQL2会自动解析为对象
    let changeData = {};
    try {
      changeData = typeof log.change_data === 'string' ? JSON.parse(log.change_data) : (log.change_data || {});
    } catch (error) {
      logger.warn(`解析 change_data 失败: ${error.message}, 使用空对象`);
      changeData = {};
    }
    
    // 清理和验证同步数据
    const cleanedData = this.cleanSyncData(changeData, log.table_name);
    
    // 对于 INSERT 和 UPDATE 操作，需要从源数据库获取完整数据
    let fullData = cleanedData;
    if (log.operation === 'INSERT' || log.operation === 'UPDATE') {
      try {
        const sourceRecord = await this.getRecord(log.table_name, this.getPrimaryKey(log.table_name), log.record_id, log.source_db);
        if (sourceRecord) {
          // 合并源数据和变更数据，优先使用源数据库的完整数据
          fullData = { ...sourceRecord, ...cleanedData };
          // 清理系统字段
          fullData = this.cleanSyncData(fullData, log.table_name);
        } else {
          logger.warn(`无法从源数据库获取记录: ${log.table_name}[${log.record_id}] from ${log.source_db}`);
          if (Object.keys(cleanedData).length === 0) {
            logger.info('清理后无有效数据，无需同步');
            return;
          }
        }
      } catch (error) {
        logger.warn(`获取源记录失败: ${error.message}, 使用变更数据`);
        if (Object.keys(cleanedData).length === 0) {
          logger.info('清理后无有效数据，无需同步');
          return;
        }
      }
    }
    
    // 补充必填字段
    const supplementedData = this.supplementRequiredFields(log.table_name, fullData);
    
    // 设置会话变量，标识这是同步操作，避免触发器创建新的同步记录
    await executeQuery(targetDB, 'SET @sync_in_progress = 1');
    
    try {
      switch (log.operation) {
        case 'INSERT':
          await this.handleInsert(log.table_name, supplementedData, targetDB);
          break;
        case 'UPDATE':
          await this.handleUpdate(log.table_name, log.record_id, supplementedData, targetDB);
          break;
        case 'DELETE':
          await this.handleDelete(log.table_name, log.record_id, targetDB);
          break;
        default:
          throw new Error(`不支持的操作类型: ${log.operation}`);
      }
    } finally {
      // 清除会话变量
      await executeQuery(targetDB, 'SET @sync_in_progress = NULL');
    }
  }

  /**
   * 清理同步数据，移除undefined值和无效字段，但保留必填字段
   */
  cleanSyncData(data, tableName = null) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    // 定义需要排除的系统字段（这些是触发器添加的元数据，不是业务数据）
    const systemFields = ['master_db', 'timestamp', 'primary_key'];
    const allExcludeFields = [...this.excludeFields, ...systemFields];

    // 定义各表的有效字段
    const tableFields = {
      'system_users': [
        'user_id', 'username', 'password', 'real_name', 'role', 'email', 'phone', 
        'last_login', 'status', 'is_deleted', 'created_time', 'last_updated_time', 
        'sync_version', 'db_source'
      ],
      'reader_profiles': [
        'profile_id', 'user_id', 'card_number', 'gender', 'department', 
        'membership_type', 'register_date', 'expire_date', 'max_borrow',
        'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'
      ],
      'books': [
        'book_id', 'title', 'author', 'isbn', 'publisher', 'publish_date', 
        'category_id', 'location', 'status', 'description', 'cover_image',
        'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'
      ],
      'categories': [
        'category_id', 'category_name', 'description', 'parent_id', 'sort_order',
        'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'
      ],
      'borrow_records': [
        'record_id', 'reader_id', 'book_id', 'borrow_date', 'due_date', 
        'return_date', 'renew_count', 'status', 'fine_amount', 'operator_id',
        'is_deleted', 'created_time', 'last_updated_time', 'sync_version', 'db_source'
      ]
    };

    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      // 保留所有非undefined值，排除系统字段和敏感字段
      if (value !== undefined && !allExcludeFields.includes(key)) {
        // 如果指定了表名，只保留该表的有效字段
        if (tableName && tableFields[tableName]) {
          if (tableFields[tableName].includes(key)) {
            // 处理日期字段格式转换
            cleaned[key] = this.formatDateField(key, value, tableName);
          }
        } else {
          // 如果没有指定表名，保留所有非排除字段
          cleaned[key] = this.formatDateField(key, value, tableName);
        }
      }
    }

    return cleaned;
  }

  /**
   * 格式化日期字段
   */
  formatDateField(fieldName, value, tableName) {
    // 定义需要格式化的日期字段
    const dateFields = {
      'reader_profiles': ['register_date', 'expire_date'],
      'system_users': ['last_login'],
      'borrow_records': ['borrow_date', 'due_date', 'return_date'],
      'books': ['publish_date']
    };

    // 定义时间戳字段（需要转换为 DATETIME 格式）
    const timestampFields = ['created_time', 'last_updated_time', 'change_time'];

    // 检查是否是日期字段
    const isDateField = tableName && dateFields[tableName] && dateFields[tableName].includes(fieldName);
    const isTimestampField = timestampFields.includes(fieldName);
    
    if ((isDateField || isTimestampField) && value) {
      try {
        // 如果值包含时间信息（ISO格式），需要转换
        if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            if (isDateField) {
              // 日期字段转换为 YYYY-MM-DD 格式
              return date.toISOString().split('T')[0];
            } else if (isTimestampField) {
              // 时间戳字段转换为 YYYY-MM-DD HH:mm:ss 格式
              return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
            }
          }
        }
        // 如果已经是正确格式或者不是ISO格式，直接返回
        return value;
      } catch (error) {
        logger.warn(`日期格式转换失败: ${fieldName} = ${value}, 错误: ${error.message}`);
        return value;
      }
    }
    
    return value;
  }

  /**
   * 补充缺失的必填字段
   */
  supplementRequiredFields(tableName, data) {
    const supplemented = { ...data };
    
    switch (tableName) {
      case 'books':
        // 补充books表必填字段
        if (!supplemented.isbn) {
          // 生成符合长度限制的ISBN (最大20字符)
          const timestamp = Date.now().toString().slice(-8); // 取时间戳后8位
          const random = Math.random().toString(36).substr(2, 6); // 6位随机字符
          supplemented.isbn = `AUTO${timestamp}${random}`; // 总长度: 4+8+6=18字符
        }
        if (!supplemented.status) {
          supplemented.status = '在库';
        }
        if (!supplemented.category_id) {
          supplemented.category_id = 1; // 默认使用第一个分类（文学）
        }
        break;
        
      case 'reader_profiles':
        // 补充reader_profiles表必填字段
        if (!supplemented.register_date) {
          supplemented.register_date = new Date().toISOString().split('T')[0];
        }
        if (!supplemented.expire_date) {
          // 默认1年后过期
          const expireDate = new Date();
          expireDate.setFullYear(expireDate.getFullYear() + 1);
          supplemented.expire_date = expireDate.toISOString().split('T')[0];
        }
        if (!supplemented.membership_type) {
          supplemented.membership_type = '普通'; // 使用数据库中定义的枚举值
        }
        if (!supplemented.max_borrow) {
          supplemented.max_borrow = 5;
        }
        // 确保必填字段存在
        if (!supplemented.user_id) {
          // 如果没有user_id，这是一个严重问题，应该跳过
          logger.error('reader_profiles 缺少必填字段 user_id');
          return {};
        }
        if (!supplemented.card_number) {
          // 生成一个临时的卡号
          supplemented.card_number = `TEMP${Date.now()}`;
        }
        break;
        
      case 'system_users':
        // 补充system_users表必填字段
        if (!supplemented.password) {
          // 如果没有密码，使用默认密码的哈希值
          supplemented.password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // 默认密码: password
        }
        if (!supplemented.status) {
          supplemented.status = '激活';
        }
        if (!supplemented.role) {
          supplemented.role = 'reader'; // 默认角色为读者
        }
        break;
    }
    
    return supplemented;
  }

  /**
   * 处理插入操作
   */
  async handleInsert(tableName, data, targetDB) {
    // 检查记录是否已存在
    const primaryKey = this.getPrimaryKey(tableName);
    const existingRecord = await this.getRecord(tableName, primaryKey, data[primaryKey], targetDB);
    
    if (existingRecord) {
      // 记录已存在，检查是否需要同步
      if (!this.needsSync(existingRecord, data)) {
        logger.debug(`记录已存在且完全一致，跳过同步: ${tableName}[${data[primaryKey]}] -> ${targetDB}`);
        return; // 数据完全一致，无需操作
      }
      
      // 检查数据冲突（增强版，返回冲突详情）
      const conflictInfo = this.hasDataConflict(existingRecord, data, tableName);
      if (conflictInfo) {
        const error = new ConflictError('数据冲突：记录已存在且数据不一致');
        error.conflictInfo = conflictInfo;
        error.targetData = existingRecord;
        throw error;
      }
      
      // 需要更新，转为更新操作
      await this.handleUpdate(tableName, data[primaryKey], data, targetDB);
      return;
    }

    // 构建插入SQL
    const fields = Object.keys(data).filter(field => !this.excludeFields.includes(field));
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(field => data[field]);

    const sql = `INSERT INTO \`${tableName}\` (\`${fields.join('`, `')}\`) VALUES (${placeholders})`;
    
    await executeQuery(targetDB, sql, values);
    logger.debug(`插入记录成功: ${tableName}[${data[primaryKey]}] -> ${targetDB}`);
  }

  /**
   * 处理更新操作
   */
  async handleUpdate(tableName, recordId, data, targetDB) {
    const primaryKey = this.getPrimaryKey(tableName);
    const existingRecord = await this.getRecord(tableName, primaryKey, recordId, targetDB);
    
    if (!existingRecord) {
      // 记录不存在，尝试插入
      await this.handleInsert(tableName, data, targetDB);
      return;
    }

    // 检查是否需要同步
    if (!this.needsSync(existingRecord, data)) {
      logger.debug(`记录已是最新状态，跳过更新: ${tableName}[${recordId}] -> ${targetDB}`);
      return; // 数据完全一致，无需操作
    }

    // 检查数据冲突（增强版，返回冲突详情）
    const conflictInfo = this.hasDataConflict(existingRecord, data, tableName);
    if (conflictInfo) {
      const error = new ConflictError('数据冲突：目标记录已被修改');
      error.conflictInfo = conflictInfo;
      error.targetData = existingRecord;
      throw error;
    }

    // 构建更新SQL
    const fields = Object.keys(data).filter(field => 
      !this.excludeFields.includes(field) && field !== primaryKey
    );
    
    if (fields.length === 0) {
      logger.debug(`没有需要更新的字段: ${tableName}[${recordId}] -> ${targetDB}`);
      return; // 没有需要更新的字段
    }

    const setClause = fields.map(field => `\`${field}\` = ?`).join(', ');
    const values = [...fields.map(field => data[field]), recordId];

    const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`;
    
    await executeQuery(targetDB, sql, values);
    logger.debug(`更新记录成功: ${tableName}[${recordId}] -> ${targetDB}`);
  }

  /**
   * 处理删除操作
   */
  async handleDelete(tableName, recordId, targetDB) {
    const primaryKey = this.getPrimaryKey(tableName);
    
    // 软删除：设置is_deleted=1
    const sql = `UPDATE \`${tableName}\` SET \`is_deleted\` = 1 WHERE \`${primaryKey}\` = ?`;
    
    const result = await executeQuery(targetDB, sql, [recordId]);
    
    if (result.affectedRows === 0) {
      logger.warn(`删除记录失败，记录不存在: ${tableName}[${recordId}] -> ${targetDB}`);
    } else {
      logger.debug(`删除记录成功: ${tableName}[${recordId}] -> ${targetDB}`);
    }
  }

  /**
   * 获取表的主键字段名
   */
  getPrimaryKey(tableName) {
    const primaryKeys = {
      'system_users': 'user_id',
      'categories': 'category_id',
      'reader_profiles': 'profile_id',
      'books': 'book_id',
      'borrow_records': 'record_id'
    };
    
    return primaryKeys[tableName] || 'id';
  }

  /**
   * 获取记录（包括软删除的记录）
   */
  async getRecord(tableName, primaryKey, recordId, dbName) {
    try {
      // 不再过滤is_deleted，获取所有记录包括软删除的
      const sql = `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`;
      const results = await executeQuery(dbName, sql, [recordId]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(`获取记录失败: ${tableName}[${recordId}] from ${dbName}`, error);
      return null;
    }
  }

  /**
   * 检查数据冲突（增强版）
   * @returns {object|false} 返回冲突详情对象或false
   */
  hasDataConflict(existingData, newData, tableName = null) {
    if (!existingData || !newData) {
      return false;
    }

    const conflictInfo = {
      hasConflict: false,
      type: null,           // 冲突类型: 'version', 'concurrent', 'data_mismatch'
      conflictFields: [],   // 冲突的字段列表
      existingVersion: existingData.sync_version,
      newVersion: newData.sync_version,
      existingTime: existingData.last_updated_time,
      newTime: newData.last_updated_time
    };

    // 1. 版本冲突：目标版本更高，说明目标数据库有独立更新
    if (existingData.sync_version && newData.sync_version) {
      if (existingData.sync_version > newData.sync_version) {
        conflictInfo.hasConflict = true;
        conflictInfo.type = 'version';
        logger.warn(`版本冲突: 目标版本(${existingData.sync_version}) > 源版本(${newData.sync_version})`);
      }
    }

    // 2. 时间冲突：目标更新时间更晚
    if (!conflictInfo.hasConflict && existingData.last_updated_time && newData.last_updated_time) {
      const existingTime = new Date(existingData.last_updated_time);
      const newTime = new Date(newData.last_updated_time);
      if (existingTime > newTime) {
        conflictInfo.hasConflict = true;
        conflictInfo.type = 'concurrent';
        logger.warn(`时间冲突: 目标时间(${existingTime.toISOString()}) > 源时间(${newTime.toISOString()})`);
      }
    }

    // 3. 字段级冲突检测：检查核心字段差异
    const coreFields = this.getCoreFields(newData);
    for (const field of coreFields) {
      const existingValue = this.normalizeValue(existingData[field]);
      const newValue = this.normalizeValue(newData[field]);
      
      if (newValue !== undefined && existingValue !== undefined && 
          existingValue !== newValue && existingValue !== null) {
        conflictInfo.conflictFields.push({
          field,
          existingValue,
          newValue
        });
      }
    }

    // 如果有字段差异且目标数据被独立修改过（db_source不同于源数据库）
    if (conflictInfo.conflictFields.length > 0 && 
        existingData.db_source && newData.db_source &&
        existingData.db_source !== newData.db_source) {
      conflictInfo.hasConflict = true;
      conflictInfo.type = conflictInfo.type || 'data_mismatch';
      logger.warn(`数据冲突: ${conflictInfo.conflictFields.length} 个字段不一致`);
    }

    return conflictInfo.hasConflict ? conflictInfo : false;
  }

  /**
   * 标准化值用于比较
   */
  normalizeValue(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return value.split('T')[0]; // 日期只比较日期部分
    }
    return value;
  }

  /**
   * 检查记录是否需要同步（包含完整数据比较）
   */
  needsSync(existingData, newData, tableName = null) {
    // 如果记录不存在，需要同步
    if (!existingData) {
      logger.debug('记录不存在，需要同步');
      return true;
    }

    // 清理新数据，移除undefined值
    const cleanedNewData = this.cleanSyncData(newData, tableName);
    
    // 如果清理后没有有效数据，认为不需要同步
    if (!cleanedNewData || Object.keys(cleanedNewData).length === 0) {
      logger.info('清理后无有效数据，无需同步');
      return false;
    }

    // 定义需要比较的核心字段（只比较新数据中存在的字段）
    const coreFields = this.getCoreFields(cleanedNewData);
    logger.debug(`核心字段: ${coreFields.join(', ')}`);
    
    // 比较核心业务数据
    for (const field of coreFields) {
      const existingValue = existingData[field];
      const newValue = cleanedNewData[field];
      
      // 只有当新数据中有值且与现有值不同时才认为不一致
      if (newValue !== undefined && existingValue !== newValue) {
        logger.debug(`核心字段 ${field} 不一致: ${existingValue} vs ${newValue}`);
        return true; // 核心数据不一致，需要同步
      }
    }

    logger.debug('核心数据一致，无需同步');
    return false; // 核心数据一致，无需同步
  }

  /**
   * 获取核心业务字段
   */
  getCoreFields(data) {
    const timestampFields = ['created_at', 'updated_at', 'last_updated_time', 'created_time'];
    const systemFields = ['sync_version', 'sync_status', 'last_sync_time'];
    const excludeFields = [...this.excludeFields, ...timestampFields, ...systemFields];
    
    return Object.keys(data).filter(field => !excludeFields.includes(field));
  }

  /**
   * 判断是否为时间戳字段
   */
  isTimestampField(fieldName) {
    const timestampFields = ['created_at', 'updated_at', 'last_updated_time', 'created_time'];
    return timestampFields.includes(fieldName);
  }

  /**
   * 获取冲突类型描述
   */
  getConflictTypeDesc(type) {
    const typeMap = {
      'version': '版本冲突 - 目标数据库版本更高',
      'concurrent': '并发冲突 - 目标数据库更新时间更晚',
      'data_mismatch': '数据不一致 - 多个字段值不同',
      'unknown': '未知冲突类型'
    };
    return typeMap[type] || typeMap['unknown'];
  }

  /**
   * 获取目标数据库列表
   */
  getTargetDatabases(sourceDB) {
    const allDBs = ['mysql', 'mariadb', 'greatsql'];
    return allDBs.filter(db => db !== sourceDB);
  }

  /**
   * 更新同步状态
   */
  async updateSyncStatus(logId, status, errorMessage = null) {
    try {
      const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
      
      let sql, params;
      
      if (status === '同步失败') {
        // 只有失败时才增加重试次数
        sql = `
          UPDATE sync_log 
          SET sync_status = ?, 
              retry_count = retry_count + 1,
              last_retry_time = CURRENT_TIMESTAMP,
              error_message = ?
          WHERE log_id = ?
        `;
        params = [status, errorMessage, logId];
      } else {
        // 其他状态（同步中、同步成功）不增加重试次数
        sql = `
          UPDATE sync_log 
          SET sync_status = ?, 
              last_retry_time = CURRENT_TIMESTAMP,
              error_message = ?
          WHERE log_id = ?
        `;
        params = [status, errorMessage, logId];
      }
      
      await executeQuery(primaryDB, sql, params);
    } catch (error) {
      logger.error(`更新同步状态失败 [log_id: ${logId}]:`, error);
    }
  }

  /**
   * 标记同步日志为已完成（避免重复处理）
   */
  async markSyncCompleted(logId) {
    try {
      const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
      
      const sql = `
        UPDATE sync_log 
        SET sync_status = '同步成功',
            synced_databases = JSON_ARRAY('mysql', 'mariadb', 'greatsql'),
            last_retry_time = CURRENT_TIMESTAMP,
            error_message = NULL
        WHERE log_id = ?
      `;
      
      await executeQuery(primaryDB, sql, [logId]);
      logger.debug(`标记同步日志为已完成: ${logId}`);
    } catch (error) {
      logger.error(`标记同步完成失败 [log_id: ${logId}]:`, error);
    }
  }

  /**
   * 更新已同步的数据库列表
   */
  async updateSyncedDatabases(logId, syncedDatabases) {
    try {
      const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
      
      const sql = `
        UPDATE sync_log 
        SET synced_databases = ?
        WHERE log_id = ?
      `;
      
      await executeQuery(primaryDB, sql, [JSON.stringify(syncedDatabases), logId]);
    } catch (error) {
      logger.error(`更新已同步数据库列表失败 [log_id: ${logId}]:`, error);
    }
  }

  /**
   * 处理同步错误
   */
  async handleSyncError(log, error) {
    const errorMessage = error.message || '未知错误';
    
    try {
      await this.updateSyncStatus(log.log_id, '同步失败', errorMessage);
      
      // 如果重试次数达到上限，记录到错误日志
      if (log.retry_count >= this.retryCount - 1) {
        logger.error(`同步记录最终失败 [log_id: ${log.log_id}]: ${errorMessage}`);
        
        // 通知管理员
        if (this.io) {
          this.io.emit('sync_error', {
            log_id: log.log_id,
            table_name: log.table_name,
            record_id: log.record_id,
            error: errorMessage,
            retry_count: log.retry_count
          });
        }
      }
    } catch (updateError) {
      logger.error('更新错误状态失败:', updateError);
    }
  }

  /**
   * 只记录冲突到数据库（不发邮件）
   */
  async recordConflictOnly(log, targetDB, error) {
    try {
      const conflictInfo = error.conflictInfo || {};
      const conflictType = conflictInfo.type || 'unknown';
      const conflictFields = conflictInfo.conflictFields || [];
      
      // 构建详细的冲突描述
      let remarks = `冲突类型: ${this.getConflictTypeDesc(conflictType)}`;
      if (conflictFields.length > 0) {
        remarks += `\n冲突字段:\n`;
        conflictFields.forEach(f => {
          remarks += `  - ${f.field}: 目标值="${f.existingValue}" vs 源值="${f.newValue}"\n`;
        });
      }
      if (conflictInfo.existingVersion || conflictInfo.newVersion) {
        remarks += `\n版本: 目标=${conflictInfo.existingVersion}, 源=${conflictInfo.newVersion}`;
      }

      const conflictData = {
        table_name: log.table_name,
        record_id: log.record_id,
        source_db: log.source_db,
        source_data: typeof log.change_data === 'string' ? log.change_data : JSON.stringify(log.change_data || {}),
        target_db: targetDB,
        target_data: JSON.stringify(error.targetData || {}),
        conflict_time: new Date(),
        resolve_status: '待处理',
        remarks: remarks
      };

      const sql = `
        INSERT INTO conflict_records 
        (table_name, record_id, source_db, source_data, target_db, target_data, resolve_status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const primaryDB = await this.getPrimaryDatabase();
      
      await executeQuery(primaryDB, sql, [
        conflictData.table_name,
        conflictData.record_id,
        conflictData.source_db,
        conflictData.source_data,
        conflictData.target_db,
        conflictData.target_data,
        conflictData.resolve_status,
        conflictData.remarks
      ]);

      logger.warn(`记录数据冲突: ${log.table_name}[${log.record_id}] ${log.source_db} -> ${targetDB} (${conflictType})`);

      // 通知前端有新的冲突
      if (this.io) {
        this.io.emit('conflict_detected', conflictData);
      }
    } catch (insertError) {
      logger.error('记录冲突信息失败:', insertError);
    }
  }

  /**
   * 发送冲突通知邮件（汇总）
   */
  async sendConflictNotification(log, conflictTargets, error) {
    try {
      const primaryDB = await this.getPrimaryDatabase();
      
      // 查询所有管理员的邮箱
      const adminEmailsSql = `
        SELECT email, real_name 
        FROM system_users 
        WHERE role = 'admin' 
          AND email IS NOT NULL 
          AND email != ''
          AND is_deleted = 0
      `;
      const admins = await executeQuery(primaryDB, adminEmailsSql);
      
      if (admins.length > 0) {
        let successCount = 0;
        let failCount = 0;
        
        for (const admin of admins) {
          try {
            await emailService.sendSyncConflictNotification(admin.email, {
              tableName: log.table_name,
              recordId: log.record_id.toString(),
              conflictTime: new Date().toLocaleString('zh-CN'),
              conflictType: `${log.source_db} → ${conflictTargets.join(', ')} 数据冲突`
            });
            successCount++;
            logger.info(`冲突通知邮件已发送至管理员: ${admin.real_name} (${admin.email})`);
          } catch (emailError) {
            failCount++;
            logger.error(`发送冲突通知邮件失败: ${admin.email}`, emailError.message);
          }
        }
        
        logger.info(`冲突通知邮件发送完成: 成功 ${successCount}, 失败 ${failCount}`);
      } else {
        logger.warn('没有找到配置了邮箱的管理员，无法发送冲突通知');
      }
    } catch (emailError) {
      logger.error('查询管理员邮箱或发送冲突通知失败:', emailError.message);
    }
  }

  /**
   * 标记同步冲突状态（不再重试）
   */
  async markSyncConflictStatus(logId, targetDB, errorMessage) {
    try {
      const primaryDB = await this.getPrimaryDatabase();
      
      // 将状态设置为特殊的冲突状态，避免重试机制继续处理
      await executeQuery(primaryDB, `
        UPDATE sync_log 
        SET sync_status = '冲突待处理',
            error_message = ?,
            last_retry_time = NOW()
        WHERE log_id = ?
      `, [errorMessage, logId]);
      
      logger.warn(`同步日志 ${logId} 已标记为冲突待处理状态，不再重试`);
      
    } catch (error) {
      logger.error('标记冲突状态失败:', error);
    }
  }

  /**
   * 处理数据冲突（增强版）
   * @param {object} log - 同步日志
   * @param {string} targetDB - 目标数据库
   * @param {object} error - 错误对象，可能包含 conflictInfo
   */
  async handleDataConflict(log, targetDB, error) {
    try {
      // 提取冲突详情（如果有）
      const conflictInfo = error.conflictInfo || {};
      const conflictType = conflictInfo.type || 'unknown';
      const conflictFields = conflictInfo.conflictFields || [];
      
      // 构建详细的冲突描述
      let remarks = `冲突类型: ${this.getConflictTypeDesc(conflictType)}`;
      if (conflictFields.length > 0) {
        remarks += `\n冲突字段:\n`;
        conflictFields.forEach(f => {
          remarks += `  - ${f.field}: 目标值="${f.existingValue}" vs 源值="${f.newValue}"\n`;
        });
      }
      if (conflictInfo.existingVersion || conflictInfo.newVersion) {
        remarks += `\n版本: 目标=${conflictInfo.existingVersion}, 源=${conflictInfo.newVersion}`;
      }

      const conflictData = {
        table_name: log.table_name,
        record_id: log.record_id,
        source_db: log.source_db,
        source_data: typeof log.change_data === 'string' ? log.change_data : JSON.stringify(log.change_data || {}),
        target_db: targetDB,
        target_data: JSON.stringify(error.targetData || {}),
        conflict_time: new Date(),
        resolve_status: '待处理',
        remarks: remarks
      };

      const sql = `
        INSERT INTO conflict_records 
        (table_name, record_id, source_db, source_data, target_db, target_data, resolve_status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const primaryDB = await this.getPrimaryDatabase();
      
      await executeQuery(primaryDB, sql, [
        conflictData.table_name,
        conflictData.record_id,
        conflictData.source_db,
        conflictData.source_data,
        conflictData.target_db,
        conflictData.target_data,
        conflictData.resolve_status,
        conflictData.remarks
      ]);

      logger.warn(`记录数据冲突: ${log.table_name}[${log.record_id}] ${log.source_db} -> ${targetDB} (${conflictType})`);
      if (conflictFields.length > 0) {
        logger.warn(`冲突字段: ${conflictFields.map(f => f.field).join(', ')}`);
      }

      // 通知前端有新的冲突
      if (this.io) {
        this.io.emit('conflict_detected', conflictData);
      }

      // 发送邮件通知所有系统管理员
      try {
        // 查询所有管理员的邮箱
        const adminEmailsSql = `
          SELECT email, real_name 
          FROM system_users 
          WHERE role = 'admin' 
            AND email IS NOT NULL 
            AND email != ''
            AND is_deleted = 0
        `;
        const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
        const admins = await executeQuery(primaryDB, adminEmailsSql);
        
        if (admins.length > 0) {
          let successCount = 0;
          let failCount = 0;
          
          for (const admin of admins) {
            try {
              await emailService.sendSyncConflictNotification(admin.email, {
                tableName: log.table_name,
                recordId: log.record_id.toString(),
                conflictTime: new Date().toLocaleString('zh-CN'),
                conflictType: `${log.source_db} → ${targetDB} 数据冲突`
              });
              successCount++;
              logger.info(`冲突通知邮件已发送至管理员: ${admin.real_name} (${admin.email})`);
            } catch (emailError) {
              failCount++;
              logger.error(`发送冲突通知邮件失败: ${admin.email}`, emailError.message);
            }
          }
          
          logger.info(`冲突通知邮件发送完成: 成功 ${successCount}, 失败 ${failCount}`);
        } else {
          logger.warn('没有找到配置了邮箱的管理员，无法发送冲突通知');
        }
      } catch (emailError) {
        logger.error('查询管理员邮箱或发送冲突通知失败:', emailError.message);
      }

    } catch (insertError) {
      logger.error('记录冲突信息失败:', insertError);
    }
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStats() {
    try {
      const sql = `
        SELECT 
          sync_status,
          COUNT(*) as count,
          DATE(change_time) as date
        FROM sync_log 
        WHERE change_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY sync_status, DATE(change_time)
        ORDER BY date DESC, sync_status
      `;
      
      const primaryDB = await this.getPrimaryDatabase(); // 动态获取主数据库
      return await executeQuery(primaryDB, sql);
    } catch (error) {
      logger.error('获取同步统计失败:', error);
      return [];
    }
  }
}

// 创建单例实例
const syncService = new DatabaseSyncService();

/**
 * 启动同步服务
 */
function startSyncService(io) {
  syncService.start(io);
}

/**
 * 停止同步服务
 */
function stopSyncService() {
  syncService.stop();
}

/**
 * 手动触发同步
 */
async function triggerSync() {
  return await syncService.processSync();
}

/**
 * 获取同步统计
 */
async function getSyncStats() {
  return await syncService.getSyncStats();
}

module.exports = {
  startSyncService,
  stopSyncService,
  triggerSync,
  getSyncStats,
  syncService
};
