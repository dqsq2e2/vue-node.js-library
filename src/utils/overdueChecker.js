const { executeQuery } = require('../config/database');
const logger = require('./logger');
const emailService = require('../services/emailService');

/**
 * 检查并更新逾期状态（调用存储过程）
 */
async function checkAndUpdateOverdueStatus() {
  try {
    logger.info('开始检查逾期状态...');
    
    // 调用存储过程处理逾期图书（包含状态更新和罚款计算）
    // 使用主数据库执行（null 会自动使用当前主数据库）
    const sql = 'CALL process_overdue_books()';
    const result = await executeQuery(null, sql);
    
    const processedCount = result[0] && result[0][0] ? result[0][0]['处理的逾期记录数'] : 0;
    
    if (processedCount > 0) {
      logger.info(`处理了 ${processedCount} 条逾期记录（包含罚款计算）`);
    }
    
    // 注：数据会通过同步机制自动同步到其他数据库，无需手动处理
    
    return processedCount;
    
  } catch (error) {
    logger.error('检查逾期状态失败:', error);
    throw error;
  }
}

/**
 * 获取逾期统计信息
 */
async function getOverdueStats() {
  try {
    const statsSql = `
      SELECT 
        COUNT(CASE WHEN status IN ('借出', '逾期') AND due_date < CURDATE() THEN 1 END) as total_overdue,
        COUNT(CASE WHEN status = '借出' THEN 1 END) as current_borrowed,
        COUNT(CASE WHEN status = '逾期' THEN 1 END) as marked_overdue,
        AVG(CASE WHEN due_date < CURDATE() THEN DATEDIFF(CURDATE(), due_date) END) as avg_overdue_days
      FROM borrow_records 
      WHERE is_deleted = 0
    `;
    
    const result = await executeQuery(null, statsSql);
    return result[0];
    
  } catch (error) {
    logger.error('获取逾期统计失败:', error);
    throw error;
  }
}

/**
 * 发送逾期通知邮件
 */
async function sendOverdueNotifications() {
  try {
    logger.info('开始发送逾期通知邮件...');
    
    // 获取所有逾期记录及读者信息
    const overdueRecordsSql = `
      SELECT 
        br.record_id,
        br.reader_id,
        br.book_id,
        br.borrow_date,
        br.due_date,
        br.fine_amount,
        DATEDIFF(CURDATE(), br.due_date) as overdue_days,
        b.title as book_title,
        u.email,
        u.real_name
      FROM borrow_records br
      INNER JOIN books b ON br.book_id = b.book_id
      INNER JOIN reader_profiles rp ON br.reader_id = rp.profile_id
      INNER JOIN system_users u ON rp.user_id = u.user_id
      WHERE br.status = '逾期' 
        AND br.is_deleted = 0
        AND u.email IS NOT NULL
        AND u.email != ''
    `;
    
    const overdueRecords = await executeQuery(null, overdueRecordsSql);
    
    if (overdueRecords.length === 0) {
      logger.info('没有需要发送通知的逾期记录');
      return 0;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const record of overdueRecords) {
      try {
        await emailService.sendOverdueNotification(record.email, {
          title: record.book_title,
          borrowDate: new Date(record.borrow_date).toLocaleDateString('zh-CN'),
          dueDate: new Date(record.due_date).toLocaleDateString('zh-CN'),
          overdueDays: record.overdue_days,
          fine: record.fine_amount
        });
        
        successCount++;
        logger.info(`逾期通知已发送: ${record.email} - ${record.book_title}`);
      } catch (emailError) {
        failCount++;
        logger.error(`发送逾期通知失败: ${record.email}`, emailError.message);
      }
    }
    
    logger.info(`逾期通知发送完成: 成功 ${successCount}, 失败 ${failCount}`);
    return successCount;
    
  } catch (error) {
    logger.error('发送逾期通知邮件失败:', error);
    throw error;
  }
}

/**
 * 启动定时检查逾期状态
 */
function startOverdueChecker() {
  // 立即执行一次
  checkAndUpdateOverdueStatus();
  
  // 每小时检查一次逾期状态
  setInterval(async () => {
    try {
      await checkAndUpdateOverdueStatus();
    } catch (error) {
      logger.error('定时逾期检查失败:', error);
    }
  }, 60 * 60 * 1000); // 1小时
  
  // 每天早上9点发送逾期通知邮件
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      try {
        await sendOverdueNotifications();
      } catch (error) {
        logger.error('定时发送逾期通知失败:', error);
      }
    }
  }, 60 * 1000); // 每分钟检查一次，到9点时发送
  
  logger.info('逾期状态定时检查器已启动，每小时检查一次');
  logger.info('逾期通知邮件定时发送器已启动，每天9:00发送');
}

module.exports = {
  checkAndUpdateOverdueStatus,
  getOverdueStats,
  sendOverdueNotifications,
  startOverdueChecker
};
