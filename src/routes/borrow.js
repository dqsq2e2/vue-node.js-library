const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, requirePermission } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// 所有借阅相关路由都需要认证
router.use(authenticate);

/**
 * 获取借阅记录列表 (根路径别名)
 */
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('search').optional().isLength({ max: 200 }).withMessage('搜索关键词长度不能超过200'),
  query('reader_id').optional().isInt({ min: 1 }).withMessage('读者ID必须是正整数'),
  query('book_id').optional().isInt({ min: 1 }).withMessage('图书ID必须是正整数'),
  query('status').optional().isIn(['借出', '已还', '逾期', '续借']).withMessage('状态值无效'),
  query('start_date').optional().isISO8601().withMessage('开始日期格式无效'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式无效')
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
    search = '',
    reader_id,
    book_id,
    status,
    start_date,
    end_date
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['br.is_deleted = 0'];
    let queryParams = [];

    // 如果是读者角色，只能查看自己的借阅记录
    if (req.user.role === 'reader') {
      // 通过user_id关联查找对应的reader_id
      const readerSql = 'SELECT profile_id as reader_id FROM user_complete_info WHERE user_id = ? AND role = "reader"';
      const readerResult = await executeQuery('mysql', readerSql, [req.user.id]);
      
      if (readerResult.length === 0) {
        return res.status(403).json({
          success: false,
          message: '未找到对应的读者信息'
        });
      }
      
      whereConditions.push('br.reader_id = ?');
      queryParams.push(readerResult[0].reader_id);
    }

    if (search) {
      whereConditions.push('(r.real_name LIKE ? OR r.card_number LIKE ? OR b.title LIKE ? OR b.isbn LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (reader_id) {
      whereConditions.push('br.reader_id = ?');
      queryParams.push(reader_id);
    }

    if (book_id) {
      whereConditions.push('br.book_id = ?');
      queryParams.push(book_id);
    }

    if (status) {
      whereConditions.push('br.status = ?');
      queryParams.push(status);
    }

    if (start_date) {
      whereConditions.push('br.borrow_date >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('br.borrow_date <= ?');
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取借阅记录列表
    const listSql = `
      SELECT 
        br.record_id,
        br.reader_id,
        r.real_name as reader_name,
        r.card_number,
        br.book_id,
        b.title as book_title,
        b.isbn,
        b.author,
        br.borrow_date,
        br.due_date,
        br.return_date,
        br.renew_count,
        br.fine_amount,
        br.status,
        br.operator_id,
        u.real_name as operator_name,
        br.created_time
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      LEFT JOIN system_users u ON br.operator_id = u.user_id
      WHERE ${whereClause}
      ORDER BY br.created_time DESC
      LIMIT ? OFFSET ?
    `;

    const records = await executeQuery('mysql', listSql, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      message: '获取借阅记录成功',
      data: {
        records,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取借阅记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取借阅记录失败'
    });
  }
}));

/**
 * 获取借阅记录列表
 */
router.get('/records', requirePermission('BORROW_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('search').optional().isLength({ max: 200 }).withMessage('搜索关键词长度不能超过200'),
  query('status').optional().isIn(['借出', '已还', '逾期', '丢失']).withMessage('状态值无效'),
  query('reader_id').optional().isInt({ min: 1 }).withMessage('读者ID必须是正整数'),
  query('book_id').optional().isInt({ min: 1 }).withMessage('图书ID必须是正整数')
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
    search = '',
    status,
    reader_id,
    book_id,
    start_date,
    end_date,
    sort_by = 'borrow_date',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = ['br.is_deleted = 0'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(r.real_name LIKE ? OR r.card_number LIKE ? OR b.title LIKE ? OR b.isbn LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status) {
      whereConditions.push('br.status = ?');
      queryParams.push(status);
    }

    if (reader_id) {
      whereConditions.push('br.reader_id = ?');
      queryParams.push(reader_id);
    }

    if (book_id) {
      whereConditions.push('br.book_id = ?');
      queryParams.push(book_id);
    }

    if (start_date) {
      whereConditions.push('br.borrow_date >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('br.borrow_date <= ?');
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取借阅记录列表
    const listSql = `
      SELECT 
        br.record_id,
        br.reader_id,
        r.real_name as reader_name,
        r.card_number,
        br.book_id,
        b.title as book_title,
        b.author,
        b.isbn,
        br.borrow_date,
        br.due_date,
        br.return_date,
        br.renew_count,
        br.status,
        br.fine_amount,
        br.operator_id,
        su.real_name as operator_name,
        br.created_time,
        -- 计算逾期天数
        CASE 
          WHEN br.status IN ('借出', '逾期') AND br.due_date < CURDATE() 
          THEN DATEDIFF(CURDATE(), br.due_date)
          WHEN br.status = '已还' AND br.return_date > br.due_date
          THEN DATEDIFF(br.return_date, br.due_date)
          ELSE 0
        END as overdue_days
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      LEFT JOIN system_users su ON br.operator_id = su.user_id
      WHERE ${whereClause}
      ORDER BY br.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const records = await executeQuery('mysql', listSql, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      message: '获取借阅记录成功',
      data: {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取借阅记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取借阅记录失败'
    });
  }
}));

/**
 * 借书（读者可以为自己借书，管理员可以为任何读者借书）
 */
router.post('/', requirePermission('BORROW_SELF'), [
  body('reader_id').optional().isInt({ min: 1 }).withMessage('读者ID必须是正整数'),
  body('book_id').isInt({ min: 1 }).withMessage('图书ID必须是正整数'),
  body('due_days').optional().isInt({ min: 1, max: 365 }).withMessage('借阅天数必须在1-365之间')
], asyncHandler(async (req, res) => {
  logger.info(`借书API调用: body=${JSON.stringify(req.body)}, user=${req.user?.username}`);
  logger.info(`用户对象: ${JSON.stringify(req.user)}`);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error(`借书参数验证失败: ${JSON.stringify(errors.array())}, body=${JSON.stringify(req.body)}`);
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  // 读者自己借书时使用自己的ID，管理员可以为其他读者借书
  let { reader_id, book_id, due_days = 30 } = req.body;
  const operator_id = req.user.id;  // 用户对象中ID字段是 id
  
  logger.info(`借书请求: user=${req.user?.username}, role=${req.user?.role}, user_id=${req.user?.user_id}, id=${req.user?.id}, reader_id=${reader_id}, book_id=${book_id}, due_days=${due_days}`);
  
  // 如果是读者角色，只能为自己借书
  if (req.user.role === 'reader') {
    // 需要获取reader_profiles.profile_id，而不是system_users.user_id
    const profileResult = await executeQuery('mysql', 
      'SELECT profile_id FROM reader_profiles WHERE user_id = ?', 
      [req.user.id]
    );
    
    if (profileResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: '读者档案不存在，请联系管理员'
      });
    }
    
    reader_id = profileResult[0].profile_id;
    logger.info(`读者借书，user_id=${req.user.id}, profile_id=${reader_id}`);
  } else {
    // 管理员为其他读者借书，reader_id必须提供
    if (!reader_id) {
      return res.status(400).json({
        success: false,
        message: '管理员借书时必须指定读者ID'
      });
    }
    
    // 检查reader_id是user_id还是profile_id，并转换为profile_id
    const profileCheckSql = `
      SELECT profile_id, user_id, card_number 
      FROM reader_profiles 
      WHERE profile_id = ? OR user_id = ?
    `;
    const profileResult = await executeQuery('mysql', profileCheckSql, [reader_id, reader_id]);
    
    if (profileResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: '读者不存在或不是有效的读者'
      });
    }
    
    // 使用profile_id作为真正的reader_id
    reader_id = profileResult[0].profile_id;
    logger.info(`管理员借书，转换后的profile_id=${reader_id}, card_number=${profileResult[0].card_number}`);
  }

  try {
    // 调用存储过程进行借书
    const sql = 'CALL borrow_book(?, ?, ?, @result, @message)';
    logger.info(`调用存储过程: reader_id=${reader_id}, book_id=${book_id}, operator_id=${operator_id}`);
    await executeQuery('mysql', sql, [reader_id, book_id, operator_id]);

    // 获取存储过程返回结果
    const resultSql = 'SELECT @result as result, @message as message';
    const results = await executeQuery('mysql', resultSql);
    const { result, message } = results[0];
    
    logger.info(`存储过程返回: result=${result}, message=${message}`);

    if (result === 1) {
      // 借书成功，记录同步日志
      const recordSql = `
        SELECT record_id FROM borrow_records 
        WHERE reader_id = ? AND book_id = ? AND status = '借出' 
        ORDER BY created_time DESC LIMIT 1
      `;
      const recordResult = await executeQuery('mysql', recordSql, [reader_id, book_id]);
      
      if (recordResult.length > 0) {
        const recordId = recordResult[0].record_id;
        
        // 获取数据库中实际的借阅记录数据，确保同步日志与实际数据一致
        const actualRecordSql = `
          SELECT borrow_date, due_date, status FROM borrow_records 
          WHERE record_id = ?
        `;
        const actualRecord = await executeQuery('mysql', actualRecordSql, [recordId]);
        
        if (actualRecord.length > 0) {
          const record = actualRecord[0];
          
          const syncLogSql = `
            INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
            VALUES ('borrow_records', ?, 'INSERT', ?, 'mysql')
          `;

          const changeData = JSON.stringify({
            record_id: recordId,
            reader_id,
            book_id,
            borrow_date: record.borrow_date.toISOString().split('T')[0], // 使用数据库中的实际日期
            due_date: record.due_date.toISOString().split('T')[0],       // 添加到期日期
            status: record.status,                                        // 使用数据库中的实际状态
            operator_id
          });

          await executeQuery('mysql', syncLogSql, [recordId, changeData]);
        }
      }

      logger.info(`借书成功: reader_id=${reader_id}, book_id=${book_id} by ${req.user.username}`);

      res.json({
        success: true,
        message
      });
    } else {
      res.status(400).json({
        success: false,
        message
      });
    }

  } catch (error) {
    logger.error('借书失败:', error);
    res.status(500).json({
      success: false,
      message: '借书操作失败'
    });
  }
}));

/**
 * 还书
 */
router.post('/:id/return', requirePermission('BORROW_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('借阅记录ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const record_id = parseInt(req.params.id);
  const operator_id = req.user.id;

  // 权限检查：读者只能还自己的图书，管理员可以还任何图书
  if (req.user.role === 'reader') {
    // 检查这个借阅记录是否属于当前读者
    const checkSql = `
      SELECT br.reader_id, rp.user_id 
      FROM borrow_records br
      LEFT JOIN reader_profiles rp ON br.reader_id = rp.profile_id
      WHERE br.record_id = ? AND br.is_deleted = 0
    `;
    const checkResult = await executeQuery('mysql', checkSql, [record_id]);
    
    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: '借阅记录不存在'
      });
    }
    
    if (checkResult[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '只能归还自己的图书'
      });
    }
  } else {
    // 管理员可以归还任何图书
    logger.info(`管理员还书: record_id=${record_id}, operator=${req.user.username}`);
  }

  try {
    // 调用存储过程进行还书
    const sql = 'CALL return_book(?, ?, @result, @message)';
    await executeQuery('mysql', sql, [record_id, operator_id]);

    // 获取存储过程返回结果
    const resultSql = 'SELECT @result as result, @message as message';
    const results = await executeQuery('mysql', resultSql);
    const { result, message } = results[0];

    if (result === 1) {
      // 还书成功，记录同步日志
      const syncLogSql = `
        INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
        VALUES ('borrow_records', ?, 'UPDATE', ?, 'mysql')
      `;

      const changeData = JSON.stringify({
        record_id,
        return_date: new Date().toISOString().split('T')[0],
        status: '已还',
        operator_id
      });

      await executeQuery('mysql', syncLogSql, [record_id, changeData]);

      logger.info(`还书成功: record_id=${record_id} by ${req.user.username}`);

      res.json({
        success: true,
        message
      });
    } else {
      res.status(400).json({
        success: false,
        message
      });
    }

  } catch (error) {
    logger.error('还书失败:', error);
    res.status(500).json({
      success: false,
      message: '还书操作失败'
    });
  }
}));

/**
 * 续借（读者可以续借自己的图书，管理员可以续借任何图书）
 */
router.post('/:id/renew', requirePermission('BORROW_SELF'), [
  param('id').isInt({ min: 1 }).withMessage('借阅记录ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const record_id = parseInt(req.params.id);
  const operator_id = req.user.id;

  // 权限检查：读者只能续借自己的图书，管理员可以续借任何图书
  if (req.user.role === 'reader') {
    // 检查这个借阅记录是否属于当前读者
    const checkSql = `
      SELECT br.reader_id, rp.user_id 
      FROM borrow_records br
      LEFT JOIN reader_profiles rp ON br.reader_id = rp.profile_id
      WHERE br.record_id = ? AND br.is_deleted = 0
    `;
    const checkResult = await executeQuery('mysql', checkSql, [record_id]);
    
    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: '借阅记录不存在'
      });
    }
    
    if (checkResult[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '只能续借自己的图书'
      });
    }
  } else {
    // 管理员可以续借任何图书
    logger.info(`管理员续借: record_id=${record_id}, operator=${req.user.username}`);
  }

  try {
    // 调用存储过程进行续借
    const sql = 'CALL renew_book(?, ?, @result, @message)';
    await executeQuery('mysql', sql, [record_id, operator_id]);

    // 获取存储过程返回结果
    const resultSql = 'SELECT @result as result, @message as message';
    const results = await executeQuery('mysql', resultSql);
    const { result, message } = results[0];

    if (result === 1) {
      // 续借成功，获取更新后的记录用于同步
      const updatedRecordSql = 'SELECT * FROM borrow_records WHERE record_id = ?';
      const updatedRecord = await executeQuery('mysql', updatedRecordSql, [record_id]);
      
      // 记录同步日志
      const syncLogSql = `
        INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
        VALUES ('borrow_records', ?, 'UPDATE', ?, 'mysql')
      `;

      const changeData = JSON.stringify({
        record_id,
        renew_count: updatedRecord[0]?.renew_count || 0,
        due_date: updatedRecord[0]?.due_date,
        operator_id
      });

      await executeQuery('mysql', syncLogSql, [record_id, changeData]);

      logger.info(`续借成功: record_id=${record_id} by ${req.user.username}`);

      res.json({
        success: true,
        message
      });
    } else {
      res.status(400).json({
        success: false,
        message
      });
    }

  } catch (error) {
    logger.error('续借失败:', error);
    res.status(500).json({
      success: false,
      message: '续借操作失败'
    });
  }
}));

/**
 * 获取逾期图书列表
 */
router.get('/overdue', requirePermission('BORROW_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // 获取逾期总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      WHERE br.status IN ('借出', '逾期') 
      AND br.due_date < CURDATE() 
      AND br.is_deleted = 0
    `;
    const countResult = await executeQuery('mysql', countSql);
    const total = countResult[0].total;

    // 获取逾期列表
    const listSql = `
      SELECT 
        br.record_id,
        br.reader_id,
        r.real_name as reader_name,
        r.card_number,
        r.phone,
        br.book_id,
        b.title as book_title,
        b.author,
        b.isbn,
        br.borrow_date,
        br.due_date,
        br.renew_count,
        br.status,
        br.fine_amount,
        DATEDIFF(CURDATE(), br.due_date) as overdue_days,
        DATEDIFF(CURDATE(), br.due_date) * 0.5 as calculated_fine
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE br.status IN ('借出', '逾期') 
      AND br.due_date < CURDATE() 
      AND br.is_deleted = 0
      ORDER BY br.due_date ASC
      LIMIT ? OFFSET ?
    `;

    const overdueBooks = await executeQuery('mysql', listSql, [parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      message: '获取逾期图书列表成功',
      data: {
        overdueBooks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取逾期图书列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取逾期图书列表失败'
    });
  }
}));

/**
 * 处理逾期图书（批量更新逾期状态和罚款）
 */
router.post('/process-overdue', requirePermission('BORROW_MANAGE'), asyncHandler(async (req, res) => {
  try {
    // 调用存储过程处理逾期图书
    const sql = 'CALL process_overdue_books()';
    const results = await executeQuery('mysql', sql);
    
    const processedCount = results[0] && results[0][0] ? results[0][0]['处理的逾期记录数'] : 0;

    logger.info(`逾期图书处理完成: 处理了 ${processedCount} 条记录 by ${req.user.username}`);

    res.json({
      success: true,
      message: `逾期图书处理完成，共处理 ${processedCount} 条记录`
    });

  } catch (error) {
    logger.error('处理逾期图书失败:', error);
    res.status(500).json({
      success: false,
      message: '处理逾期图书失败'
    });
  }
}));

/**
 * 获取借阅统计信息 (别名路由)
 */
router.get('/stats', requirePermission('BORROW_VIEW'), asyncHandler(async (req, res) => {
  try {
    // 今日借阅统计
    const todayStatsSql = `
      SELECT 
        COUNT(*) as total_borrowed_today,
        COUNT(CASE WHEN status = '已还' THEN 1 END) as returned_today
      FROM borrow_records 
      WHERE DATE(borrow_date) = CURDATE() AND is_deleted = 0
    `;
    
    const todayStats = await executeQuery('mysql', todayStatsSql);

    // 总体统计
    const totalStatsSql = `
      SELECT 
        COUNT(*) as total_borrowed,
        COUNT(CASE WHEN status = '借出' THEN 1 END) as currently_borrowed,
        COUNT(CASE WHEN status = '已还' THEN 1 END) as total_returned,
        COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_count,
        AVG(DATEDIFF(IFNULL(return_date, CURDATE()), borrow_date)) as avg_borrow_days
      FROM borrow_records 
      WHERE is_deleted = 0
    `;
    
    const totalStats = await executeQuery('mysql', totalStatsSql);

    // 本月统计
    const monthStatsSql = `
      SELECT 
        COUNT(*) as month_borrowed,
        COUNT(CASE WHEN status = '已还' THEN 1 END) as month_returned
      FROM borrow_records 
      WHERE YEAR(borrow_date) = YEAR(CURDATE()) 
        AND MONTH(borrow_date) = MONTH(CURDATE()) 
        AND is_deleted = 0
    `;
    
    const monthStats = await executeQuery('mysql', monthStatsSql);

    res.json({
      success: true,
      message: '获取借阅统计成功',
      data: {
        // 扁平化数据结构，便于前端使用
        total_borrowed: totalStats[0].total_borrowed,
        currently_borrowed: totalStats[0].currently_borrowed,
        total_returned: totalStats[0].total_returned,
        overdue_count: totalStats[0].overdue_count,
        avg_borrow_days: Math.round(totalStats[0].avg_borrow_days || 0),
        
        // 今日统计
        total_borrowed_today: todayStats[0].total_borrowed_today,
        returned_today: todayStats[0].returned_today,
        
        // 本月统计
        month_borrowed: monthStats[0].month_borrowed,
        month_returned: monthStats[0].month_returned,
        
        // 保留原有嵌套结构以兼容其他客户端
        details: {
          today: todayStats[0],
          total: totalStats[0],
          month: monthStats[0]
        }
      }
    });

  } catch (error) {
    logger.error('获取借阅统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取借阅统计失败'
    });
  }
}));

/**
 * 获取借阅统计信息
 */
router.get('/statistics', authenticate, asyncHandler(async (req, res) => {
  try {
    let whereCondition = 'is_deleted = 0';
    let queryParams = [];

    // 如果是读者角色，只统计自己的记录
    if (req.user.role === 'reader') {
      // 通过user_id关联查找对应的reader_id
      const readerSql = 'SELECT profile_id as reader_id FROM user_complete_info WHERE user_id = ? AND role = "reader"';
      const readerResult = await executeQuery('mysql', readerSql, [req.user.id]);
      
      if (readerResult.length === 0) {
        return res.status(403).json({
          success: false,
          message: '未找到对应的读者信息'
        });
      }
      
      whereCondition += ' AND reader_id = ?';
      queryParams.push(readerResult[0].reader_id);
    }

    // 今日借阅统计
    const todayStatsSql = `
      SELECT 
        COUNT(CASE WHEN status = '借出' THEN 1 END) as today_borrows,
        COUNT(CASE WHEN status = '已还' AND return_date = CURDATE() THEN 1 END) as today_returns
      FROM borrow_records 
      WHERE DATE(created_time) = CURDATE() AND ${whereCondition}
    `;
    const todayStats = await executeQuery('mysql', todayStatsSql, queryParams);

    // 总体统计
    const overallStatsSql = `
      SELECT 
        COUNT(CASE WHEN status = '借出' THEN 1 END) as current_borrowed,
        COUNT(CASE WHEN status = '逾期' THEN 1 END) as overdue_count,
        COUNT(*) as total_borrowed,
        COALESCE(SUM(fine_amount), 0) as total_fines
      FROM borrow_records 
      WHERE ${whereCondition}
    `;
    const overallStats = await executeQuery('mysql', overallStatsSql, queryParams);

    // 热门图书
    const popularBooksSql = `
      SELECT 
        b.book_id,
        b.title,
        b.author,
        COUNT(br.record_id) as borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON b.book_id = br.book_id AND br.is_deleted = 0
      WHERE b.is_deleted = 0
      GROUP BY b.book_id, b.title, b.author
      ORDER BY borrow_count DESC
      LIMIT 10
    `;
    const popularBooks = await executeQuery('mysql', popularBooksSql);

    // 活跃读者
    const activeReadersSql = `
      SELECT 
        r.profile_id as reader_id,
        r.real_name as name,
        r.card_number,
        COUNT(br.record_id) as borrow_count
      FROM user_complete_info r
      LEFT JOIN borrow_records br ON r.profile_id = br.reader_id AND br.is_deleted = 0
      WHERE r.role = 'reader'
      GROUP BY r.profile_id, r.real_name, r.card_number
      ORDER BY borrow_count DESC
      LIMIT 10
    `;
    const activeReaders = await executeQuery('mysql', activeReadersSql);

    // 如果是读者角色，返回简化的个人统计
    if (req.user.role === 'reader') {
      res.json({
        success: true,
        message: '获取个人借阅统计成功',
        data: {
          total_borrowed: overallStats[0].total_borrowed,
          current_borrowed: overallStats[0].current_borrowed,
          overdue_count: overallStats[0].overdue_count,
          total_fines: overallStats[0].total_fines,
          today_borrows: todayStats[0].today_borrows,
          today_returns: todayStats[0].today_returns
        }
      });
    } else {
      // 管理员返回完整统计
      res.json({
        success: true,
        message: '获取借阅统计成功',
        data: {
          today: todayStats[0],
          overall: overallStats[0],
          popularBooks,
          activeReaders
        }
      });
    }

  } catch (error) {
    logger.error('获取借阅统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取借阅统计失败'
    });
  }
}));

/**
 * 获取逾期记录列表
 */
router.get('/overdue', requirePermission('BORROW_VIEW'), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('reader_name').optional().isLength({ max: 50 }).withMessage('读者姓名长度不能超过50'),
  query('book_title').optional().isLength({ max: 200 }).withMessage('图书名称长度不能超过200'),
  query('overdue_range').optional().isIn(['1-7', '8-30', '31-90', '90+']).withMessage('逾期范围无效'),
  query('process_status').optional().isIn(['pending', 'notified', 'processed']).withMessage('处理状态无效')
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
    reader_name,
    book_title,
    overdue_range,
    process_status
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // 构建查询条件
    let whereConditions = [
      'br.is_deleted = 0',
      'br.status IN ("借出", "逾期")',
      'br.due_date < CURDATE()'
    ];
    let queryParams = [];

    if (reader_name) {
      whereConditions.push('r.real_name LIKE ?');
      queryParams.push(`%${reader_name}%`);
    }

    if (book_title) {
      whereConditions.push('b.title LIKE ?');
      queryParams.push(`%${book_title}%`);
    }

    // 逾期天数范围
    if (overdue_range) {
      switch (overdue_range) {
        case '1-7':
          whereConditions.push('DATEDIFF(CURDATE(), br.due_date) BETWEEN 1 AND 7');
          break;
        case '8-30':
          whereConditions.push('DATEDIFF(CURDATE(), br.due_date) BETWEEN 8 AND 30');
          break;
        case '31-90':
          whereConditions.push('DATEDIFF(CURDATE(), br.due_date) BETWEEN 31 AND 90');
          break;
        case '90+':
          whereConditions.push('DATEDIFF(CURDATE(), br.due_date) > 90');
          break;
      }
    }

    if (process_status) {
      whereConditions.push('COALESCE(br.process_status, "pending") = ?');
      queryParams.push(process_status);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取逾期记录列表
    const listSql = `
      SELECT 
        br.record_id,
        br.reader_id,
        r.real_name as reader_name,
        r.card_number as reader_card_number,
        r.phone as reader_phone,
        br.book_id,
        b.title as book_title,
        b.isbn as book_isbn,
        br.borrow_date,
        br.due_date,
        br.fine_amount,
        COALESCE(br.process_status, 'pending') as process_status,
        DATEDIFF(CURDATE(), br.due_date) as overdue_days,
        br.created_time
      FROM borrow_records br
      LEFT JOIN user_complete_info r ON br.reader_id = r.profile_id
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
      ORDER BY br.due_date ASC
      LIMIT ? OFFSET ?
    `;
    
    const records = await executeQuery('mysql', listSql, [...queryParams, limit, offset]);

    // 统计数据
    const statsSql = `
      SELECT 
        COUNT(*) as total_overdue,
        SUM(DATEDIFF(CURDATE(), br.due_date) * 0.5) as total_fine,
        AVG(DATEDIFF(CURDATE(), br.due_date)) as avg_overdue_days,
        COUNT(CASE WHEN DATE(br.last_updated_time) = CURDATE() AND br.process_status = 'processed' THEN 1 END) as processed_today
      FROM borrow_records br
      WHERE br.is_deleted = 0 
        AND br.status IN ('借出', '逾期') 
        AND br.due_date < CURDATE()
    `;
    const statsResult = await executeQuery('mysql', statsSql);

    res.json({
      success: true,
      message: '获取逾期记录成功',
      data: {
        records,
        total,
        stats: statsResult[0],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取逾期记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取逾期记录失败'
    });
  }
}));

/**
 * 通知逾期读者
 */
router.post('/:id/notify', requirePermission('BORROW_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('借阅记录ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  try {
    // 更新处理状态为已通知
    const updateSql = `
      UPDATE borrow_records 
      SET process_status = 'notified', last_updated_time = NOW()
      WHERE record_id = ? AND is_deleted = 0
    `;
    
    await executeQuery('mysql', updateSql, [id]);

    logger.info(`逾期通知发送成功: 借阅记录ID=${id} by ${req.user.username}`);

    res.json({
      success: true,
      message: '通知发送成功'
    });

  } catch (error) {
    logger.error('发送逾期通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送逾期通知失败'
    });
  }
}));

/**
 * 处理逾期记录
 */
router.post('/:id/process', requirePermission('BORROW_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('借阅记录ID必须是正整数'),
  body('fine_amount').isFloat({ min: 0 }).withMessage('罚金金额必须是非负数'),
  body('process_type').isIn(['return', 'fine_only', 'waive']).withMessage('处理方式无效'),
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

  const { id } = req.params;
  const { fine_amount, process_type, remarks } = req.body;

  try {
    let updateSql, updateParams;

    if (process_type === 'return') {
      // 归还处理
      updateSql = `
        UPDATE borrow_records 
        SET status = '已还', 
            return_date = CURDATE(),
            fine_amount = ?,
            process_status = 'processed',
            last_updated_time = NOW()
        WHERE record_id = ? AND is_deleted = 0
      `;
      updateParams = [fine_amount, id];
    } else {
      // 仅收罚金或免除罚金
      updateSql = `
        UPDATE borrow_records 
        SET fine_amount = ?,
            process_status = 'processed',
            last_updated_time = NOW()
        WHERE record_id = ? AND is_deleted = 0
      `;
      updateParams = [process_type === 'waive' ? 0 : fine_amount, id];
    }
    
    await executeQuery('mysql', updateSql, updateParams);

    logger.info(`逾期处理成功: 借阅记录ID=${id}, 处理方式=${process_type} by ${req.user.username}`);

    res.json({
      success: true,
      message: '处理成功'
    });

  } catch (error) {
    logger.error('处理逾期记录失败:', error);
    res.status(500).json({
      success: false,
      message: '处理逾期记录失败'
    });
  }
}));

/**
 * 获取读者当前借阅情况
 */
router.get('/reader/:reader_id/current', [
  param('reader_id').isInt({ min: 1 }).withMessage('读者ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const readerId = req.params.reader_id;

  // 权限检查：读者只能查看自己的借阅情况
  if (req.user.role === 'reader') {
    // 这里需要根据实际业务逻辑检查读者ID与用户ID的关联
    // 暂时简化处理
  }

  try {
    const sql = `
      SELECT 
        br.record_id,
        br.book_id,
        b.title,
        b.author,
        b.isbn,
        br.borrow_date,
        br.due_date,
        br.renew_count,
        br.status,
        br.fine_amount,
        CASE 
          WHEN br.due_date < CURDATE() THEN DATEDIFF(CURDATE(), br.due_date)
          ELSE 0
        END as overdue_days
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE br.reader_id = ? 
      AND br.status IN ('借出', '逾期') 
      AND br.is_deleted = 0
      ORDER BY br.due_date ASC
    `;

    const currentBorrows = await executeQuery('mysql', sql, [readerId]);

    res.json({
      success: true,
      message: '获取当前借阅情况成功',
      data: currentBorrows
    });

  } catch (error) {
    logger.error('获取当前借阅情况失败:', error);
    res.status(500).json({
      success: false,
      message: '获取当前借阅情况失败'
    });
  }
}));

module.exports = router;
