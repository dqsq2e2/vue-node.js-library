const { getAllPools, executeQuery, testDatabaseConnections } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class DatabaseSwitchService {
  constructor() {
    this.currentPrimaryDB = 'mysql'; // 默认主数据库
    this.availableDatabases = ['mysql', 'mariadb', 'greatsql'];
    this.switchHistory = [];
    this.configFile = path.join(__dirname, '../config/primary-db-config.json');
    this.initialized = false;
    
    // 异步初始化配置
    this.initializeAsync();
  }

  /**
   * 异步初始化
   */
  async initializeAsync() {
    try {
      await this.loadConfiguration();
      this.initialized = true;
    } catch (error) {
      logger.error('数据库切换服务初始化失败:', error);
      this.initialized = true; // 即使失败也标记为已初始化，使用默认值
    }
  }

  /**
   * 确保服务已初始化
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeAsync();
    }
  }

  /**
   * 加载主数据库配置
   */
  async loadConfiguration() {
    try {
      const configExists = await fs.access(this.configFile).then(() => true).catch(() => false);
      
      if (configExists) {
        const configData = await fs.readFile(this.configFile, 'utf8');
        const config = JSON.parse(configData);
        this.currentPrimaryDB = config.primaryDatabase || 'mysql';
        this.switchHistory = config.switchHistory || [];
        
        logger.info(`加载主数据库配置: ${this.currentPrimaryDB}`);
      } else {
        // 创建默认配置文件
        await this.saveConfiguration();
        logger.info('创建默认主数据库配置文件');
      }
    } catch (error) {
      logger.error('加载主数据库配置失败:', error);
      this.currentPrimaryDB = 'mysql'; // 回退到默认值
    }
  }

  /**
   * 保存主数据库配置
   */
  async saveConfiguration() {
    try {
      const config = {
        primaryDatabase: this.currentPrimaryDB,
        lastSwitchTime: new Date().toISOString(),
        switchHistory: this.switchHistory.slice(-10), // 只保留最近10次切换记录
        availableDatabases: this.availableDatabases
      };

      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf8');
      logger.info('主数据库配置已保存');
    } catch (error) {
      logger.error('保存主数据库配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前主数据库
   */
  getCurrentPrimaryDB() {
    // 如果还没初始化，尝试同步读取配置文件
    if (!this.initialized) {
      try {
        const fs = require('fs');
        if (fs.existsSync(this.configFile)) {
          const configData = fs.readFileSync(this.configFile, 'utf8');
          const config = JSON.parse(configData);
          this.currentPrimaryDB = config.primaryDatabase || 'mysql';
        }
      } catch (error) {
        logger.warn('同步读取配置文件失败，使用默认值:', error.message);
      }
    }
    return this.currentPrimaryDB;
  }

  /**
   * 获取所有可用数据库列表
   */
  getAvailableDatabases() {
    return this.availableDatabases;
  }

  /**
   * 检查数据库健康状态
   */
  async checkDatabaseHealth(dbName = null) {
    try {
      const databasesToCheck = dbName ? [dbName] : this.availableDatabases;
      const healthStatus = {};

      for (const db of databasesToCheck) {
        try {
          // 测试连接
          const connectionResults = await testDatabaseConnections();
          const isConnected = connectionResults[db]?.status === 'connected';

          if (isConnected) {
            // 检查基本查询性能
            const startTime = Date.now();
            await executeQuery(db, 'SELECT 1 as test');
            const responseTime = Date.now() - startTime;

            // 检查关键表是否存在
            const tableCheckSql = `
              SELECT COUNT(*) as table_count 
              FROM information_schema.tables 
              WHERE table_schema = DATABASE() 
              AND table_name IN ('books', 'reader_profiles', 'categories', 'borrow_records', 'system_users')
            `;
            const tableResult = await executeQuery(db, tableCheckSql);
            const hasAllTables = tableResult[0].table_count === 5;

            // 检查数据量
            const dataCheckSql = 'SELECT COUNT(*) as record_count FROM books WHERE is_deleted = 0';
            const dataResult = await executeQuery(db, dataCheckSql);
            const recordCount = dataResult[0].record_count;

            healthStatus[db] = {
              status: 'healthy',
              connected: true,
              responseTime: responseTime,
              hasAllTables: hasAllTables,
              recordCount: recordCount,
              lastChecked: new Date().toISOString()
            };
          } else {
            healthStatus[db] = {
              status: 'unhealthy',
              connected: false,
              error: connectionResults[db]?.error || 'Connection failed',
              lastChecked: new Date().toISOString()
            };
          }
        } catch (error) {
          healthStatus[db] = {
            status: 'error',
            connected: false,
            error: error.message,
            lastChecked: new Date().toISOString()
          };
        }
      }

      return dbName ? healthStatus[dbName] : healthStatus;
    } catch (error) {
      logger.error('数据库健康检查失败:', error);
      throw error;
    }
  }

  /**
   * 验证数据一致性
   */
  async validateDataConsistency(sourceDB, targetDB) {
    try {
      logger.info(`验证数据一致性: ${sourceDB} -> ${targetDB}`);
      
      const tablesToCheck = ['books', 'reader_profiles', 'categories', 'borrow_records', 'system_users'];
      const consistencyReport = {
        consistent: true,
        details: {},
        totalTables: tablesToCheck.length,
        consistentTables: 0
      };

      for (const table of tablesToCheck) {
        try {
          // 检查记录数量
          const countSql = `SELECT COUNT(*) as count FROM ${table} WHERE is_deleted = 0`;
          const sourceCount = await executeQuery(sourceDB, countSql);
          const targetCount = await executeQuery(targetDB, countSql);

          const sourceRecords = sourceCount[0].count;
          const targetRecords = targetCount[0].count;
          const isConsistent = sourceRecords === targetRecords;

          if (isConsistent) {
            consistencyReport.consistentTables++;
          } else {
            consistencyReport.consistent = false;
          }

          consistencyReport.details[table] = {
            consistent: isConsistent,
            sourceRecords: sourceRecords,
            targetRecords: targetRecords,
            difference: sourceRecords - targetRecords
          };

        } catch (error) {
          consistencyReport.consistent = false;
          consistencyReport.details[table] = {
            consistent: false,
            error: error.message
          };
        }
      }

      return consistencyReport;
    } catch (error) {
      logger.error('数据一致性验证失败:', error);
      throw error;
    }
  }

  /**
   * 执行数据库切换
   */
  async switchPrimaryDatabase(targetDB, options = {}) {
    const {
      force = false,
      skipConsistencyCheck = false,
      reason = '手动切换',
      operator = 'system'
    } = options;

    try {
      // 确保服务已初始化
      await this.ensureInitialized();
      
      logger.info(`开始切换主数据库: ${this.currentPrimaryDB} -> ${targetDB}`);

      // 1. 验证目标数据库
      if (!this.availableDatabases.includes(targetDB)) {
        throw new Error(`无效的目标数据库: ${targetDB}`);
      }

      if (targetDB === this.currentPrimaryDB) {
        throw new Error('目标数据库与当前主数据库相同');
      }

      // 2. 检查目标数据库健康状态
      const targetHealth = await this.checkDatabaseHealth(targetDB);
      if (targetHealth.status !== 'healthy' && !force) {
        throw new Error(`目标数据库不健康: ${targetHealth.error || '状态异常'}`);
      }

      // 3. 数据一致性检查
      let consistencyReport = null;
      if (!skipConsistencyCheck) {
        consistencyReport = await this.validateDataConsistency(this.currentPrimaryDB, targetDB);
        if (!consistencyReport.consistent && !force) {
          throw new Error(`数据不一致，无法切换。不一致表数: ${consistencyReport.totalTables - consistencyReport.consistentTables}`);
        }
      }

      // 4. 记录切换历史
      const switchRecord = {
        id: Date.now().toString(),
        fromDB: this.currentPrimaryDB,
        toDB: targetDB,
        timestamp: new Date().toISOString(),
        reason: reason,
        operator: operator,
        force: force,
        skipConsistencyCheck: skipConsistencyCheck,
        consistencyReport: consistencyReport,
        status: 'in_progress'
      };

      this.switchHistory.push(switchRecord);

      // 5. 执行切换
      const previousDB = this.currentPrimaryDB;
      this.currentPrimaryDB = targetDB;

      // 6. 更新数据库配置（智能触发器会自动适应）
      await this.updateDatabaseConfigs(targetDB);

      // 7. 保存配置
      await this.saveConfiguration();

      // 8. 清除同步服务的主数据库缓存
      try {
        const { syncService } = require('./syncService');
        syncService.clearPrimaryDBCache();
        logger.info('已清除同步服务的主数据库缓存');
      } catch (error) {
        logger.warn('清除同步服务缓存失败:', error.message);
      }

      // 9. 更新切换记录状态
      switchRecord.status = 'completed';
      switchRecord.completedAt = new Date().toISOString();

      logger.info(`主数据库切换成功: ${previousDB} -> ${targetDB}`);

      // 8. 返回切换结果
      return {
        success: true,
        previousDB: previousDB,
        currentDB: this.currentPrimaryDB,
        switchId: switchRecord.id,
        consistencyReport: consistencyReport,
        message: `主数据库已从 ${previousDB} 切换到 ${targetDB}`
      };

    } catch (error) {
      // 更新切换记录状态为失败
      if (this.switchHistory.length > 0) {
        const lastRecord = this.switchHistory[this.switchHistory.length - 1];
        if (lastRecord.status === 'in_progress') {
          lastRecord.status = 'failed';
          lastRecord.error = error.message;
          lastRecord.failedAt = new Date().toISOString();
        }
      }

      logger.error(`主数据库切换失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 回滚到上一个数据库
   */
  async rollbackToPreviousDatabase(operator = 'system') {
    try {
      if (this.switchHistory.length === 0) {
        throw new Error('没有可回滚的切换记录');
      }

      // 找到最近一次成功的切换记录
      const lastSuccessfulSwitch = this.switchHistory
        .slice()
        .reverse()
        .find(record => record.status === 'completed');

      if (!lastSuccessfulSwitch) {
        throw new Error('没有找到可回滚的成功切换记录');
      }

      const rollbackTarget = lastSuccessfulSwitch.fromDB;
      
      logger.info(`开始回滚到数据库: ${rollbackTarget}`);

      return await this.switchPrimaryDatabase(rollbackTarget, {
        reason: `回滚到 ${rollbackTarget}`,
        operator: operator,
        force: false
      });

    } catch (error) {
      logger.error(`数据库回滚失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取切换历史
   */
  getSwitchHistory(limit = 10) {
    return this.switchHistory.slice(-limit).reverse();
  }

  /**
   * 获取数据库状态概览
   */
  async getDatabaseOverview() {
    try {
      const healthStatus = await this.checkDatabaseHealth();
      
      return {
        currentPrimaryDB: this.currentPrimaryDB,
        availableDatabases: this.availableDatabases,
        databaseHealth: healthStatus,
        switchHistory: this.getSwitchHistory(5),
        lastSwitchTime: this.switchHistory.length > 0 
          ? this.switchHistory[this.switchHistory.length - 1].timestamp 
          : null
      };
    } catch (error) {
      logger.error('获取数据库概览失败:', error);
      throw error;
    }
  }

  /**
   * 移动触发器到新的主数据库
   */
  async moveTriggers(fromDB, toDB) {
    const { executeQuery } = require('../config/database');
    
    try {
      logger.info(`移动触发器: ${fromDB} -> ${toDB}`);

      // 1. 删除原主数据库的触发器
      const triggersToMove = ['sync_system_users_insert', 'sync_system_users_update', 'sync_system_users_delete'];
      
      for (const triggerName of triggersToMove) {
        try {
          await executeQuery(fromDB, `DROP TRIGGER IF EXISTS ${triggerName}`);
          logger.debug(`删除 ${fromDB} 的触发器: ${triggerName}`);
        } catch (error) {
          logger.warn(`删除触发器失败: ${triggerName} from ${fromDB}`, error);
        }
      }

      // 2. 在新主数据库创建触发器
      // INSERT触发器
      await executeQuery(toDB, `
        CREATE TRIGGER sync_system_users_insert
        AFTER INSERT ON system_users
        FOR EACH ROW
        BEGIN
          IF @sync_in_progress IS NULL THEN
            INSERT INTO sync_log (
              table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
              'system_users', NEW.user_id, 'INSERT',
              JSON_OBJECT(
                'user_id', NEW.user_id,
                'username', NEW.username,
                'password', NEW.password,
                'real_name', NEW.real_name,
                'role', NEW.role,
                'email', NEW.email,
                'phone', NEW.phone,
                'status', NEW.status,
                'is_deleted', NEW.is_deleted,
                'created_time', NEW.created_time,
                'last_updated_time', NEW.last_updated_time,
                'sync_version', NEW.sync_version,
                'db_source', NEW.db_source
              ),
              '${toDB}', '待同步', NOW(), 0
            );
          END IF;
        END
      `);

      // UPDATE触发器
      await executeQuery(toDB, `
        CREATE TRIGGER sync_system_users_update
        AFTER UPDATE ON system_users
        FOR EACH ROW
        BEGIN
          IF @sync_in_progress IS NULL THEN
            INSERT INTO sync_log (
              table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
              'system_users', NEW.user_id, 'UPDATE',
              JSON_OBJECT(
                'user_id', NEW.user_id,
                'username', NEW.username,
                'password', NEW.password,
                'real_name', NEW.real_name,
                'role', NEW.role,
                'email', NEW.email,
                'phone', NEW.phone,
                'status', NEW.status,
                'is_deleted', NEW.is_deleted,
                'created_time', NEW.created_time,
                'last_updated_time', NEW.last_updated_time,
                'sync_version', NEW.sync_version,
                'db_source', NEW.db_source
              ),
              '${toDB}', '待同步', NOW(), 0
            );
          END IF;
        END
      `);

      // DELETE触发器（软删除）
      await executeQuery(toDB, `
        CREATE TRIGGER sync_system_users_delete
        AFTER UPDATE ON system_users
        FOR EACH ROW
        BEGIN
          IF @sync_in_progress IS NULL AND NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
            INSERT INTO sync_log (
              table_name, record_id, operation, change_data, source_db, sync_status, created_time, retry_count
            ) VALUES (
              'system_users', NEW.user_id, 'DELETE',
              JSON_OBJECT('user_id', NEW.user_id, 'is_deleted', 1),
              '${toDB}', '待同步', NOW(), 0
            );
          END IF;
        END
      `);

      logger.info(`触发器移动完成: ${fromDB} -> ${toDB}`);
    } catch (error) {
      logger.error(`移动触发器失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新数据库配置
   */
  async updateDatabaseConfigs(newPrimaryDB) {
    const { executeQuery } = require('../config/database');
    
    try {
      logger.info(`更新数据库配置，新主数据库: ${newPrimaryDB}`);

      // 更新所有数据库的配置
      for (const dbName of this.availableDatabases) {
        try {
          const isMaster = dbName === newPrimaryDB;
          
          // 更新system_config表
          await executeQuery(dbName, `
            UPDATE system_config 
            SET config_value = ?, updated_time = NOW()
            WHERE config_key = 'primary_database'
          `, [newPrimaryDB]);

          // 更新sync_config表
          await executeQuery(dbName, `
            UPDATE sync_config 
            SET config_value = ?, last_updated = NOW()
            WHERE config_key = 'is_master_database'
          `, [isMaster.toString()]);

          await executeQuery(dbName, `
            UPDATE sync_config 
            SET config_value = ?, last_updated = NOW()
            WHERE config_key = 'database_role'
          `, [isMaster ? 'master' : 'slave']);

          await executeQuery(dbName, `
            UPDATE sync_config 
            SET config_value = ?, last_updated = NOW()
            WHERE config_key = 'sync_direction'
          `, [isMaster ? 'master_to_slave' : 'slave_only']);

          logger.debug(`${dbName} 配置已更新: ${isMaster ? 'master' : 'slave'}`);
        } catch (error) {
          logger.warn(`更新 ${dbName} 配置失败: ${error.message}`);
        }
      }

      logger.info('数据库配置更新完成');
    } catch (error) {
      logger.error(`更新数据库配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 触发数据同步（在切换前确保数据一致性）
   */
  async triggerDataSync() {
    try {
      // 这里可以调用现有的同步服务
      const { triggerSync } = require('./syncService');
      await triggerSync();
      
      // 等待同步完成
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info('数据同步已触发');
      return { success: true, message: '数据同步已触发' };
    } catch (error) {
      logger.error('触发数据同步失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const databaseSwitchService = new DatabaseSwitchService();

module.exports = databaseSwitchService;
