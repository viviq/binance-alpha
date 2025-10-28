import { redis, redisPub, redisSub } from '../database/config';
import { logger } from '../utils/logger';
import { CoinData } from '../types';

// Redis消息队列频道
export const CHANNELS = {
  PRICE_UPDATE: 'price:update',
  NEW_COIN: 'coin:new',
  NEW_FUTURES: 'futures:new',
  DATA_SYNC: 'data:sync',
  NOTIFICATION: 'notification',
};

// Redis缓存键
export const CACHE_KEYS = {
  COINS_LIST: 'cache:coins:list',
  COIN_DETAIL: (symbol: string) => `cache:coin:${symbol}`,
  STATS: 'cache:stats',
  PRICE_HISTORY: (symbol: string) => `cache:price:history:${symbol}`,
};

export class MessageQueueService {
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.setupSubscribers();
  }

  // 设置订阅者
  private setupSubscribers(): void {
    redisSub.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        const handlers = this.subscribers.get(channel);

        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      } catch (error) {
        logger.error(`处理频道 ${channel} 消息失败:`, error);
      }
    });

    redisSub.on('error', (error) => {
      logger.error('Redis订阅者错误:', error);
    });
  }

  // ========== 发布消息 ==========

  // 发布价格更新
  async publishPriceUpdate(coins: CoinData[]): Promise<void> {
    try {
      await redisPub.publish(
        CHANNELS.PRICE_UPDATE,
        JSON.stringify({
          type: 'price_update',
          data: coins,
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('发布价格更新失败:', error);
    }
  }

  // 发布新币种
  async publishNewCoin(coin: CoinData): Promise<void> {
    try {
      await redisPub.publish(
        CHANNELS.NEW_COIN,
        JSON.stringify({
          type: 'new_coin',
          data: coin,
          timestamp: new Date().toISOString()
        })
      );
      logger.info(`发布新币种: ${coin.symbol}`);
    } catch (error) {
      logger.error('发布新币种失败:', error);
    }
  }

  // 发布新合约上线
  async publishNewFutures(coin: CoinData): Promise<void> {
    try {
      await redisPub.publish(
        CHANNELS.NEW_FUTURES,
        JSON.stringify({
          type: 'new_futures',
          data: coin,
          timestamp: new Date().toISOString()
        })
      );
      logger.info(`发布新合约: ${coin.symbol}`);
    } catch (error) {
      logger.error('发布新合约失败:', error);
    }
  }

  // 发布数据同步事件
  async publishDataSync(): Promise<void> {
    try {
      await redisPub.publish(
        CHANNELS.DATA_SYNC,
        JSON.stringify({
          type: 'data_sync',
          timestamp: new Date().toISOString()
        })
      );
      logger.info('发布数据同步事件');
    } catch (error) {
      logger.error('发布数据同步事件失败:', error);
    }
  }

  // 发布通知
  async publishNotification(notification: {
    type: string;
    title: string;
    message: string;
    coinSymbol?: string;
  }): Promise<void> {
    try {
      await redisPub.publish(
        CHANNELS.NOTIFICATION,
        JSON.stringify({
          ...notification,
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('发布通知失败:', error);
    }
  }

  // ========== 订阅消息 ==========

  // 订阅频道
  async subscribe(channel: string, handler: (data: any) => void): Promise<void> {
    try {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set());
        await redisSub.subscribe(channel);
        logger.info(`订阅频道: ${channel}`);
      }

      this.subscribers.get(channel)!.add(handler);
    } catch (error) {
      logger.error(`订阅频道 ${channel} 失败:`, error);
    }
  }

  // 取消订阅
  async unsubscribe(channel: string, handler?: (data: any) => void): Promise<void> {
    try {
      const handlers = this.subscribers.get(channel);

      if (!handlers) return;

      if (handler) {
        handlers.delete(handler);
      }

      if (!handler || handlers.size === 0) {
        this.subscribers.delete(channel);
        await redisSub.unsubscribe(channel);
        logger.info(`取消订阅频道: ${channel}`);
      }
    } catch (error) {
      logger.error(`取消订阅频道 ${channel} 失败:`, error);
    }
  }

  // ========== 缓存操作 ==========

  // 设置缓存
  async setCache(key: string, data: any, expiresIn: number = 300): Promise<void> {
    try {
      await redis.setex(key, expiresIn, JSON.stringify(data));
    } catch (error) {
      logger.error(`设置缓存 ${key} 失败:`, error);
    }
  }

  // 获取缓存
  async getCache<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`获取缓存 ${key} 失败:`, error);
      return null;
    }
  }

  // 删除缓存
  async deleteCache(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`删除缓存 ${key} 失败:`, error);
    }
  }

  // 清除所有缓存
  async clearAllCache(): Promise<void> {
    try {
      const keys = await redis.keys('cache:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`清除了 ${keys.length} 个缓存`);
      }
    } catch (error) {
      logger.error('清除所有缓存失败:', error);
    }
  }

  // 缓存币对列表
  async cacheCoins(coins: CoinData[], expiresIn: number = 60): Promise<void> {
    await this.setCache(CACHE_KEYS.COINS_LIST, coins, expiresIn);
  }

  // 获取缓存的币对列表
  async getCachedCoins(): Promise<CoinData[] | null> {
    return await this.getCache<CoinData[]>(CACHE_KEYS.COINS_LIST);
  }

  // 缓存统计数据
  async cacheStats(stats: any, expiresIn: number = 300): Promise<void> {
    await this.setCache(CACHE_KEYS.STATS, stats, expiresIn);
  }

  // 获取缓存的统计数据
  async getCachedStats(): Promise<any | null> {
    return await this.getCache(CACHE_KEYS.STATS);
  }

  // ========== 消息队列操作 ==========

  // 添加任务到队列
  async addTask(queue: string, task: any, priority: number = 0): Promise<void> {
    try {
      await redis.zadd(queue, priority, JSON.stringify(task));
    } catch (error) {
      logger.error(`添加任务到队列 ${queue} 失败:`, error);
    }
  }

  // 从队列获取任务
  async getTask(queue: string): Promise<any | null> {
    try {
      const results = await redis.zpopmin(queue);
      if (results && results.length >= 2) {
        return JSON.parse(results[0]);
      }
      return null;
    } catch (error) {
      logger.error(`从队列 ${queue} 获取任务失败:`, error);
      return null;
    }
  }

  // 获取队列长度
  async getQueueLength(queue: string): Promise<number> {
    try {
      return await redis.zcard(queue);
    } catch (error) {
      logger.error(`获取队列 ${queue} 长度失败:`, error);
      return 0;
    }
  }
}

export const messageQueue = new MessageQueueService();
