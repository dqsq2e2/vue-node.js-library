const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * 图片管理工具类
 * 处理临时上传、确认保存、回滚等操作
 */
class ImageManager {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads/books');
    this.tempDir = path.join(__dirname, '../../uploads/temp');
    
    // 确保目录存在
    this.ensureDirectories();
    
    // 临时文件映射 { tempId: { tempPath, originalPath, confirmed: false } }
    this.tempFiles = new Map();
    
    // 定期清理过期临时文件（30分钟）
    this.startCleanupTimer();
  }

  /**
   * 确保必要目录存在
   */
  ensureDirectories() {
    [this.uploadsDir, this.tempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 生成临时文件ID
   */
  generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 保存上传的文件到临时目录
   * @param {Object} file - multer文件对象
   * @param {string} originalImagePath - 原始图片路径（用于回滚）
   * @returns {Object} - { tempId, tempUrl, originalPath }
   */
  saveToTemp(file, originalImagePath = null) {
    const tempId = this.generateTempId();
    const ext = path.extname(file.originalname);
    const tempFilename = `${tempId}${ext}`;
    const tempPath = path.join(this.tempDir, tempFilename);
    
    // 文件已经在临时目录，只需重命名为标准格式
    if (file.path !== tempPath) {
      fs.renameSync(file.path, tempPath);
    }
    
    // 记录临时文件信息
    this.tempFiles.set(tempId, {
      tempPath,
      tempFilename,
      originalPath: originalImagePath,
      uploadTime: Date.now(),
      confirmed: false
    });

    logger.info(`图片保存到临时目录: ${tempId}`, {
      originalName: file.originalname,
      tempPath,
      originalPath: originalImagePath
    });

    return {
      tempId,
      tempUrl: `/uploads/temp/${tempFilename}`,
      tempFilename,
      originalPath: originalImagePath
    };
  }

  /**
   * 确认保存临时文件到正式目录（不删除原文件）
   * @param {string} tempId - 临时文件ID
   * @param {string} finalFilename - 最终文件名（可选）
   * @returns {Object} - { url: 最终图片URL, oldImagePath: 需要删除的旧图片路径 }
   */
  confirmSave(tempId, finalFilename = null) {
    const tempInfo = this.tempFiles.get(tempId);
    if (!tempInfo) {
      throw new Error('临时文件不存在或已过期');
    }

    if (!fs.existsSync(tempInfo.tempPath)) {
      throw new Error('临时文件已被删除');
    }

    // 生成最终文件名
    if (!finalFilename) {
      const ext = path.extname(tempInfo.tempFilename);
      finalFilename = `book-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    }

    const finalPath = path.join(this.uploadsDir, finalFilename);
    const finalUrl = `/uploads/books/${finalFilename}`;

    try {
      // 移动临时文件到正式目录
      fs.renameSync(tempInfo.tempPath, finalPath);

      // 标记为已确认
      tempInfo.confirmed = true;
      this.tempFiles.delete(tempId);
      
      logger.info(`图片确认保存: ${tempId} -> ${finalFilename}`, {
        tempPath: tempInfo.tempPath,
        finalPath,
        finalUrl,
        originalPath: tempInfo.originalPath
      });

      // 返回新图片URL和需要删除的旧图片路径
      return {
        url: finalUrl,
        oldImagePath: tempInfo.originalPath
      };
      
    } catch (error) {
      logger.error(`图片确认保存失败: ${tempId}`, error);
      throw error;
    }
  }

  /**
   * 确认保存并删除旧图片（用于向后兼容）
   * @param {string} tempId - 临时文件ID
   * @param {string} finalFilename - 最终文件名（可选）
   * @returns {string} - 最终图片URL
   */
  confirmSaveAndDelete(tempId, finalFilename = null) {
    const result = this.confirmSave(tempId, finalFilename);
    
    // 删除旧图片
    if (result.oldImagePath) {
      this.deleteImage(result.oldImagePath);
    }
    
    return result.url;
  }

  /**
   * 取消临时文件（回滚操作）
   * @param {string} tempId - 临时文件ID
   */
  cancelTemp(tempId) {
    const tempInfo = this.tempFiles.get(tempId);
    if (!tempInfo) {
      logger.warn(`尝试取消不存在的临时文件: ${tempId}`);
      return;
    }

    // 删除临时文件
    if (fs.existsSync(tempInfo.tempPath)) {
      fs.unlinkSync(tempInfo.tempPath);
    }

    this.tempFiles.delete(tempId);

    logger.info(`临时文件已取消: ${tempId}`, {
      tempPath: tempInfo.tempPath
    });
  }

  /**
   * 获取临时文件信息
   * @param {string} tempId - 临时文件ID
   * @returns {Object|null} - 临时文件信息
   */
  getTempInfo(tempId) {
    return this.tempFiles.get(tempId) || null;
  }

  /**
   * 清理过期的临时文件
   */
  cleanupExpiredTemp() {
    const now = Date.now();
    const expireTime = 30 * 60 * 1000; // 30分钟

    let cleanedCount = 0;
    for (const [tempId, tempInfo] of this.tempFiles.entries()) {
      if (now - tempInfo.uploadTime > expireTime && !tempInfo.confirmed) {
        try {
          if (fs.existsSync(tempInfo.tempPath)) {
            fs.unlinkSync(tempInfo.tempPath);
          }
          this.tempFiles.delete(tempId);
          cleanedCount++;
        } catch (error) {
          logger.error(`清理临时文件失败: ${tempId}`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了 ${cleanedCount} 个过期临时文件`);
    }
  }

  /**
   * 启动定期清理定时器
   */
  startCleanupTimer() {
    // 每10分钟清理一次过期文件
    setInterval(() => {
      this.cleanupExpiredTemp();
    }, 10 * 60 * 1000);

    logger.info('图片管理器已启动，定期清理临时文件');
  }

  /**
   * 删除指定图片文件
   * @param {string} imagePath - 图片路径
   */
  deleteImage(imagePath) {
    if (!imagePath) return;

    const filename = path.basename(imagePath);
    const fullPath = path.join(this.uploadsDir, filename);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`图片已删除: ${filename}`);
    }
  }
}

// 创建单例
const imageManager = new ImageManager();

module.exports = imageManager;
