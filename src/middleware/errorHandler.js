const logger = require('../utils/logger');

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 根据错误类型选择合适的日志级别
  const isAuthError = err.name === 'UnauthorizedError' || 
                     err.message.includes('认证') || 
                     err.message.includes('Token') || 
                     err.message.includes('缺少认证头');
  
  if (isAuthError) {
    // 认证错误使用warn级别（这是正常的安全验证）
    logger.warn(`认证失败 ${req.method} ${req.path}: ${err.message}`);
  } else {
    // 其他错误使用error级别
    try {
      logger.error(`错误发生在 ${req.method} ${req.path}:`);
      logger.error(`错误信息: ${err?.message || 'Unknown error'}`);
      logger.error(`请求参数:`, {
        body: req.body,
        params: req.params,
        query: req.query,
        user: req.user ? req.user.id : 'anonymous'
      });
      logger.error(`错误堆栈: ${err?.stack || 'No stack trace'}`);
    } catch (logError) {
      console.error('Error logging failed:', logError);
      console.error('Original error:', err);
    }
  }

  // 默认错误响应
  let status = 500;
  let message = '服务器内部错误';
  let code = 'INTERNAL_SERVER_ERROR';

  // 根据错误类型设置响应
  if (err.name === 'ValidationError') {
    status = 400;
    message = '数据验证失败';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    status = 401;
    message = '未授权访问';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError' || err.message === 'Forbidden') {
    status = 403;
    message = '禁止访问';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError' || err.message === 'Not Found') {
    status = 404;
    message = '资源不存在';
    code = 'NOT_FOUND';
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = '数据已存在';
    code = 'DUPLICATE_ENTRY';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 400;
    message = '关联数据不存在';
    code = 'FOREIGN_KEY_ERROR';
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = '数据库连接失败';
    code = 'DATABASE_CONNECTION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Token无效';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token已过期';
    code = 'TOKEN_EXPIRED';
  } else if (err.message) {
    message = err.message;
  }

  // 构造错误响应
  const errorResponse = {
    success: false,
    code,
    message,
    timestamp: new Date().toISOString()
  };

  // 开发环境下返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    };
  }

  res.status(status).json(errorResponse);
}

/**
 * 404错误处理
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`接口 ${req.originalUrl} 不存在`);
  error.name = 'NotFoundError';
  next(error);
}

/**
 * 异步错误包装器
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = '禁止访问') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = '数据冲突') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
};
