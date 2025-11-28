const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * 生成JWT Token
 */
function generateToken(user) {
  const payload = {
    id: user.user_id,
    username: user.username,
    role: user.role,
    real_name: user.real_name
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
}

/**
 * 验证JWT Token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token已过期');
    } else if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Token无效');
    } else {
      throw new UnauthorizedError('Token验证失败');
    }
  }
}

/**
 * 密码加密
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 密码验证
 */
async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 认证中间件
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('用户未认证');
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      throw new UnauthorizedError('用户未认证');
    }
    
    const decoded = verifyToken(token);
    req.user = decoded;
    
    logger.debug(`用户认证成功: ${decoded.username} (${decoded.role})`);
    next();
    
  } catch (error) {
    if (error.name === 'UnauthorizedError') {
      logger.warn(`❌ 认证失败 ${req.method} ${req.path}: ${error.message}`);
    } else {
      logger.error(`❌ 认证错误 ${req.method} ${req.path}:`, error);
    }
    next(error);
  }
}

/**
 * 角色权限中间件
 */
function authorize(roles = []) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('用户未认证');
      }
      
      // 如果没有指定角色要求，则只需要认证即可
      if (roles.length === 0) {
        return next();
      }
      
      // 检查用户角色是否在允许的角色列表中
      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError(`需要以下角色之一: ${roles.join(', ')}`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 管理员权限中间件
 */
function requireAdmin(req, res, next) {
  return authorize(['admin'])(req, res, next);
}

/**
 * 图书管理员权限中间件（管理员或图书管理员）
 */
function requireLibrarian(req, res, next) {
  return authorize(['admin', 'librarian'])(req, res, next);
}

/**
 * 读者权限中间件（所有角色）
 */
function requireReader(req, res, next) {
  return authorize(['admin', 'librarian', 'reader'])(req, res, next);
}

/**
 * 资源所有者权限检查
 */
function requireOwnerOrAdmin(resourceIdField = 'id') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('用户未认证');
      }
      
      // 管理员可以访问所有资源
      if (req.user.role === 'admin') {
        return next();
      }
      
      const resourceId = req.params[resourceIdField];
      const userId = req.user.id;
      
      // 检查资源是否属于当前用户
      if (req.user.role === 'reader') {
        // 读者只能访问自己的资源
        const sql = `
          SELECT reader_id FROM readers 
          WHERE reader_id = ? AND user_id = ? AND is_deleted = 0
        `;
        
        const results = await executeQuery('mysql', sql, [resourceId, userId]);
        
        if (results.length === 0) {
          throw new ForbiddenError('无权访问此资源');
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 用户登录
 */
async function loginUser(username, password) {
  try {
    // 查询用户信息
    const sql = `
      SELECT user_id, username, password, real_name, role, email, phone, status
      FROM system_users 
      WHERE username = ? AND is_deleted = 0
    `;
    
    const results = await executeQuery(null, sql, [username]);
    
    if (results.length === 0) {
      throw new UnauthorizedError('用户名或密码错误');
    }
    
    const user = results[0];
    
    // 检查用户状态
    if (user.status !== '激活') {
      throw new UnauthorizedError(`用户状态异常: ${user.status}`);
    }
    
    // 验证密码
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('用户名或密码错误');
    }
    
    // 更新最后登录时间
    await executeQuery(null, 
      'UPDATE system_users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
      [user.user_id]
    );
    
    // 生成Token
    const token = generateToken(user);
    
    // 返回用户信息（不包含密码）
    const { password: _, ...userInfo } = user;
    
    logger.info(`用户登录成功: ${username} (${user.role})`);
    
    return {
      token,
      user: userInfo
    };
    
  } catch (error) {
    // 对于认证错误使用warn级别，系统错误使用error级别
    if (error instanceof UnauthorizedError) {
      logger.warn(`用户登录失败: ${username} - ${error.message}`);
    } else {
      logger.error(`用户登录失败: ${username}`, error);
    }
    throw error;
  }
}

/**
 * 用户注册
 */
async function registerUser(userData) {
  try {
    const { username, password, real_name, role = 'reader', email, phone } = userData;
    
    // 检查用户名是否已存在
    const existingUser = await executeQuery('mysql',
      'SELECT user_id FROM system_users WHERE username = ? AND is_deleted = 0',
      [username]
    );
    
    if (existingUser.length > 0) {
      throw new Error('用户名已存在');
    }
    
    // 加密密码
    const hashedPassword = await hashPassword(password);
    
    // 插入用户记录
    const sql = `
      INSERT INTO system_users (username, password, real_name, role, email, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, '激活')
    `;
    
    const result = await executeQuery('mysql', sql, [
      username, hashedPassword, real_name, role, email, phone
    ]);
    
    logger.info(`用户注册成功: ${username} (${role})`);
    
    return {
      user_id: result.insertId,
      username,
      real_name,
      role,
      email,
      phone
    };
    
  } catch (error) {
    logger.error(`用户注册失败: ${userData.username}`, error);
    throw error;
  }
}

/**
 * 修改密码
 */
async function changePassword(userId, oldPassword, newPassword) {
  try {
    // 获取用户当前密码
    const sql = 'SELECT password FROM system_users WHERE user_id = ? AND is_deleted = 0';
    const results = await executeQuery('mysql', sql, [userId]);
    
    if (results.length === 0) {
      throw new Error('用户不存在');
    }
    
    const user = results[0];
    
    // 验证旧密码
    const isValidPassword = await comparePassword(oldPassword, user.password);
    if (!isValidPassword) {
      throw new Error('原密码错误');
    }
    
    // 加密新密码
    const hashedNewPassword = await hashPassword(newPassword);
    
    // 更新密码
    await executeQuery('mysql',
      'UPDATE system_users SET password = ?, last_updated_time = CURRENT_TIMESTAMP WHERE user_id = ?',
      [hashedNewPassword, userId]
    );
    
    logger.info(`用户修改密码成功: userId=${userId}`);
    
  } catch (error) {
    logger.error(`用户修改密码失败: userId=${userId}`, error);
    throw error;
  }
}

/**
 * 获取用户信息
 */
async function getUserInfo(userId) {
  try {
    const sql = `
      SELECT user_id, username, real_name, role, email, phone, status, 
             last_login, created_time
      FROM system_users 
      WHERE user_id = ? AND is_deleted = 0
    `;
    
    const results = await executeQuery('mysql', sql, [userId]);
    
    if (results.length === 0) {
      throw new Error('用户不存在');
    }
    
    return results[0];
    
  } catch (error) {
    logger.error(`获取用户信息失败: userId=${userId}`, error);
    throw error;
  }
}

/**
 * 权限检查辅助函数
 */
const permissions = {
  // 超级管理员权限（数据库切换等高危操作）
  SUPER_ADMIN: ['admin'],
  
  // 系统管理权限
  SYSTEM_ADMIN: ['admin'],
  
  // 用户管理权限
  USER_MANAGE: ['admin', 'librarian'], // 允许图书管理员管理用户（API层面会限制只能管理读者）
  USER_VIEW: ['admin', 'librarian'],
  
  // 图书管理权限
  BOOK_MANAGE: ['admin', 'librarian'],
  BOOK_VIEW: ['admin', 'librarian', 'reader'],
  
  // 读者管理权限
  READER_MANAGE: ['admin', 'librarian'],
  READER_VIEW: ['admin', 'librarian'],
  READER_SELF: ['admin', 'librarian', 'reader'],
  
  // 借阅管理权限
  BORROW_MANAGE: ['admin', 'librarian'],
  BORROW_VIEW: ['admin', 'librarian'],
  BORROW_SELF: ['admin', 'librarian', 'reader'],
  
  // 报表权限
  REPORT_VIEW: ['admin', 'librarian'],
  
  // 同步管理权限
  SYNC_MANAGE: ['admin'],
  SYNC_VIEW: ['admin', 'librarian']
};

/**
 * 检查用户是否有指定权限
 */
function hasPermission(userRole, permission) {
  const allowedRoles = permissions[permission];
  return allowedRoles && allowedRoles.includes(userRole);
}

/**
 * 权限检查中间件工厂（包含认证）
 */
function requirePermission(permission) {
  return (req, res, next) => {
    try {
      // 先进行认证
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        throw new UnauthorizedError('用户未认证');
      }
      
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
      
      if (!token) {
        throw new UnauthorizedError('用户未认证');
      }
      
      const decoded = verifyToken(token);
      req.user = decoded;
      
      // 再进行权限检查
      if (!hasPermission(req.user.role, permission)) {
        logger.warn(`权限检查失败 ${req.method} ${req.path}: 用户 ${req.user.username} 缺少权限 ${permission}`);
        throw new ForbiddenError('权限不足');
      }
      
      logger.debug(`权限检查通过: ${req.user.username} 访问 ${req.method} ${req.path}`);
      next();
    } catch (error) {
      if (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError') {
        logger.warn(`❌ 权限检查失败 ${req.method} ${req.path}: ${error.message}`);
      } else {
        logger.error(`❌ 权限检查错误 ${req.method} ${req.path}:`, error);
      }
      next(error);
    }
  };
}

module.exports = {
  // 基础认证函数
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  
  // 中间件
  authenticate,
  authorize,
  requireAdmin,
  requireLibrarian,
  requireReader,
  requireOwnerOrAdmin,
  requirePermission,
  
  // 业务函数
  loginUser,
  registerUser,
  changePassword,
  getUserInfo,
  hasPermission,
  
  // 权限常量
  permissions
};
