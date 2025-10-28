import { Pool, PoolConfig } from 'pg';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// PostgreSQL连接配置
// Railway 会自动提供 DATABASE_URL，优先使用它
const pgConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'binance_alpha',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

// 创建PostgreSQL连接池
export const pool = new Pool(pgConfig);

// 连接错误处理
pool.on('error', (err) => {
  logger.error('PostgreSQL连接池错误:', err);
});

// 测试数据库连接
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL数据库连接成功');
    return true;
  } catch (error) {
    logger.error('PostgreSQL数据库连接失败:', error);
    return false;
  }
}

// Redis连接配置
// Railway 会自动提供 REDIS_URL，优先使用它
function createRedisClient(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL);
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });
}

// 创建Redis客户端
export const redis = createRedisClient();

// Redis事件监听
redis.on('connect', () => {
  logger.info('Redis连接成功');
});

redis.on('error', (err) => {
  logger.error('Redis连接错误:', err);
});

redis.on('ready', () => {
  logger.info('Redis客户端准备就绪');
});

// 创建Redis发布者（用于消息队列）
export const redisPub = createRedisClient();

// 创建Redis订阅者（用于消息队列）
export const redisSub = createRedisClient();

// 测试Redis连接
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    logger.info('Redis连接测试成功');
    return true;
  } catch (error) {
    logger.error('Redis连接测试失败:', error);
    return false;
  }
}

// 关闭所有连接
export async function closeConnections(): Promise<void> {
  try {
    await pool.end();
    redis.disconnect();
    redisPub.disconnect();
    redisSub.disconnect();
    logger.info('所有数据库连接已关闭');
  } catch (error) {
    logger.error('关闭数据库连接失败:', error);
  }
}
