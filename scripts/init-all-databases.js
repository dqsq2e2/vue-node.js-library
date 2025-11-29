/**
 * 数据库初始化脚本
 * 用于初始化所有配置的数据库（MySQL/MariaDB/GreatSQL）
 * 
 * 使用方法：
 *   node scripts/init-all-databases.js [选项]
 * 
 * 选项：
 *   --db=mysql|mariadb|greatsql  只初始化指定数据库
 *   --primary=mysql|mariadb|greatsql  指定主数据库（默认：mysql）
 *   --skip-data                   跳过初始数据
 *   --skip-triggers               跳过触发器
 *   --skip-procedures             跳过存储过程
 * 
 * 示例：
 *   node scripts/init-all-databases.js --primary=mysql
 *   node scripts/init-all-databases.js --db=mariadb --primary=mysql
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfigs = {
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: 'library_management',
    multipleStatements: true
  },
  mariadb: {
    host: process.env.MARIADB_HOST || 'localhost',
    port: parseInt(process.env.MARIADB_PORT) || 3307,
    user: process.env.MARIADB_USER || 'root',
    password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD,
    database: 'library_management',
    multipleStatements: true
  },
  greatsql: {
    host: process.env.GREATSQL_HOST || 'localhost',
    port: parseInt(process.env.GREATSQL_PORT) || 3308,
    user: process.env.GREATSQL_USER || 'root',
    password: process.env.GREATSQL_PASSWORD || process.env.DB_PASSWORD,
    database: 'library_management',
    multipleStatements: true
  }
};

// SQL 文件路径
const sqlDir = path.join(__dirname, '..', 'sql');
const sqlFiles = {
  database: path.join(sqlDir, 'init-database.sql'),
  data: path.join(sqlDir, 'init-data.sql'),
  triggers: path.join(sqlDir, 'init-triggers.sql'),
  procedures: path.join(sqlDir, 'stored-procedures.sql')
};

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    targetDb: null,
    primaryDb: 'mysql',  // 默认主数据库
    skipData: false,
    skipTriggers: false,
    skipProcedures: false
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--db=')) {
      options.targetDb = arg.split('=')[1];
    } else if (arg.startsWith('--primary=')) {
      options.primaryDb = arg.split('=')[1];
    } else if (arg === '--skip-data') {
      options.skipData = true;
    } else if (arg === '--skip-triggers') {
      options.skipTriggers = true;
    } else if (arg === '--skip-procedures') {
      options.skipProcedures = true;
    }
  });
  
  return options;
}

// 读取 SQL 文件
function readSqlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  文件不存在: ${path.basename(filePath)}`);
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

// 执行 SQL（处理 DELIMITER）
async function executeSql(conn, sql, description) {
  try {
    console.log(`  执行: ${description}...`);
    
    // 处理包含 DELIMITER 的 SQL（触发器和存储过程）
    if (sql.includes('DELIMITER')) {
      // 分割并逐个执行
      const statements = parseSqlWithDelimiter(sql);
      for (const stmt of statements) {
        if (stmt.trim()) {
          await conn.query(stmt);
        }
      }
    } else {
      await conn.query(sql);
    }
    
    console.log(`  ✅ ${description} 完成`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${description} 失败: ${error.message}`);
    return false;
  }
}

// 解析包含 DELIMITER 的 SQL
function parseSqlWithDelimiter(sql) {
  const statements = [];
  let currentDelimiter = ';';
  let currentStatement = '';
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 检查 DELIMITER 命令
    if (trimmedLine.toUpperCase().startsWith('DELIMITER')) {
      const newDelimiter = trimmedLine.split(/\s+/)[1];
      if (newDelimiter) {
        currentDelimiter = newDelimiter;
      }
      continue;
    }
    
    currentStatement += line + '\n';
    
    // 检查语句结束
    if (trimmedLine.endsWith(currentDelimiter)) {
      // 移除末尾的分隔符
      let stmt = currentStatement.trim();
      if (currentDelimiter !== ';') {
        stmt = stmt.slice(0, -currentDelimiter.length);
      }
      if (stmt.trim()) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }
  
  // 处理最后一个语句
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements;
}

// 替换环境变量占位符
function replaceEnvPlaceholders(sql) {
  // 数据库连接配置占位符
  const replacements = {
    '{{MYSQL_HOST}}': process.env.MYSQL_HOST || 'localhost',
    '{{MYSQL_PORT}}': process.env.MYSQL_PORT || '3306',
    '{{MYSQL_DATABASE}}': process.env.MYSQL_DATABASE || 'library_management',
    '{{MYSQL_USER}}': process.env.MYSQL_USER || 'root',
    '{{MYSQL_PASSWORD}}': process.env.MYSQL_PASSWORD || '',
    
    '{{MARIADB_HOST}}': process.env.MARIADB_HOST || 'localhost',
    '{{MARIADB_PORT}}': process.env.MARIADB_PORT || '3307',
    '{{MARIADB_DATABASE}}': process.env.MARIADB_DATABASE || 'library_management',
    '{{MARIADB_USER}}': process.env.MARIADB_USER || 'root',
    '{{MARIADB_PASSWORD}}': process.env.MARIADB_PASSWORD || '',
    
    '{{GREATSQL_HOST}}': process.env.GREATSQL_HOST || 'localhost',
    '{{GREATSQL_PORT}}': process.env.GREATSQL_PORT || '3308',
    '{{GREATSQL_DATABASE}}': process.env.GREATSQL_DATABASE || 'library_management',
    '{{GREATSQL_USER}}': process.env.GREATSQL_USER || 'root',
    '{{GREATSQL_PASSWORD}}': process.env.GREATSQL_PASSWORD || ''
  };
  
  let result = sql;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return result;
}

// 配置数据库角色（主/从）
async function configureDatabaseRole(conn, currentDbName, primaryDbName) {
  const isMaster = (currentDbName === primaryDbName);
  
  console.log(`  执行: 配置数据库角色 (${isMaster ? '主库' : '从库'})...`);
  
  try {
    // 更新 system_config 表
    await conn.query(
      `UPDATE system_config SET config_value = ? WHERE config_key = 'primary_database'`,
      [primaryDbName]
    );
    
    // 更新 sync_config 表
    await conn.query(
      `UPDATE sync_config SET config_value = ? WHERE config_key = 'is_master_database'`,
      [isMaster.toString()]
    );
    
    await conn.query(
      `UPDATE sync_config SET config_value = ? WHERE config_key = 'database_role'`,
      [isMaster ? 'master' : 'slave']
    );
    
    await conn.query(
      `UPDATE sync_config SET config_value = ? WHERE config_key = 'sync_direction'`,
      [isMaster ? 'master_to_slave' : 'slave_only']
    );
    
    console.log(`  ✅ 数据库角色配置完成: ${currentDbName} = ${isMaster ? '主库' : '从库'}, 主库=${primaryDbName}`);
  } catch (error) {
    console.error(`  ❌ 配置数据库角色失败: ${error.message}`);
  }
}

// 初始化单个数据库
async function initDatabase(dbName, config, options) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`初始化数据库: ${dbName.toUpperCase()}`);
  console.log(`  主机: ${config.host}:${config.port}`);
  console.log(`${'='.repeat(50)}`);
  
  let conn;
  try {
    // 先连接到服务器（不指定数据库）
    const serverConfig = { ...config };
    delete serverConfig.database;
    
    conn = await mysql.createConnection(serverConfig);
    console.log(`  ✅ 连接成功`);
    
    // 创建数据库（如果不存在）
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    console.log(`  ✅ 数据库 ${config.database} 已准备`);
    
    // 切换到目标数据库
    await conn.query(`USE \`${config.database}\``);
    
    // 1. 执行表结构初始化
    const dbSql = readSqlFile(sqlFiles.database);
    if (dbSql) {
      await executeSql(conn, dbSql, '创建表结构');
    }
    
    // 2. 执行初始数据（可选）
    if (!options.skipData) {
      let dataSql = readSqlFile(sqlFiles.data);
      if (dataSql) {
        // 替换环境变量占位符
        console.log(`  替换环境变量占位符...`);
        dataSql = replaceEnvPlaceholders(dataSql);
        await executeSql(conn, dataSql, '插入初始数据');
      }
      
      // 2.1 配置数据库角色（主/从）
      await configureDatabaseRole(conn, dbName, options.primaryDb);
    } else {
      console.log(`  ⏭️  跳过初始数据`);
    }
    
    // 3. 执行触发器（可选）
    if (!options.skipTriggers) {
      let triggersSql = readSqlFile(sqlFiles.triggers);
      if (triggersSql) {
        // 为当前数据库定制触发器（替换占位符）
        console.log(`  为 ${dbName} 定制触发器...`);
        triggersSql = triggersSql.replace(/{{DB_TYPE}}/g, dbName);
        await executeSql(conn, triggersSql, '创建触发器');
      }
    } else {
      console.log(`  ⏭️  跳过触发器`);
    }
    
    // 4. 执行存储过程（可选）
    if (!options.skipProcedures) {
      const proceduresSql = readSqlFile(sqlFiles.procedures);
      if (proceduresSql) {
        await executeSql(conn, proceduresSql, '创建存储过程');
      }
    } else {
      console.log(`  ⏭️  跳过存储过程`);
    }
    
    console.log(`\n  🎉 ${dbName} 初始化完成！`);
    return true;
    
  } catch (error) {
    console.error(`\n  ❌ ${dbName} 初始化失败: ${error.message}`);
    return false;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

// 主函数
async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║       图书管理系统 - 数据库初始化工具              ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  const options = parseArgs();
  
  // 验证主数据库参数
  if (!dbConfigs[options.primaryDb]) {
    console.error(`\n❌ 未知的主数据库: ${options.primaryDb}`);
    console.log(`   可用选项: ${Object.keys(dbConfigs).join(', ')}`);
    process.exit(1);
  }
  
  // 检查 SQL 文件是否存在
  console.log('\n检查 SQL 文件...');
  for (const [name, filePath] of Object.entries(sqlFiles)) {
    const exists = fs.existsSync(filePath);
    console.log(`  ${exists ? '✅' : '❌'} ${path.basename(filePath)}`);
  }
  
  // 确定要初始化的数据库
  let databases = Object.keys(dbConfigs);
  if (options.targetDb) {
    if (dbConfigs[options.targetDb]) {
      databases = [options.targetDb];
    } else {
      console.error(`\n❌ 未知数据库: ${options.targetDb}`);
      console.log(`   可用选项: ${Object.keys(dbConfigs).join(', ')}`);
      process.exit(1);
    }
  }
  
  console.log(`\n将初始化以下数据库: ${databases.join(', ')}`);
  console.log(`主数据库: ${options.primaryDb.toUpperCase()} ⭐`);
  
  // 初始化每个数据库
  const results = {};
  for (const dbName of databases) {
    results[dbName] = await initDatabase(dbName, dbConfigs[dbName], options);
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(50));
  console.log('初始化结果汇总:');
  console.log('='.repeat(50));
  for (const [dbName, success] of Object.entries(results)) {
    console.log(`  ${success ? '✅' : '❌'} ${dbName}`);
  }
  
  const allSuccess = Object.values(results).every(v => v);
  process.exit(allSuccess ? 0 : 1);
}

main();
