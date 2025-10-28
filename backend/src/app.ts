import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import cron from 'node-cron';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from './utils/logger';
import { testDatabaseConnection, testRedisConnection, closeConnections } from './database/config';
import { initializeDatabase as initDb } from './database/initDb';
import apiRoutes from './routes/api';
import { WebSocketServer } from './websocket/server';
import { DataCollector } from './services/dataCollector';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// 创建速率限制器
const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 个请求
  duration: 60, // 每 60 秒
});

// 中间件
app.use(compression()); // 启用gzip压缩

// CORS 配置：支持多个前端域名
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（例如移动应用或 curl）
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS 阻止了来自 ${origin} 的请求`);
      callback(new Error('不允许的跨域请求'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制中间件
app.use(async (req, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await rateLimiter.consume(clientIp);
    next();
  } catch (error) {
    logger.warn(`速率限制触发: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试',
      timestamp: new Date().toISOString()
    });
  }
});

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '币安Alpha监控系统API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

// 初始化WebSocket服务器
const wsServer = new WebSocketServer(server);

// 初始化数据采集器
const dataCollector = new DataCollector();

// 设置定时任务
// 每1分钟采集一次数据
cron.schedule('*/1 * * * *', async () => {
  logger.info('开始定时数据采集');
  try {
    await dataCollector.startCollection();
    logger.info('定时数据采集完成');
  } catch (error) {
    logger.error('定时数据采集失败:', error);
  }
});

// 初始化数据库连接
async function initializeDatabase() {
  try {
    logger.info('正在测试数据库连接...');
    const pgConnected = await testDatabaseConnection();
    const redisConnected = await testRedisConnection();

    if (!pgConnected) {
      logger.error('PostgreSQL连接失败，系统无法正常运行');
      process.exit(1);
    }

    if (!redisConnected) {
      logger.error('Redis连接失败，系统无法正常运行');
      process.exit(1);
    }

    logger.info('所有数据库连接测试通过');

    // 初始化数据库表结构
    await initDb();
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 启动时执行一次数据采集
async function initializeData() {
  try {
    logger.info('初始化数据采集');
    await dataCollector.startCollection();
    logger.info('初始化数据采集完成');
  } catch (error) {
    logger.error('初始化数据采集失败:', error);
  }
}

// 优雅关闭处理
async function gracefulShutdown(signal: string) {
  logger.info(`收到${signal}信号，开始优雅关闭`);

  server.close(async () => {
    logger.info('HTTP服务器已关闭');

    wsServer.close();
    dataCollector.stopCollection();

    // 关闭所有数据库连接
    await closeConnections();

    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器
server.listen(PORT, async () => {
  logger.info(`服务器启动成功，端口: ${PORT}`);
  logger.info(`WebSocket服务器已启动`);

  // 初始化数据库
  await initializeDatabase();

  // 初始化数据
  await initializeData();
});

export default app;