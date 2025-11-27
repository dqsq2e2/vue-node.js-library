const express = require('express');
const { query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// 所有报表相关路由都需要认证
router.use(authenticate);

/**
 * 获取系统概览统计
 */
router.get('/overview', requirePermission('REPORT_VIEW'), asyncHandler(async (req, res) => {
  try {
    // 图书统计
    const bookStatsSql = `
      SELECT 
        COUNT(*) as total_books,
        SUM(total_copies) as total_copies,
        SUM(available_copies) as available_copies,
        COUNT(CASE WHEN status = '在库' THEN 1 END) as books_in_stock,
        COUNT(CASE WHEN status = '下架' THEN 1 END) as books_off_shelf
      FROM books 
      WHERE is_deleted = 0
    `;
    const bookStats = await executeQuery('mysql', bookStatsSql);

    // 读者统计
    const readerStatsSql = `
      SELECT 
        COUNT(*) as total_readers,
        COUNT(CASE WHEN profile_id IS NOT NULL THEN 1 END) as active_readers,
        COUNT(CASE WHEN membership_type = 'VIP' THEN 1 END) as vip_readers,
        COUNT(CASE WHEN membership_type = '教师' THEN 1 END) as teacher_readers,
        COUNT(CASE WHEN membership_type = '学生' THEN 1 END) as student_readers
      FROM user_complete_info 
      WHERE role = 'reader'
    `;
    const readerStats = await executeQuery('mysql', readerStatsSql);

    // 借阅统计
    const borrowStatsSql = `
      SELECT 
        COUNT(*) as total_borrows,
        COUNT(CASE WHEN status = '借出' THEN 1 END) as current_borrows,
        COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_borrows,
        COUNT(CASE WHEN status = '已还' THEN 1 END) as returned_borrows,
        COALESCE(SUM(fine_amount), 0) as total_fines
      FROM borrow_records 
      WHERE is_deleted = 0
    `;
    const borrowStats = await executeQuery('mysql', borrowStatsSql);

    // 今日统计
    const todayStatsSql = `
      SELECT 
        COUNT(CASE WHEN DATE(created_time) = CURDATE() THEN 1 END) as today_borrows,
        COUNT(CASE WHEN DATE(return_date) = CURDATE() THEN 1 END) as today_returns
      FROM borrow_records 
      WHERE is_deleted = 0
    `;
    const todayStats = await executeQuery('mysql', todayStatsSql);

    res.json({
      success: true,
      message: '获取系统概览成功',
      data: {
        // 扁平化数据结构，便于前端使用
        total_books: bookStats[0].total_books,
        total_copies: bookStats[0].total_copies,
        available_copies: bookStats[0].available_copies,
        books_in_stock: bookStats[0].books_in_stock,
        books_off_shelf: bookStats[0].books_off_shelf,
        
        total_readers: readerStats[0].total_readers,
        active_readers: readerStats[0].active_readers,
        vip_readers: readerStats[0].vip_readers,
        teacher_readers: readerStats[0].teacher_readers,
        student_readers: readerStats[0].student_readers,
        
        total_borrows: borrowStats[0].total_borrows,
        current_borrows: borrowStats[0].current_borrows,
        overdue_borrows: borrowStats[0].overdue_borrows,
        returned_borrows: borrowStats[0].returned_borrows,
        total_fines: borrowStats[0].total_fines,
        
        today_borrows: todayStats[0].today_borrows,
        today_returns: todayStats[0].today_returns,
        
        // 保留原有嵌套结构以兼容其他客户端
        details: {
          books: bookStats[0],
          readers: readerStats[0],
          borrows: borrowStats[0],
          today: todayStats[0]
        }
      }
    });

  } catch (error) {
    logger.error('获取系统概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统概览失败'
    });
  }
}));

/**
 * 获取借阅趋势统计
 */
router.get('/borrow-trend', requirePermission('REPORT_VIEW'), [
  query('days').optional().isInt({ min: 7, max: 365 }).withMessage('天数必须在7-365之间'),
  query('type').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('统计类型无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { days = 30, type = 'daily' } = req.query;

  try {
    // 构建安全的SQL查询
    let sql;
    if (type === 'weekly') {
      sql = `
        SELECT 
          YEARWEEK(borrow_date) as date_period,
          COUNT(*) as borrow_count,
          COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as return_count,
          COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_count
        FROM borrow_records 
        WHERE borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND is_deleted = 0
        GROUP BY YEARWEEK(borrow_date)
        ORDER BY date_period
      `;
    } else if (type === 'monthly') {
      sql = `
        SELECT 
          DATE_FORMAT(borrow_date, '%Y-%m') as date_period,
          COUNT(*) as borrow_count,
          COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as return_count,
          COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_count
        FROM borrow_records 
        WHERE borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND is_deleted = 0
        GROUP BY DATE_FORMAT(borrow_date, '%Y-%m')
        ORDER BY date_period
      `;
    } else { // daily
      sql = `
        SELECT 
          DATE(borrow_date) as date_period,
          COUNT(*) as borrow_count,
          COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as return_count,
          COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_count
        FROM borrow_records 
        WHERE borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND is_deleted = 0
        GROUP BY DATE(borrow_date)
        ORDER BY date_period
      `;
    }

    const trendData = await executeQuery('mysql', sql, [days]);

    res.json({
      success: true,
      message: '获取借阅趋势成功',
      data: trendData
    });

  } catch (error) {
    logger.error('获取借阅趋势失败:', error);
    res.status(500).json({
      success: false,
      message: '获取借阅趋势失败'
    });
  }
}));

/**
 * 获取图书分类统计
 */
router.get('/category-stats', requirePermission('REPORT_VIEW'), asyncHandler(async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.category_name,
        COUNT(DISTINCT b.book_id) as book_count,
        SUM(b.total_copies) as total_copies,
        SUM(b.available_copies) as available_copies,
        COUNT(br.record_id) as borrow_count,
        COUNT(CASE WHEN br.status = '借出' THEN 1 END) as current_borrows,
        ROUND(AVG(CASE 
          WHEN br.return_date IS NOT NULL 
          THEN DATEDIFF(br.return_date, br.borrow_date)
          ELSE NULL
        END), 1) as avg_borrow_days
      FROM categories c
      LEFT JOIN books b ON c.category_id = b.category_id AND b.is_deleted = 0
      LEFT JOIN borrow_records br ON b.book_id = br.book_id AND br.is_deleted = 0
      WHERE c.is_deleted = 0
      GROUP BY c.category_id, c.category_name
      ORDER BY borrow_count DESC
    `;

    const categoryStats = await executeQuery('mysql', sql);

    res.json({
      success: true,
      message: '获取分类统计成功',
      data: categoryStats
    });

  } catch (error) {
    logger.error('获取分类统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类统计失败'
    });
  }
}));

/**
 * 获取热门图书排行
 */
router.get('/popular-books', requirePermission('REPORT_VIEW'), [
  query('limit').optional().isInt({ min: 5, max: 50 }).withMessage('限制数量必须在5-50之间'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('天数必须在1-365之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { limit = 10, days } = req.query;

  try {
    let whereClause = 'br.is_deleted = 0';
    let queryParams = [];

    if (days) {
      whereClause += ' AND br.borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      queryParams.push(days);
    }

    const sql = `
      SELECT 
        b.book_id,
        b.isbn,
        b.title,
        b.author,
        b.publisher,
        c.category_name,
        COUNT(br.record_id) as borrow_count,
        b.available_copies,
        b.total_copies,
        ROUND(COUNT(br.record_id) * 100.0 / b.total_copies, 2) as popularity_rate
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.category_id
      LEFT JOIN borrow_records br ON b.book_id = br.book_id AND ${whereClause}
      WHERE b.is_deleted = 0
      GROUP BY b.book_id, b.isbn, b.title, b.author, b.publisher, c.category_name, b.available_copies, b.total_copies
      HAVING borrow_count > 0
      ORDER BY borrow_count DESC, popularity_rate DESC
      LIMIT ?
    `;

    queryParams.push(parseInt(limit));
    const popularBooks = await executeQuery('mysql', sql, queryParams);

    res.json({
      success: true,
      message: '获取热门图书成功',
      data: popularBooks
    });

  } catch (error) {
    logger.error('获取热门图书失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热门图书失败'
    });
  }
}));

/**
 * 获取活跃读者排行
 */
router.get('/active-readers', requirePermission('REPORT_VIEW'), [
  query('limit').optional().isInt({ min: 5, max: 50 }).withMessage('限制数量必须在5-50之间'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('天数必须在1-365之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { limit = 10, days } = req.query;

  try {
    let whereClause = 'br.is_deleted = 0';
    let queryParams = [];

    if (days) {
      whereClause += ' AND br.borrow_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      queryParams.push(days);
    }

    const sql = `
      SELECT 
        r.profile_id,
        r.card_number,
        r.real_name,
        r.department,
        r.membership_type,
        COUNT(br.record_id) as borrow_count,
        COUNT(CASE WHEN br.status = '借出' THEN 1 END) as current_borrows,
        COUNT(CASE WHEN br.status = '逾期' THEN 1 END) as overdue_count,
        COALESCE(SUM(br.fine_amount), 0) as total_fines,
        ROUND(AVG(CASE 
          WHEN br.return_date IS NOT NULL 
          THEN DATEDIFF(br.return_date, br.borrow_date)
          ELSE NULL
        END), 1) as avg_borrow_days
      FROM user_complete_info r LEFT JOIN borrow_records br ON r.profile_id = br.reader_id AND ${whereClause}
      WHERE r.is_deleted = 0
      GROUP BY r.profile_id, r.card_number, r.real_name, r.department, r.membership_type
      HAVING borrow_count > 0
      ORDER BY borrow_count DESC
      LIMIT ?
    `;

    queryParams.push(parseInt(limit));
    const activeReaders = await executeQuery('mysql', sql, queryParams);

    res.json({
      success: true,
      message: '获取活跃读者成功',
      data: activeReaders
    });

  } catch (error) {
    logger.error('获取活跃读者失败:', error);
    res.status(500).json({
      success: false,
      message: '获取活跃读者失败'
    });
  }
}));

/**
 * 获取逾期统计报告
 */
router.get('/overdue-report', requirePermission('REPORT_VIEW'), asyncHandler(async (req, res) => {
  try {
    // 逾期概览
    const overviewSql = `
      SELECT 
        COUNT(*) as total_overdue,
        SUM(DATEDIFF(CURDATE(), due_date)) as total_overdue_days,
        SUM(fine_amount) as total_fines,
        AVG(DATEDIFF(CURDATE(), due_date)) as avg_overdue_days
      FROM borrow_records 
      WHERE status IN ('逾期', '借出') 
      AND due_date < CURDATE() 
      AND is_deleted = 0
    `;
    const overview = await executeQuery('mysql', overviewSql);

    // 按部门统计逾期情况
    const departmentSql = `
      SELECT 
        r.department,
        COUNT(br.record_id) as overdue_count,
        SUM(DATEDIFF(CURDATE(), br.due_date)) as total_overdue_days,
        SUM(br.fine_amount) as total_fines
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      WHERE br.status IN ('逾期', '借出') 
      AND br.due_date < CURDATE() 
      AND br.is_deleted = 0
      GROUP BY r.department
      ORDER BY overdue_count DESC
    `;
    const departmentStats = await executeQuery('mysql', departmentSql);

    // 逾期天数分布
    const distributionSql = `
      SELECT 
        CASE 
          WHEN DATEDIFF(CURDATE(), due_date) <= 7 THEN '1-7天'
          WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '8-30天'
          WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '31-90天'
          ELSE '90天以上'
        END as overdue_range,
        COUNT(*) as count
      FROM borrow_records 
      WHERE status IN ('逾期', '借出') 
      AND due_date < CURDATE() 
      AND is_deleted = 0
      GROUP BY overdue_range
      ORDER BY 
        CASE overdue_range
          WHEN '1-7天' THEN 1
          WHEN '8-30天' THEN 2
          WHEN '31-90天' THEN 3
          WHEN '90天以上' THEN 4
        END
    `;
    const distribution = await executeQuery('mysql', distributionSql);

    res.json({
      success: true,
      message: '获取逾期报告成功',
      data: {
        overview: overview[0],
        departmentStats,
        distribution
      }
    });

  } catch (error) {
    logger.error('获取逾期报告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取逾期报告失败'
    });
  }
}));

/**
 * 获取同步统计报告
 */
router.get('/sync-report', requirePermission('SYNC_VIEW'), [
  query('days').optional().isInt({ min: 1, max: 90 }).withMessage('天数必须在1-90之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { days = 7 } = req.query;

  try {
    // 同步概览统计
    const overviewSql = `
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) as success_count,
        COUNT(CASE WHEN sync_status = '同步失败' THEN 1 END) as failure_count,
        COUNT(CASE WHEN sync_status = '待同步' THEN 1 END) as pending_count,
        ROUND(COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM sync_log 
      WHERE change_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const overview = await executeQuery('mysql', overviewSql, [days]);

    // 按表统计同步情况
    const tableSql = `
      SELECT 
        table_name,
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) as success_count,
        COUNT(CASE WHEN sync_status = '同步失败' THEN 1 END) as failure_count,
        ROUND(COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
      FROM sync_log 
      WHERE change_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY table_name
      ORDER BY total_syncs DESC
    `;
    const tableStats = await executeQuery('mysql', tableSql, [days]);

    // 按操作类型统计
    const operationSql = `
      SELECT 
        operation,
        COUNT(*) as count,
        COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) as success_count,
        COUNT(CASE WHEN sync_status = '同步失败' THEN 1 END) as failure_count
      FROM sync_log 
      WHERE change_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY operation
      ORDER BY count DESC
    `;
    const operationStats = await executeQuery('mysql', operationSql, [days]);

    // 每日同步趋势
    const trendSql = `
      SELECT 
        DATE(change_time) as sync_date,
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN sync_status = '同步成功' THEN 1 END) as success_count,
        COUNT(CASE WHEN sync_status = '同步失败' THEN 1 END) as failure_count
      FROM sync_log 
      WHERE change_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(change_time)
      ORDER BY sync_date
    `;
    const trendData = await executeQuery('mysql', trendSql, [days]);

    // 冲突统计
    const conflictSql = `
      SELECT 
        COUNT(*) as total_conflicts,
        COUNT(CASE WHEN resolve_status = '已解决' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN resolve_status = '待处理' THEN 1 END) as pending_count,
        COUNT(CASE WHEN resolve_status = '忽略' THEN 1 END) as ignored_count
      FROM conflict_records 
      WHERE conflict_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const conflictStats = await executeQuery('mysql', conflictSql, [days]);

    res.json({
      success: true,
      message: '获取同步报告成功',
      data: {
        overview: overview[0],
        tableStats,
        operationStats,
        trendData,
        conflicts: conflictStats[0]
      }
    });

  } catch (error) {
    logger.error('获取同步报告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步报告失败'
    });
  }
}));

/**
 * 导出报表数据
 */
router.get('/export/:type', requirePermission('REPORT_VIEW'), [
  query('format').optional().isIn(['json', 'csv']).withMessage('导出格式无效'),
  query('start_date').optional().isDate().withMessage('开始日期格式不正确'),
  query('end_date').optional().isDate().withMessage('结束日期格式不正确')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { type } = req.params;
  const { format = 'json', start_date, end_date } = req.query;

  try {
    let sql, filename, data;

    switch (type) {
      case 'borrow-records':
        sql = `
          SELECT 
            br.record_id,
            r.card_number,
            r.real_name as reader_name,
            b.title as book_title,
            b.isbn,
            br.borrow_date,
            br.due_date,
            br.return_date,
            br.status,
            br.fine_amount
          FROM borrow_records br
          LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
          LEFT JOIN books b ON br.book_id = b.book_id
          WHERE br.is_deleted = 0
        `;
        filename = 'borrow_records';
        break;

      case 'overdue-books':
        sql = `
          SELECT 
            r.card_number,
            r.real_name as reader_name,
            r.phone,
            b.title as book_title,
            b.isbn,
            br.borrow_date,
            br.due_date,
            DATEDIFF(CURDATE(), br.due_date) as overdue_days,
            br.fine_amount
          FROM borrow_records br
          LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
          LEFT JOIN books b ON br.book_id = b.book_id
          WHERE br.status IN ('逾期', '借出') 
          AND br.due_date < CURDATE() 
          AND br.is_deleted = 0
        `;
        filename = 'overdue_books';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: '不支持的报表类型'
        });
    }

    // 添加日期过滤条件
    if (start_date) {
      sql += ` AND br.borrow_date >= '${start_date}'`;
    }
    if (end_date) {
      sql += ` AND br.borrow_date <= '${end_date}'`;
    }

    sql += ' ORDER BY br.borrow_date DESC';

    data = await executeQuery('mysql', sql);

    if (format === 'csv') {
      // 生成CSV格式
      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          message: '没有数据可导出'
        });
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csvContent); // 添加BOM以支持中文
    } else {
      // JSON格式
      res.json({
        success: true,
        message: '导出成功',
        data: {
          total: data.length,
          export_time: new Date().toISOString(),
          records: data
        }
      });
    }

    logger.info(`报表导出: ${type} (${format}) by ${req.user.username}`);

  } catch (error) {
    logger.error('导出报表失败:', error);
    res.status(500).json({
      success: false,
      message: '导出报表失败'
    });
  }
}));

module.exports = router;
