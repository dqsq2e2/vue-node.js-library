const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const imageManager = require('../utils/imageManager');

const router = express.Router();

// 所有图书相关路由都需要认证
router.use(authenticate);

/**
 * 获取图书列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('size').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('search').optional().isLength({ max: 200 }).withMessage('搜索关键词长度不能超过200'),
  query('title').optional().isLength({ max: 200 }).withMessage('书名长度不能超过200'),
  query('author').optional().isLength({ max: 100 }).withMessage('作者长度不能超过100'),
  query('isbn').optional().isLength({ max: 20 }).withMessage('ISBN长度不能超过20'),
  query('publisher').optional().isLength({ max: 100 }).withMessage('出版社长度不能超过100'),
  query('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
  query('status').optional().isIn(['在库', '下架', '维修']).withMessage('状态值无效')
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
    size = 20,
    search,
    title,
    author,
    isbn,
    publisher,
    category_id,
    status,
    sort_by = 'created_time',
    sort_order = 'DESC'
  } = req.query;
  
  // 使用size参数优先，兼容前端
  const pageSize = size || limit;

  // 验证排序字段安全性
  const allowedSortFields = ['book_id', 'title', 'author', 'publisher', 'publish_date', 'created_time', 'last_updated_time'];
  const allowedSortOrders = ['ASC', 'DESC'];
  
  const safeSortBy = allowedSortFields.includes(sort_by) ? `b.${sort_by}` : 'b.created_time';
  const safeSortOrder = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

  const offset = (page - 1) * pageSize;

  try {
    // 构建查询条件
    let whereConditions = ['b.is_deleted = 0'];
    let queryParams = [];

    // 支持统一搜索和分别搜索
    if (search) {
      whereConditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    // 支持分别字段搜索
    if (title && title.toString().trim()) {
      whereConditions.push('b.title LIKE ?');
      queryParams.push(`%${title.toString().trim()}%`);
    }
    
    if (author && author.toString().trim()) {
      whereConditions.push('b.author LIKE ?');
      queryParams.push(`%${author.toString().trim()}%`);
    }
    
    if (isbn && isbn.toString().trim()) {
      whereConditions.push('b.isbn LIKE ?');
      queryParams.push(`%${isbn.toString().trim()}%`);
    }
    
    if (publisher && publisher.toString().trim()) {
      whereConditions.push('b.publisher LIKE ?');
      queryParams.push(`%${publisher.toString().trim()}%`);
    }

    if (category_id) {
      whereConditions.push('b.category_id = ?');
      queryParams.push(category_id);
    }

    if (status) {
      whereConditions.push('b.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM books b
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    // 获取图书列表
    const listSql = `
      SELECT 
        b.book_id,
        b.isbn,
        b.title,
        b.author,
        b.publisher,
        b.publish_date,
        b.category_id,
        c.category_name,
        b.total_copies,
        b.available_copies,
        b.location,
        b.price,
        b.description,
        b.cover_image,
        b.status,
        b.created_time,
        b.last_updated_time
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.category_id
      WHERE ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const books = await executeQuery('mysql', listSql, [...queryParams, parseInt(pageSize), parseInt(offset)]);

    res.json({
      success: true,
      message: '获取图书列表成功',
      data: {
        books,
        pagination: {
          page: parseInt(page),
          size: parseInt(pageSize),
          limit: parseInt(pageSize),
          total,
          pages: Math.ceil(total / pageSize)
        }
      }
    });

  } catch (error) {
    logger.error('获取图书列表失败:', error);
    logger.error('请求参数:', req.query);
    logger.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '获取图书列表失败'
    });
  }
}));

/**
 * 获取图书分类列表 (移到参数路由之前)
 */
router.get('/categories', asyncHandler(async (req, res) => {
  try {
    const sql = `
      SELECT 
        category_id,
        category_name,
        parent_id,
        description,
        sort_order,
        (SELECT COUNT(*) FROM books WHERE category_id = c.category_id AND is_deleted = 0) as book_count
      FROM categories c
      WHERE is_deleted = 0
      ORDER BY parent_id, sort_order, category_name
    `;

    const categories = await executeQuery('mysql', sql);

    res.json({
      success: true,
      message: '获取分类列表成功',
      data: categories
    });

  } catch (error) {
    logger.error('获取分类列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类列表失败'
    });
  }
}));

/**
 * 获取图书详情
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('图书ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const bookId = req.params.id;

  try {
    const sql = `
      SELECT 
        b.book_id,
        b.isbn,
        b.title,
        b.author,
        b.publisher,
        b.publish_date,
        b.category_id,
        c.category_name,
        b.total_copies,
        b.available_copies,
        b.location,
        b.price,
        b.description,
        b.status,
        b.created_time,
        b.last_updated_time,
        -- 借阅统计
        (SELECT COUNT(*) FROM borrow_records WHERE book_id = b.book_id AND is_deleted = 0) as total_borrows,
        (SELECT COUNT(*) FROM borrow_records WHERE book_id = b.book_id AND status = '借出' AND is_deleted = 0) as current_borrows
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.category_id
      WHERE b.book_id = ? AND b.is_deleted = 0
    `;

    const results = await executeQuery('mysql', sql, [bookId]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: '图书不存在'
      });
    }

    res.json({
      success: true,
      message: '获取图书详情成功',
      data: results[0]
    });

  } catch (error) {
    logger.error('获取图书详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取图书详情失败'
    });
  }
}));

/**
 * 添加图书
 */
router.post('/', requirePermission('BOOK_MANAGE'), [
  body('isbn').notEmpty().withMessage('ISBN不能为空').isLength({ max: 20 }).withMessage('ISBN长度不能超过20'),
  body('title').notEmpty().withMessage('书名不能为空').isLength({ max: 200 }).withMessage('书名长度不能超过200'),
  body('author').notEmpty().withMessage('作者不能为空').isLength({ max: 100 }).withMessage('作者长度不能超过100'),
  body('publisher').optional().isLength({ max: 100 }).withMessage('出版社长度不能超过100'),
  body('publish_date').optional().isDate().withMessage('出版日期格式不正确'),
  body('category_id').isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
  body('total_copies').optional().isInt({ min: 1 }).withMessage('总册数必须是正整数'),
  body('location').optional().isLength({ max: 100 }).withMessage('位置长度不能超过100'),
  body('price').optional().isDecimal().withMessage('价格必须是数字'),
  body('description').optional().isLength({ max: 1000 }).withMessage('描述长度不能超过1000')
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
    isbn,
    title,
    author,
    publisher,
    publish_date,
    category_id,
    total_copies = 1,
    location,
    price,
    description,
    cover_image,
    tempImageId  // 临时图片ID
  } = req.body;

  // 将undefined转换为null，避免MySQL2绑定参数错误
  const cleanedData = {
    isbn,
    title,
    author,
    publisher: publisher || null,
    publish_date: publish_date || null,
    category_id,
    total_copies,
    location: location || null,
    price: price || null,
    description: description || null,
    cover_image: cover_image || null
  };

  try {
    // 记录临时图片信息，但不立即确认保存
    let tempImageIdToConfirm = null;
    let finalCoverImage = cover_image;
    
    // 如果有tempImageId，验证并记录
    if (tempImageId) {
      const tempInfo = imageManager.getTempInfo(tempImageId);
      if (!tempInfo) {
        return res.status(400).json({
          success: false,
          message: '临时图片不存在或已过期'
        });
      }
      tempImageIdToConfirm = tempImageId;
      // 暂时使用临时URL
      finalCoverImage = cover_image;
    } 
    // 如果cover_image是临时路径，尝试从路径提取tempId
    else if (cover_image && cover_image.includes('/uploads/temp/')) {
      const tempFilename = cover_image.split('/').pop();
      const extractedTempId = tempFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
      
      const tempInfo = imageManager.getTempInfo(extractedTempId);
      if (tempInfo) {
        tempImageIdToConfirm = extractedTempId;
        finalCoverImage = cover_image;
      } else {
        logger.warn(`临时图片不存在: ${extractedTempId}，使用原路径`);
      }
    }

    // 检查ISBN是否已存在
    const existingSql = 'SELECT book_id FROM books WHERE isbn = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [isbn]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'ISBN已存在'
      });
    }

    // 检查分类是否存在
    const categorySql = 'SELECT category_id FROM categories WHERE category_id = ? AND is_deleted = 0';
    const categoryResult = await executeQuery('mysql', categorySql, [cleanedData.category_id]);
    
    if (categoryResult.length === 0) {
      return res.status(400).json({
        success: false,
        message: '图书分类不存在'
      });
    }

    // 插入图书记录
    const insertSql = `
      INSERT INTO books (
        isbn, title, author, publisher, publish_date, category_id,
        total_copies, available_copies, location, price, description, cover_image, db_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mysql')
    `;

    const result = await executeQuery('mysql', insertSql, [
      cleanedData.isbn, cleanedData.title, cleanedData.author, 
      cleanedData.publisher, cleanedData.publish_date, cleanedData.category_id,
      cleanedData.total_copies, cleanedData.total_copies, 
      cleanedData.location, cleanedData.price, cleanedData.description, finalCoverImage
    ]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('books', ?, 'INSERT', ?, 'mysql')
    `;

    const changeData = JSON.stringify({
      book_id: result.insertId,
      isbn, title, author, publisher, publish_date, category_id,
      total_copies, available_copies: total_copies, location, price, description
    });

    await executeQuery('mysql', syncLogSql, [result.insertId, changeData]);

    // 数据库插入成功后，确认保存临时图片
    if (tempImageIdToConfirm) {
      try {
        const imageResult = imageManager.confirmSave(tempImageIdToConfirm);
        logger.info(`数据库插入成功，确认保存临时图片: ${tempImageIdToConfirm} -> ${imageResult.url}`);
        
        // 更新数据库中的图片路径为正式路径
        const updateImageSql = 'UPDATE books SET cover_image = ? WHERE book_id = ?';
        await executeQuery('mysql', updateImageSql, [imageResult.url, result.insertId]);
        logger.info(`已更新图片路径到数据库: ${imageResult.url}`);
        
      } catch (imageError) {
        logger.error(`确认保存临时图片失败: ${tempImageIdToConfirm}`, imageError);
        // 不影响主流程，图片仍在临时目录
      }
    }

    logger.info(`图书添加成功: ${title} (${isbn}) by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: '图书添加成功',
      data: {
        book_id: result.insertId
      }
    });

  } catch (error) {
    logger.error('添加图书失败:', error);
    res.status(500).json({
      success: false,
      message: '添加图书失败'
    });
  }
}));

/**
 * 更新图书信息
 */
router.put('/:id', requirePermission('BOOK_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('图书ID必须是正整数'),
  body('title').optional().notEmpty().withMessage('书名不能为空').isLength({ max: 200 }).withMessage('书名长度不能超过200'),
  body('author').optional().notEmpty().withMessage('作者不能为空').isLength({ max: 100 }).withMessage('作者长度不能超过100'),
  body('publisher').optional().isLength({ max: 100 }).withMessage('出版社长度不能超过100'),
  body('publish_date').optional().isDate().withMessage('出版日期格式不正确'),
  body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
  body('total_copies').optional().isInt({ min: 1 }).withMessage('总册数必须是正整数'),
  body('location').optional().isLength({ max: 100 }).withMessage('位置长度不能超过100'),
  body('price').optional().isDecimal().withMessage('价格必须是数字'),
  body('description').optional().isLength({ max: 1000 }).withMessage('描述长度不能超过1000'),
  body('status').optional().isIn(['在库', '下架', '维修']).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const bookId = req.params.id;
  const updateData = req.body;
  const { tempImageId } = req.body;

  try {
    // 检查图书是否存在
    const existingSql = 'SELECT * FROM books WHERE book_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [bookId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '图书不存在'
      });
    }

    const currentBook = existing[0];

    // 记录临时图片信息，但不立即确认保存
    let tempImageIdToConfirm = null;
    let oldImageToDelete = null;
    
    if (tempImageId) {
      // 验证临时文件存在
      const tempInfo = imageManager.getTempInfo(tempImageId);
      if (!tempInfo) {
        return res.status(400).json({
          success: false,
          message: '临时图片不存在或已过期'
        });
      }
      tempImageIdToConfirm = tempImageId;
      oldImageToDelete = currentBook.cover_image;
      // 暂时使用临时URL，数据库成功后再确认
      // updateData.cover_image 保持为临时URL
    } 
    // 如果cover_image是临时路径，提取tempId
    else if (updateData.cover_image && updateData.cover_image.includes('/uploads/temp/')) {
      const tempFilename = updateData.cover_image.split('/').pop();
      const extractedTempId = tempFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
      
      const tempInfo = imageManager.getTempInfo(extractedTempId);
      if (tempInfo) {
        tempImageIdToConfirm = extractedTempId;
        oldImageToDelete = currentBook.cover_image;
      } else {
        logger.warn(`临时图片不存在: ${extractedTempId}，使用原路径`);
      }
    }

    // 如果更新分类，检查分类是否存在
    if (updateData.category_id) {
      const categorySql = 'SELECT category_id FROM categories WHERE category_id = ? AND is_deleted = 0';
      const categoryResult = await executeQuery('mysql', categorySql, [updateData.category_id]);
      
      if (categoryResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: '图书分类不存在'
        });
      }
    }

    // 如果更新总册数，需要检查可借数量
    if (updateData.total_copies !== undefined) {
      const borrowedCount = currentBook.total_copies - currentBook.available_copies;
      if (updateData.total_copies < borrowedCount) {
        return res.status(400).json({
          success: false,
          message: `总册数不能少于已借出数量(${borrowedCount})`
        });
      }
      updateData.available_copies = updateData.total_copies - borrowedCount;
    }

    // 构建更新SQL（排除非数据库字段）
    const updateFields = [];
    const updateValues = [];
    const excludeFields = ['book_id', 'tempImageId'];  // 排除非数据库字段

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && !excludeFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        // 确保null值而不是undefined
        const value = updateData[key] === undefined || updateData[key] === '' ? null : updateData[key];
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有需要更新的字段'
      });
    }

    updateFields.push('sync_version = sync_version + 1');
    updateValues.push(bookId);

    const updateSql = `
      UPDATE books 
      SET ${updateFields.join(', ')}
      WHERE book_id = ?
    `;

    await executeQuery('mysql', updateSql, updateValues);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('books', ?, 'UPDATE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ book_id: bookId, ...updateData });
    await executeQuery('mysql', syncLogSql, [bookId, changeData]);

    // 数据库更新成功后，确认保存临时图片并删除旧图片
    if (tempImageIdToConfirm) {
      try {
        const result = imageManager.confirmSave(tempImageIdToConfirm);
        logger.info(`数据库更新成功，确认保存临时图片: ${tempImageIdToConfirm} -> ${result.url}`);
        
        // 删除旧图片
        if (oldImageToDelete && oldImageToDelete !== result.url) {
          imageManager.deleteImage(oldImageToDelete);
          logger.info(`已删除旧图片: ${oldImageToDelete}`);
        }
        
        // 更新数据库中的图片路径为正式路径
        const updateImageSql = 'UPDATE books SET cover_image = ? WHERE book_id = ?';
        await executeQuery('mysql', updateImageSql, [result.url, bookId]);
        logger.info(`已更新图片路径到数据库: ${result.url}`);
        
      } catch (imageError) {
        logger.error(`确认保存临时图片失败: ${tempImageIdToConfirm}`, imageError);
        // 不影响主流程，图片仍在临时目录
      }
    }

    logger.info(`图书更新成功: ID=${bookId} by ${req.user.username}`);

    res.json({
      success: true,
      message: '图书更新成功'
    });

  } catch (error) {
    logger.error('更新图书失败:', error);
    res.status(500).json({
      success: false,
      message: '更新图书失败'
    });
  }
}));

/**
 * 删除图书
 */
router.delete('/:id', requirePermission('BOOK_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('图书ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const bookId = req.params.id;

  try {
    // 检查图书是否存在
    const existingSql = 'SELECT * FROM books WHERE book_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', existingSql, [bookId]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '图书不存在'
      });
    }

    const book = existing[0];

    // 检查是否有未归还的借阅记录
    const borrowSql = `
      SELECT COUNT(*) as count 
      FROM borrow_records 
      WHERE book_id = ? AND status IN ('借出', '逾期') AND is_deleted = 0
    `;
    const borrowResult = await executeQuery('mysql', borrowSql, [bookId]);
    
    if (borrowResult[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该图书还有未归还的借阅记录，无法删除'
      });
    }

    // 删除图片文件（如果存在）
    if (book.cover_image) {
      try {
        const path = require('path');
        const fs = require('fs');
        const filename = book.cover_image.split('/').pop();
        const filePath = path.join(__dirname, '../../uploads/books', filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`删除图片文件成功: ${filename}`);
        }
      } catch (error) {
        logger.warn(`删除图片文件失败: ${error.message}`);
        // 不阻断删除流程
      }
    }

    // 软删除图书
    const deleteSql = `
      UPDATE books 
      SET is_deleted = 1, sync_version = sync_version + 1
      WHERE book_id = ?
    `;

    await executeQuery('mysql', deleteSql, [bookId]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('books', ?, 'DELETE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({ book_id: bookId });
    await executeQuery('mysql', syncLogSql, [bookId, changeData]);

    logger.info(`图书删除成功: ${book.title} (ID=${bookId}) by ${req.user.username}`);

    res.json({
      success: true,
      message: '图书删除成功'
    });

  } catch (error) {
    logger.error('删除图书失败:', error);
    res.status(500).json({
      success: false,
      message: '删除图书失败'
    });
  }
}));


module.exports = router;
