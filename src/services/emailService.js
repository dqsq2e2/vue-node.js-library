const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * 邮件服务类
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.isConfigured = false;
    this.init();
  }

  /**
   * 初始化邮件传输器
   */
  init() {
    try {
      // 检查是否配置了邮件服务
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        logger.warn('邮件服务未配置，邮件功能将不可用');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // 验证配置
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('邮件服务配置验证失败:', error.message);
          this.initialized = false;
        } else {
          logger.info('邮件服务初始化成功');
          this.initialized = true;
          this.isConfigured = true;
        }
      });
    } catch (error) {
      logger.error('邮件服务初始化失败:', error.message);
      this.initialized = false;
    }
  }

  /**
   * 验证邮件服务连接
   * @returns {Promise<boolean>} - 验证结果
   */
  async verifyConnection() {
    if (!this.transporter) {
      return false;
    }
    
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('邮件服务连接验证失败:', error.message);
      return false;
    }
  }

  /**
   * 发送邮件
   * @param {Object} options - 邮件选项
   * @param {string} options.to - 收件人邮箱
   * @param {string} options.subject - 邮件主题
   * @param {string} options.text - 纯文本内容
   * @param {string} options.html - HTML内容
   * @returns {Promise<Object>} - 发送结果
   */
  async sendMail({ to, subject, text, html }) {
    if (!this.initialized) {
      throw new Error('邮件服务未初始化或配置不正确');
    }

    try {
      const mailOptions = {
        from: `"图书管理系统" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        text,
        html: html || text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`邮件发送成功: ${to} - ${subject}`);
      return {
        success: true,
        messageId: info.messageId,
        message: '邮件发送成功'
      };
    } catch (error) {
      logger.error(`邮件发送失败: ${to} - ${subject}`, error.message);
      throw error;
    }
  }

  /**
   * 发送测试邮件
   * @param {string} to - 收件人邮箱
   * @returns {Promise<Object>} - 发送结果
   */
  async sendTestEmail(to) {
    const subject = '图书管理系统 - 测试邮件';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📚 图书管理系统</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">邮件服务测试</h2>
          <p style="color: #666; line-height: 1.6;">
            您好！
          </p>
          <p style="color: #666; line-height: 1.6;">
            这是一封来自图书管理系统的测试邮件。如果您收到这封邮件，说明邮件服务配置成功！
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>系统版本：</strong>1.0.0</p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            这是一封自动发送的邮件，请勿回复。
          </p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to,
      subject,
      html
    });
  }

  /**
   * 发送注册验证码邮件
   * @param {string} to - 收件人邮箱
   * @param {string} code - 验证码
   * @returns {Promise<Object>} - 发送结果
   */
  async sendVerificationCode(to, code) {
    const subject = '图书管理系统 - 注册验证码';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📚 图书管理系统</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">注册验证码</h2>
          <p style="color: #666; line-height: 1.6;">
            您好！感谢您注册图书管理系统。
          </p>
          <p style="color: #666; line-height: 1.6;">
            您的验证码是：
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #666; line-height: 1.6;">
            验证码有效期为 <strong>10分钟</strong>，请尽快完成注册。
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            如果这不是您的操作，请忽略此邮件。
          </p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to,
      subject,
      html
    });
  }

  /**
   * 发送逾期通知邮件
   * @param {string} to - 收件人邮箱
   * @param {Object} bookInfo - 图书信息
   * @returns {Promise<Object>} - 发送结果
   */
  async sendOverdueNotification(to, bookInfo) {
    const subject = '图书管理系统 - 图书逾期提醒';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">⚠️ 图书逾期提醒</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">尊敬的读者：</h2>
          <p style="color: #666; line-height: 1.6;">
            您借阅的图书已逾期，请尽快归还。
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>图书名称：</strong>${bookInfo.title}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>借阅日期：</strong>${bookInfo.borrowDate}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>应还日期：</strong>${bookInfo.dueDate}</p>
            <p style="margin: 10px 0 0 0; color: #f5576c;"><strong>逾期天数：</strong>${bookInfo.overdueDays} 天</p>
            ${bookInfo.fine ? `<p style="margin: 10px 0 0 0; color: #f5576c;"><strong>逾期罚款：</strong>¥${bookInfo.fine}</p>` : ''}
          </div>
          <p style="color: #666; line-height: 1.6;">
            请您尽快到图书馆归还图书，避免产生更多罚款。
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            这是一封自动发送的邮件，请勿回复。
          </p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to,
      subject,
      html
    });
  }

  /**
   * 发送数据同步冲突通知邮件
   * @param {string} to - 收件人邮箱
   * @param {Object} conflictInfo - 冲突信息
   * @returns {Promise<Object>} - 发送结果
   */
  async sendSyncConflictNotification(to, conflictInfo) {
    const subject = '图书管理系统 - 数据同步冲突通知';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">⚠️ 数据同步冲突</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">系统管理员：</h2>
          <p style="color: #666; line-height: 1.6;">
            检测到数据同步冲突，需要人工处理。
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>表名：</strong>${conflictInfo.tableName}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>记录ID：</strong>${conflictInfo.recordId}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>冲突时间：</strong>${conflictInfo.conflictTime}</p>
            <p style="margin: 10px 0 0 0; color: #333;"><strong>冲突类型：</strong>${conflictInfo.conflictType}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            请登录系统查看详情并处理冲突。
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            这是一封自动发送的邮件，请勿回复。
          </p>
        </div>
      </div>
    `;

    return await this.sendMail({
      to,
      subject,
      html
    });
  }
}

// 创建单例
const emailService = new EmailService();

module.exports = emailService;
