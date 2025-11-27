const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * 获取分类列表
 */
router.get('/', authenticate, [
  query('search').optional().isLength({ max: 100 }).withMessage('搜索关键词长度不能超过100'),
  query('parent_id').optional().isInt({ min: 0 }).withMessage('父分类ID必须是非负整数'),
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

  const {
    search,
    parent_id,
    page = 1,
    limit = 50
  } = req.query;

  try {
    const offset = (page - 1) * limit;
    const whereConditions = ['c.is_deleted = 0'];
    const queryParams = [];

    // 搜索条件
    if (search) {
      whereConditions.push('(c.category_name LIKE ? OR c.description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // 父分类筛选
    if (parent_id !== undefined) {
      whereConditions.push('c.parent_id = ?');
      queryParams.push(parent_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // 查询分类列表
    const sql = `
      SELECT 
        c.category_id,
        c.category_name,
        c.parent_id,
        c.description,
        c.sort_order,
        c.created_time,
        c.last_updated_time,
        (SELECT category_name FROM categories WHERE category_id = c.parent_id) as parent_name,
        (SELECT COUNT(*) FROM books WHERE category_id = c.category_id AND is_deleted = 0) as book_count
      FROM categories c
      WHERE ${whereClause}
      ORDER BY c.parent_id, c.sort_order, c.category_name
      LIMIT ? OFFSET ?
    `;

    const categories = await executeQuery('mysql', sql, [...queryParams, parseInt(limit), offset]);

    // 查询总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM categories c
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery('mysql', countSql, queryParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      message: '获取分类列表成功',
      data: {
        categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
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
 * 获取所有分类（树形结构）
 */
router.get('/tree', authenticate, asyncHandler(async (req, res) => {
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

    // 构建树形结构
    const buildTree = (items, parentId = 0) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.category_id)
        }));
    };

    const tree = buildTree(categories);

    res.json({
      success: true,
      message: '获取分类树成功',
      data: tree
    });

  } catch (error) {
    logger.error('获取分类树失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类树失败'
    });
  }
}));

/**
 * 获取单个分类详情
 */
router.get('/:id', authenticate, [
  param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const categoryId = parseInt(req.params.id);

  try {
    const sql = `
      SELECT 
        c.category_id,
        c.category_name,
        c.parent_id,
        c.description,
        c.sort_order,
        c.created_time,
        c.last_updated_time,
        (SELECT category_name FROM categories WHERE category_id = c.parent_id) as parent_name,
        (SELECT COUNT(*) FROM books WHERE category_id = c.category_id AND is_deleted = 0) as book_count
      FROM categories c
      WHERE c.category_id = ? AND c.is_deleted = 0
    `;

    const result = await executeQuery('mysql', sql, [categoryId]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    res.json({
      success: true,
      message: '获取分类详情成功',
      data: result[0]
    });

  } catch (error) {
    logger.error('获取分类详情失败:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: '获取分类详情失败'
    });
  }
}));

/**
 * 创建分类
 */
router.post('/', requirePermission('BOOK_MANAGE'), [
  body('category_name').notEmpty().withMessage('分类名称不能为空').isLength({ max: 50 }).withMessage('分类名称长度不能超过50'),
  body('parent_id').optional().isInt({ min: 0 }).withMessage('父分类ID必须是非负整数'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('排序序号必须是非负整数')
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
    category_name,
    parent_id = 0,
    description,
    sort_order = 0
  } = req.body;

  try {
    // 检查分类名称是否已存在（同一父分类下）
    const checkSql = `
      SELECT category_id 
      FROM categories 
      WHERE category_name = ? AND parent_id = ? AND is_deleted = 0
    `;
    const existing = await executeQuery('mysql', checkSql, [category_name, parent_id]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类名称已存在'
      });
    }

    // 如果有父分类，检查父分类是否存在
    if (parent_id > 0) {
      const parentCheckSql = 'SELECT category_id FROM categories WHERE category_id = ? AND is_deleted = 0';
      const parentResult = await executeQuery('mysql', parentCheckSql, [parent_id]);
      
      if (parentResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: '父分类不存在'
        });
      }
    }

    // 插入分类
    const insertSql = `
      INSERT INTO categories (
        category_name, parent_id, description, sort_order, db_source
      ) VALUES (?, ?, ?, ?, 'mysql')
    `;

    const result = await executeQuery('mysql', insertSql, [
      category_name,
      parent_id,
      description || null,
      sort_order
    ]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('categories', ?, 'INSERT', ?, 'mysql')
    `;

    const changeData = JSON.stringify({
      category_id: result.insertId,
      category_name,
      parent_id,
      description,
      sort_order
    });

    await executeQuery('mysql', syncLogSql, [result.insertId, changeData]);

    logger.info(`创建分类成功: ${category_name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: '创建分类成功',
      data: {
        category_id: result.insertId
      }
    });

  } catch (error) {
    logger.error('创建分类失败:', error?.message || 'Unknown error');
    logger.error('错误详情:', error?.stack || 'No stack trace');
    res.status(500).json({
      success: false,
      message: '创建分类失败'
    });
  }
}));

/**
 * 更新分类
 */
router.put('/:id', requirePermission('BOOK_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
  body('category_name').optional().isLength({ max: 50 }).withMessage('分类名称长度不能超过50'),
  body('parent_id').optional().isInt({ min: 0 }).withMessage('父分类ID必须是非负整数'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('排序序号必须是非负整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const categoryId = parseInt(req.params.id);
  const {
    category_name,
    parent_id,
    description,
    sort_order
  } = req.body;

  try {
    // 检查分类是否存在
    const checkSql = 'SELECT category_id, category_name FROM categories WHERE category_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', checkSql, [categoryId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    // 如果修改了父分类，检查是否会造成循环引用
    if (parent_id !== undefined && parent_id > 0) {
      if (parent_id === categoryId) {
        return res.status(400).json({
          success: false,
          message: '不能将分类设置为自己的子分类'
        });
      }

      // 检查父分类是否存在
      const parentCheckSql = 'SELECT category_id FROM categories WHERE category_id = ? AND is_deleted = 0';
      const parentResult = await executeQuery('mysql', parentCheckSql, [parent_id]);
      
      if (parentResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: '父分类不存在'
        });
      }

      // TODO: 检查是否会造成循环引用（父分类的祖先中不能包含当前分类）
    }

    // 如果修改了分类名称，检查是否重复
    if (category_name && category_name !== existing[0].category_name) {
      const nameCheckSql = `
        SELECT category_id 
        FROM categories 
        WHERE category_name = ? AND parent_id = ? AND category_id != ? AND is_deleted = 0
      `;
      const nameResult = await executeQuery('mysql', nameCheckSql, [
        category_name,
        parent_id !== undefined ? parent_id : 0,
        categoryId
      ]);

      if (nameResult.length > 0) {
        return res.status(400).json({
          success: false,
          message: '该分类名称已存在'
        });
      }
    }

    // 构建更新SQL
    const updateFields = [];
    const updateParams = [];

    if (category_name !== undefined) {
      updateFields.push('category_name = ?');
      updateParams.push(category_name);
    }
    if (parent_id !== undefined) {
      updateFields.push('parent_id = ?');
      updateParams.push(parent_id);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateParams.push(sort_order);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有需要更新的字段'
      });
    }

    const updateSql = `
      UPDATE categories 
      SET ${updateFields.join(', ')}
      WHERE category_id = ?
    `;

    await executeQuery('mysql', updateSql, [...updateParams, categoryId]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('categories', ?, 'UPDATE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({
      category_id: categoryId,
      category_name,
      parent_id,
      description,
      sort_order
    });

    await executeQuery('mysql', syncLogSql, [categoryId, changeData]);

    logger.info(`更新分类成功: ${categoryId} by ${req.user.username}`);

    res.json({
      success: true,
      message: '更新分类成功'
    });

  } catch (error) {
    logger.error('更新分类失败:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: '更新分类失败'
    });
  }
}));

/**
 * 删除分类
 */
router.delete('/:id', requirePermission('BOOK_MANAGE'), [
  param('id').isInt({ min: 1 }).withMessage('分类ID必须是正整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  const categoryId = parseInt(req.params.id);

  try {
    // 检查分类是否存在
    const checkSql = 'SELECT category_id FROM categories WHERE category_id = ? AND is_deleted = 0';
    const existing = await executeQuery('mysql', checkSql, [categoryId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    // 检查是否有子分类
    const childCheckSql = 'SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND is_deleted = 0';
    const childResult = await executeQuery('mysql', childCheckSql, [categoryId]);

    if (childResult[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类下还有子分类，无法删除'
      });
    }

    // 检查是否有图书使用该分类
    const bookCheckSql = 'SELECT COUNT(*) as count FROM books WHERE category_id = ? AND is_deleted = 0';
    const bookResult = await executeQuery('mysql', bookCheckSql, [categoryId]);

    if (bookResult[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `该分类下还有 ${bookResult[0].count} 本图书，无法删除`
      });
    }

    // 软删除分类
    const deleteSql = 'UPDATE categories SET is_deleted = 1 WHERE category_id = ?';
    await executeQuery('mysql', deleteSql, [categoryId]);

    // 记录同步日志
    const syncLogSql = `
      INSERT INTO sync_log (table_name, record_id, operation, change_data, source_db)
      VALUES ('categories', ?, 'DELETE', ?, 'mysql')
    `;

    const changeData = JSON.stringify({
      category_id: categoryId
    });

    await executeQuery('mysql', syncLogSql, [categoryId, changeData]);

    logger.info(`删除分类成功: ${categoryId} by ${req.user.username}`);

    res.json({
      success: true,
      message: '删除分类成功'
    });

  } catch (error) {
    logger.error('删除分类失败:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: '删除分类失败'
    });
  }
}));

module.exports = router;
