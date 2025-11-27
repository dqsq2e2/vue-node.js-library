/**
 * 同步冲突模拟脚本
 * 用于测试冲突检测和记录机制
 * 
 * 使用方法: node scripts/simulate-conflict.js [场景编号]
 * 场景1: 版本冲突 - 目标版本比源版本高
 * 场景2: 时间冲突 - 目标更新时间比源更新时间晚
 * 场景3: 数据不一致 - 同一记录在不同数据库有不同值
 */

require('dotenv').config();
const { executeQuery, testDatabaseConnections, connectDatabases } = require('../src/config/database');

// 测试用的图书ID（请确保这个ID在数据库中存在）
const TEST_BOOK_ID = 1;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  console.log('📡 初始化数据库连接...');
  await connectDatabases();
}

async function checkDatabaseConnections() {
  console.log('\n🔍 检查数据库连接状态...');
  const connections = await testDatabaseConnections();
  
  const connected = [];
  const disconnected = [];
  
  for (const [db, status] of Object.entries(connections)) {
    // testDatabaseConnections 返回 { status: 'connected' | 'error', error: ... }
    if (status.status === 'connected') {
      connected.push(db);
      console.log(`  ✅ ${db}: 已连接`);
    } else {
      disconnected.push(db);
      console.log(`  ❌ ${db}: 未连接 - ${status.error || '连接失败'}`);
    }
  }
  
  return { connected, disconnected };
}

/**
 * 场景1: 版本冲突
 * 直接在目标数据库增加 sync_version，使其比源数据库高
 */
async function simulateVersionConflict() {
  console.log('\n📌 场景1: 模拟版本冲突');
  console.log('=' .repeat(50));
  
  try {
    // 1. 获取当前主数据库的记录
    const sourceRecord = await executeQuery(null, 
      `SELECT book_id, title, sync_version FROM books WHERE book_id = ?`, 
      [TEST_BOOK_ID]
    );
    
    if (sourceRecord.length === 0) {
      console.log(`❌ 图书ID ${TEST_BOOK_ID} 不存在，请修改 TEST_BOOK_ID`);
      return;
    }
    
    console.log(`源数据库当前版本: ${sourceRecord[0].sync_version}`);
    
    // 2. 在 greatsql 中增加版本号（模拟从库被独立修改）
    const newVersion = (sourceRecord[0].sync_version || 0) + 5;
    await executeQuery('greatsql',
      `UPDATE books SET sync_version = ?, last_updated_time = NOW() WHERE book_id = ?`,
      [newVersion, TEST_BOOK_ID]
    );
    console.log(`已将 greatsql 中的版本号改为: ${newVersion}`);
    
    // 3. 先清理已有的同步日志，避免重复
    await executeQuery(null, `
      DELETE FROM sync_log 
      WHERE table_name = 'books' AND record_id = ? AND sync_status IN ('待同步', '同步失败')
    `, [TEST_BOOK_ID]);
    
    // 4. 在主数据库创建同步日志，触发同步
    await executeQuery(null, `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db, sync_status, retry_count, sync_attempts)
      VALUES ('books', ?, 'UPDATE', ?, 'mysql', '待同步', 0, 0)
    `, [TEST_BOOK_ID, JSON.stringify(sourceRecord[0])]);
    
    console.log('✅ 已创建同步日志，等待下次同步任务时将检测到版本冲突');
    console.log('   预期结果: 同步到 greatsql 时会产生版本冲突');
    
  } catch (error) {
    console.error('❌ 模拟失败:', error.message);
  }
}

/**
 * 场景2: 时间冲突
 * 在目标数据库设置更晚的更新时间
 */
async function simulateTimeConflict() {
  console.log('\n📌 场景2: 模拟时间冲突');
  console.log('='.repeat(50));
  
  try {
    // 1. 获取当前记录
    const sourceRecord = await executeQuery(null,
      `SELECT book_id, title, last_updated_time FROM books WHERE book_id = ?`,
      [TEST_BOOK_ID]
    );
    
    if (sourceRecord.length === 0) {
      console.log(`❌ 图书ID ${TEST_BOOK_ID} 不存在`);
      return;
    }
    
    console.log(`源数据库更新时间: ${sourceRecord[0].last_updated_time}`);
    
    // 2. 在 greatsql 中设置未来时间
    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 明天
    await executeQuery('greatsql',
      `UPDATE books SET last_updated_time = ? WHERE book_id = ?`,
      [futureTime, TEST_BOOK_ID]
    );
    console.log(`已将 greatsql 中的更新时间改为: ${futureTime.toISOString()}`);
    
    // 3. 先清理已有的同步日志，避免重复
    await executeQuery(null, `
      DELETE FROM sync_log 
      WHERE table_name = 'books' AND record_id = ? AND sync_status IN ('待同步', '同步失败')
    `, [TEST_BOOK_ID]);
    
    // 4. 创建新的同步日志
    const changeData = { ...sourceRecord[0] };
    await executeQuery(null, `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db, sync_status, retry_count, sync_attempts)
      VALUES ('books', ?, 'UPDATE', ?, 'mysql', '待同步', 0, 0)
    `, [TEST_BOOK_ID, JSON.stringify(changeData)]);
    
    console.log('✅ 已创建同步日志，等待下次同步任务时将检测到时间冲突');
    
  } catch (error) {
    console.error('❌ 模拟失败:', error.message);
  }
}

/**
 * 场景3: 数据不一致冲突
 * 在两个数据库设置不同的字段值
 */
async function simulateDataMismatch() {
  console.log('\n📌 场景3: 模拟数据不一致冲突');
  console.log('='.repeat(50));
  
  try {
    // 1. 获取当前记录
    const sourceRecord = await executeQuery(null,
      `SELECT * FROM books WHERE book_id = ?`,
      [TEST_BOOK_ID]
    );
    
    if (sourceRecord.length === 0) {
      console.log(`❌ 图书ID ${TEST_BOOK_ID} 不存在`);
      return;
    }
    
    const originalTitle = sourceRecord[0].title;
    console.log(`源数据库书名: "${originalTitle}"`);
    
    // 2. 在 greatsql 中修改书名和 db_source
    const conflictTitle = originalTitle + ' [冲突测试-从库修改]';
    await executeQuery('greatsql',
      `UPDATE books SET title = ?, db_source = 'greatsql', 
       sync_version = sync_version + 1, last_updated_time = NOW() 
       WHERE book_id = ?`,
      [conflictTitle, TEST_BOOK_ID]
    );
    console.log(`已将 greatsql 中的书名改为: "${conflictTitle}"`);
    
    // 3. 在主数据库也修改书名（不同的值）
    const sourceTitle = originalTitle + ' [冲突测试-主库修改]';
    await executeQuery(null,
      `UPDATE books SET title = ?, db_source = 'mysql' WHERE book_id = ?`,
      [sourceTitle, TEST_BOOK_ID]
    );
    console.log(`已将主数据库中的书名改为: "${sourceTitle}"`);
    
    // 同步日志会自动创建（通过触发器）
    console.log('✅ 数据不一致已创建，同步时将检测到字段级冲突');
    console.log('   冲突字段: title');
    
  } catch (error) {
    console.error('❌ 模拟失败:', error.message);
  }
}

/**
 * 查看当前冲突记录
 */
async function viewConflictRecords() {
  console.log('\n📋 当前冲突记录');
  console.log('='.repeat(50));
  
  try {
    const records = await executeQuery(null, `
      SELECT conflict_id, table_name, record_id, source_db, target_db, 
             resolve_status, conflict_time, remarks
      FROM conflict_records 
      ORDER BY conflict_time DESC 
      LIMIT 10
    `);
    
    if (records.length === 0) {
      console.log('暂无冲突记录');
      return;
    }
    
    records.forEach((r, i) => {
      console.log(`\n[${i + 1}] 冲突ID: ${r.conflict_id}`);
      console.log(`    表: ${r.table_name}, 记录ID: ${r.record_id}`);
      console.log(`    方向: ${r.source_db} → ${r.target_db}`);
      console.log(`    状态: ${r.resolve_status}`);
      console.log(`    时间: ${r.conflict_time}`);
      if (r.remarks) {
        console.log(`    备注: ${r.remarks.substring(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  console.log('\n🧹 清理测试数据');
  console.log('='.repeat(50));
  
  try {
    // 恢复图书原始数据
    const originalTitle = '测试图书'; // 需要根据实际情况修改
    
    // 删除测试产生的冲突记录
    const result = await executeQuery(null, `
      DELETE FROM conflict_records 
      WHERE remarks LIKE '%冲突测试%' OR remarks LIKE '%测试%'
    `);
    console.log(`已删除测试冲突记录: ${result.affectedRows} 条`);
    
    // 删除测试同步日志
    const syncResult = await executeQuery(null, `
      DELETE FROM sync_log 
      WHERE record_id = ? AND table_name = 'books' AND sync_status = '待同步'
    `, [TEST_BOOK_ID]);
    console.log(`已删除测试同步日志: ${syncResult.affectedRows} 条`);
    
    console.log('✅ 清理完成');
    
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
  }
}

/**
 * 手动触发同步处理
 */
async function triggerSync() {
  console.log('\n⚡ 手动触发同步处理');
  console.log('='.repeat(50));
  
  try {
    const DatabaseSyncService = require('../src/services/syncService');
    const syncService = new DatabaseSyncService();
    
    console.log('正在执行同步...');
    await syncService.processSync();
    console.log('✅ 同步执行完成，请查看冲突记录');
    
  } catch (error) {
    console.error('❌ 同步失败:', error.message);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0];
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║        同步冲突模拟测试脚本                    ║');
  console.log('╚════════════════════════════════════════════════╝');
  
  // 先初始化数据库连接
  await initDatabase();
  
  // 检查数据库连接状态
  const { connected, disconnected } = await checkDatabaseConnections();
  
  if (!connected.includes('greatsql')) {
    console.log('\n⚠️  警告: greatsql 未连接，部分测试可能无法执行');
  }
  
  switch (scenario) {
    case '1':
      await simulateVersionConflict();
      break;
    case '2':
      await simulateTimeConflict();
      break;
    case '3':
      await simulateDataMismatch();
      break;
    case 'view':
      await viewConflictRecords();
      break;
    case 'sync':
      await triggerSync();
      break;
    case 'clean':
      await cleanupTestData();
      break;
    case 'all':
      await simulateVersionConflict();
      await simulateTimeConflict();
      await simulateDataMismatch();
      break;
    default:
      console.log(`
使用方法: node scripts/simulate-conflict.js [命令]

命令:
  1      模拟版本冲突 (sync_version)
  2      模拟时间冲突 (last_updated_time)  
  3      模拟数据不一致冲突 (字段值不同)
  all    执行所有冲突场景
  sync   手动触发同步处理
  view   查看当前冲突记录
  clean  清理测试数据

示例:
  node scripts/simulate-conflict.js 1      # 模拟版本冲突
  node scripts/simulate-conflict.js all    # 执行所有场景
  node scripts/simulate-conflict.js sync   # 触发同步检测冲突
  node scripts/simulate-conflict.js view   # 查看冲突记录
      `);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
