const winston = require('winston');
const path = require('path');

// 创建日志目录
const logDir = 'logs';
require('fs').mkdirSync(logDir, { recursive: true });

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    if (Object.keys(meta).length > 0 && meta.service !== 'library-management' && meta.service !== 'sync-service') {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'library-management' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// 开发环境下同时输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    )
  }));
}

// 同步日志专用logger
const syncLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'sync-service' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'sync.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// 如果是开发环境，同步日志也输出到控制台
if (process.env.NODE_ENV !== 'production') {
  syncLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[SYNC] ${timestamp} [${level}]: ${message}`;
      })
    )
  }));
}

module.exports = {
  logger,
  syncLogger
};

// 导出默认logger
module.exports = logger;
module.exports.syncLogger = syncLogger;
