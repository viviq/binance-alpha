import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import cron from 'node-cron';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from './utils/logger';
import { testDatabaseConnection, testRedisConnection, closeConnections } from './database/config';
import { initializeDatabase as initDb } from './database/initDb';
import { runMigrations } from './database/migrations';
import apiRoutes from './routes/api';
import { WebSocketServer } from './websocket/server';
import { DataCollector } from './services/dataCollector';
import { parseTrustProxy } from './utils/trustProxy';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// 反向代理信任设置：部署在代理后（如 Railway/Nginx）时需要信任代理，
// 否则 req.ip 都是代理地址，所有用户共用同一个限流额度。
// TRUST_PROXY 可设为跳数（如 1）、true/false 或 IP/子网列表；生产环境默认信任 1 跳。
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

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

// 定时采集：生产环境每 5 分钟，开发环境每 1 分钟。
// 在数据库初始化完成后再启动（见 server.listen 回调），避免在表结构/迁移就绪前采集。
// 采集现在只需少量批量请求（本地实测约 2.5 秒），无需再为"启动过载"延迟 5 分钟。
function startCollectionSchedule(): void {
  const expression = process.env.NODE_ENV === 'production' ? '*/5 * * * *' : '*/1 * * * *';
  cron.schedule(expression, async () => {
    logger.info('开始定时数据采集');
    try {
      await dataCollector.startCollection();
      logger.info('定时数据采集完成');
    } catch (error) {
      logger.error('定时数据采集失败:', error);
    }
  });
  logger.info(`定时数据采集任务已启动（${expression}）`);
}

// 设置每日自动清理旧数据任务（每天凌晨3点执行）
cron.schedule('0 3 * * *', async () => {
  logger.info('开始执行每日数据清理任务');
  try {
    const { dbService } = await import('./database/dbService');
    const result = await dbService.cleanupAllOldData();
    logger.info('每日数据清理任务完成', result);
  } catch (error) {
    logger.error('每日数据清理任务失败:', error);
  }
});

// 初始化数据库连接
async function initializeDatabase() {
  logger.info('正在测试数据库连接...');
  const pgConnected = await testDatabaseConnection();
  const redisConnected = await testRedisConnection();

  if (!pgConnected) {
    throw new Error('PostgreSQL连接失败');
  }

  if (!redisConnected) {
    throw new Error('Redis连接失败');
  }

  logger.info('所有数据库连接测试通过');

  // 初始化数据库表结构
  await initDb();

  // 运行数据库迁移
  await runMigrations();
}

// 启动时立即执行一次数据采集，避免部署/重启后页面长时间没有数据
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

  try {
    // 初始化数据库
    await initializeDatabase();
  } catch (error) {
    logger.error('初始化失败，但服务器继续运行:', error);
    // 不要让服务器崩溃，继续运行以提供健康检查接口
  }

  // 无论初始化是否成功都启动定时采集（数据库恢复后可自动补上数据）；
  // 与首次采集重叠时由 DataCollector 的 isCollecting 跳过
  startCollectionSchedule();

  // 立即采集一次
  await initializeData();
});

export default app;