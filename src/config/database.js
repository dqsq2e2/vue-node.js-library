const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// 数据库连接池配置
const dbConfigs = {
  mysql: {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    multipleStatements: true,
    connectTimeout: 10000  // 连接超时 10 秒
  },
  mariadb: {
    host: process.env.MARIADB_HOST,
    port: process.env.MARIADB_PORT,
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    charset: 'utf8mb4',
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    multipleStatements: true,
    connectTimeout: 10000
  },
  greatsql: {
    host: process.env.GREATSQL_HOST,
    port: process.env.GREATSQL_PORT,
    user: process.env.GREATSQL_USER,
    password: process.env.GREATSQL_PASSWORD,
    database: process.env.GREATSQL_DATABASE,
    charset: 'utf8mb4',
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    multipleStatements: true,
    connectTimeout: 10000
  }
};

// 数据库连接池实例
const dbPools = {};

/**
 * 创建数据库连接池
 */
async function createDatabasePools() {
  for (const [dbName, config] of Object.entries(dbConfigs)) {
    try {
      dbPools[dbName] = mysql.createPool(config);
      logger.info(`${dbName} 数据库连接池创建成功`);
    } catch (error) {
      logger.error(`${dbName} 数据库连接池创建失败:`, error);
      throw error;
    }
  }
}

/**
 * 测试数据库连接（带超时）
 */
async function testDatabaseConnections() {
  const results = {};
  
  for (const [dbName, pool] of Object.entries(dbPools)) {
    const config = dbConfigs[dbName];
    logger.info(`正在连接 ${dbName} (${config.host}:${config.port})...`);
    
    try {
      // 使用 Promise.race 添加额外超时保护
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('连接超时 (10秒)')), 10000)
      );
      
      const connectPromise = (async () => {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return true;
      })();
      
      await Promise.race([connectPromise, timeoutPromise]);
      results[dbName] = { status: 'connected', error: null };
      logger.info(`✓ ${dbName} 连接成功`);
    } catch (error) {
      results[dbName] = { status: 'error', error: error.message };
      logger.warn(`✗ ${dbName} 连接失败: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * 获取数据库连接池
 */
function getPool(dbName = null) {
  // 如果没有指定数据库名，或者指定的是 'mysql'，使用当前主数据库
  // 这样可以自动拦截所有硬编码的 executeQuery('mysql', ...) 调用
  if (!dbName || dbName === 'mysql') {
    try {
      // 延迟加载以避免循环依赖
      const databaseSwitchService = require('../services/databaseSwitchService');
      const primaryDB = databaseSwitchService.getCurrentPrimaryDB();
      
      // 只有当主数据库不是 mysql 时才重定向
      if (primaryDB && primaryDB !== 'mysql') {
        logger.debug(`数据库重定向: ${dbName || 'null'} -> ${primaryDB}`);
        dbName = primaryDB;
      } else {
        dbName = 'mysql'; // 默认使用 mysql
      }
    } catch (error) {
      // 如果切换服务不可用，回退到默认值
      logger.debug('无法获取主数据库，使用默认值: mysql');
      dbName = 'mysql';
    }
  }
  
  if (!dbPools[dbName]) {
    throw new Error(`数据库连接池 ${dbName} 不存在`);
  }
  return dbPools[dbName];
}

/**
 * 获取所有数据库连接池
 */
function getAllPools() {
  return dbPools;
}

/**
 * 执行SQL查询
 */
async function executeQuery(dbName = null, sql, params = []) {
  // 如果第一个参数是SQL语句，则调整参数顺序
  if (typeof dbName === 'string' && dbName.toUpperCase().includes('SELECT') || 
      typeof dbName === 'string' && dbName.toUpperCase().includes('INSERT') ||
      typeof dbName === 'string' && dbName.toUpperCase().includes('UPDATE') ||
      typeof dbName === 'string' && dbName.toUpperCase().includes('DELETE')) {
    params = sql || [];
    sql = dbName;
    dbName = null;
  }
  
  const pool = getPool(dbName);
  try {
    // 确保params是数组
    const queryParams = Array.isArray(params) ? params : [params];
    
    // 将undefined转换为null，避免MySQL2绑定参数错误
    const cleanedParams = queryParams.map(param => param === undefined ? null : param);
    
    // 对于复杂查询使用query方法，简单查询使用execute方法
    let results;
    if (sql.includes('ORDER BY') || sql.includes('LIMIT') || sql.includes('JOIN')) {
      [results] = await pool.query(sql, cleanedParams);
    } else {
      [results] = await pool.execute(sql, cleanedParams);
    }
    
    return results;
  } catch (error) {
    logger.error(`数据库查询失败 [${dbName}]:`, error);
    logger.error(`SQL: ${sql}`);
    logger.error(`参数: ${JSON.stringify(params)}`);
    throw error;
  }
}

/**
 * 执行事务
 */
async function executeTransaction(dbName, queries) {
  const pool = getPool(dbName);
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { sql, params } of queries) {
      const [result] = await connection.execute(sql, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    logger.error(`事务执行失败 [${dbName}]:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 批量执行SQL
 */
async function executeBatch(dbName, sql, paramsList) {
  const pool = getPool(dbName);
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const params of paramsList) {
      const [result] = await connection.execute(sql, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    logger.error(`批量执行失败 [${dbName}]:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 连接所有数据库
 */
async function connectDatabases() {
  await createDatabasePools();
  const connectionResults = await testDatabaseConnections();
  
  // 检查是否至少有一个数据库连接成功
  const connectedDbs = Object.values(connectionResults).filter(result => result.status === 'connected');
  if (connectedDbs.length === 0) {
    throw new Error('所有数据库连接失败');
  }
  
  logger.info(`成功连接 ${connectedDbs.length} 个数据库`);
  return connectionResults;
}

/**
 * 关闭所有数据库连接
 */
async function closeDatabases() {
  for (const [dbName, pool] of Object.entries(dbPools)) {
    try {
      await pool.end();
      logger.info(`${dbName} 数据库连接池已关闭`);
    } catch (error) {
      logger.error(`关闭 ${dbName} 数据库连接池失败:`, error);
    }
  }
}

module.exports = {
  connectDatabases,
  closeDatabases,
  getPool,
  getAllPools,
  executeQuery,
  executeTransaction,
  executeBatch,
  testDatabaseConnections
};
