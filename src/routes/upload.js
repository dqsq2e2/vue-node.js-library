const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const imageManager = require('../utils/imageManager');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/books');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储（临时目录）
const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // 生成临时文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'temp-' + uniqueSuffix + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 只允许图片文件
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只能上传图片文件'), false);
  }
};

// 配置multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  }
});

// 所有上传路由都需要认证
router.use(authenticate);

/**
 * 上传图书封面图片（临时上传）
 */
router.post('/book-cover', requirePermission('BOOK_MANAGE'), upload.single('cover'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的图片文件'
      });
    }

    // 获取原始图片路径（用于回滚）
    const originalImagePath = req.body.originalImagePath || null;

    // 保存到临时目录并记录
    const tempResult = imageManager.saveToTemp(req.file, originalImagePath);

    logger.info(`图书封面临时上传成功: ${tempResult.tempId}`, {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user.user_id,
      originalImagePath
    });

    res.json({
      success: true,
      message: '图片上传成功',
      data: {
        tempId: tempResult.tempId,
        url: tempResult.tempUrl,  // 前端直接使用此URL预览
        tempUrl: tempResult.tempUrl,
        filename: tempResult.tempFilename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        originalPath: tempResult.originalPath
      }
    });

  } catch (error) {
    logger.error('图书封面上传失败:', error);
    res.status(500).json({
      success: false,
      message: '图片上传失败',
      error: error.message
    });
  }
}));

/**
 * 确认保存临时图片
 */
router.post('/book-cover/confirm', requirePermission('BOOK_MANAGE'), asyncHandler(async (req, res) => {
  try {
    const { tempId, finalFilename } = req.body;

    if (!tempId) {
      return res.status(400).json({
        success: false,
        message: '临时文件ID不能为空'
      });
    }

    // 确认保存
    const finalUrl = imageManager.confirmSave(tempId, finalFilename);

    logger.info(`图片确认保存成功: ${tempId}`, {
      finalUrl,
      confirmedBy: req.user.user_id
    });

    res.json({
      success: true,
      message: '图片保存成功',
      data: {
        url: finalUrl
      }
    });

  } catch (error) {
    logger.error('图片确认保存失败:', error);
    res.status(500).json({
      success: false,
      message: '图片保存失败',
      error: error.message
    });
  }
}));

/**
 * 取消临时图片
 */
router.delete('/book-cover/temp/:tempId', requirePermission('BOOK_MANAGE'), asyncHandler(async (req, res) => {
  try {
    const { tempId } = req.params;

    // 取消临时文件
    imageManager.cancelTemp(tempId);

    logger.info(`临时图片已取消: ${tempId}`, {
      cancelledBy: req.user.user_id
    });

    res.json({
      success: true,
      message: '临时图片已取消'
    });

  } catch (error) {
    logger.error('取消临时图片失败:', error);
    res.status(500).json({
      success: false,
      message: '取消失败',
      error: error.message
    });
  }
}));

/**
 * 删除图书封面图片
 */
router.delete('/book-cover/:filename', requirePermission('BOOK_MANAGE'), asyncHandler(async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 删除文件
    fs.unlinkSync(filePath);

    logger.info(`图书封面删除成功: ${filename}`, {
      deletedBy: req.user.user_id
    });

    res.json({
      success: true,
      message: '图片删除成功'
    });

  } catch (error) {
    logger.error('图书封面删除失败:', error);
    res.status(500).json({
      success: false,
      message: '图片删除失败',
      error: error.message
    });
  }
}));

module.exports = router;
