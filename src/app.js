const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDatabases } = require('./config/database');
const { startSyncService } = require('./services/syncService');
const { errorHandler } = require('./middleware/errorHandler');

// 路由导入
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const readerRoutes = require('./routes/readers');
const borrowRoutes = require('./routes/borrow');
const userRoutes = require('./routes/users');
const syncRoutes = require('./routes/sync');
const reportRoutes = require('./routes/reports');
const databaseSwitchRoutes = require('./routes/databaseSwitch');
const uploadRoutes = require('./routes/upload');
const unifiedUserRoutes = require('./routes/unified-users');
const adminDatabaseRoutes = require('./routes/admin-database');
const categoryRoutes = require('./routes/categories');
const emailRoutes = require('./routes/email');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    methods: ["GET", "POST"]
  }
});

// 全局中间件
app.use(helmet());
app.use(compression());

// 设置信任代理（修复Rate Limit问题）
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:8080",
    "http://localhost:8081"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 增加限制到1000个请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过某些路径的限流
  skip: (req) => {
    return req.path.includes('/auth/logout') && req.method === 'POST';
  }
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// Socket.IO连接处理
io.on('connection', (socket) => {
  logger.info(`客户端连接: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`客户端断开连接: ${socket.id}`);
  });
});

// 将io实例添加到app中，供其他模块使用
app.set('io', io);

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/readers', readerRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/database-switch', databaseSwitchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/unified-users', unifiedUserRoutes);
app.use('/api/admin', adminDatabaseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/email', emailRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在' 
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 连接数据库
    await connectDatabases();
    logger.info('数据库连接成功');
    
    // 启动同步服务
    if (process.env.SYNC_ENABLED === 'true') {
      startSyncService(io);
      logger.info('数据同步服务已启动');
    }
    
    // 启动逾期状态检查器
    const { startOverdueChecker } = require('./utils/overdueChecker');
    startOverdueChecker();

    // 启动HTTP服务器
    server.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV}`);
    });
    
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

startServer();

module.exports = app;
