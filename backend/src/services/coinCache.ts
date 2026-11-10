import { dbService } from '../database/dbService';
import { messageQueue } from './messageQueue';
import { CoinData } from '../types';

// 币对列表只在每轮采集后变化，采集完成时会主动失效缓存，所以 TTL 可以较长
const COINS_CACHE_TTL_SECONDS = 300;

// 同一进程内合并并发的缓存未命中，避免缓存失效瞬间多个请求同时查库
let inflight: Promise<CoinData[]> | null = null;

export function isDisplayable(coin: CoinData): boolean {
  return coin.current_price !== null && coin.current_price > 0;
}

export async function getCoinsCached(): Promise<CoinData[]> {
  const cached = await messageQueue.getCachedCoins();
  if (cached) return cached;

  if (!inflight) {
    inflight = (async () => {
      try {
        // 对外只提供有有效价格的币种（采集器仍直接读库，用于新币检测）
        const coins = (await dbService.getAllCoins()).filter(isDisplayable);
        await messageQueue.cacheCoins(coins, COINS_CACHE_TTL_SECONDS);
        return coins;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}
