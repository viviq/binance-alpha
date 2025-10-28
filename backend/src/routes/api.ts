import { Router, Request, Response } from 'express';
import { dbService } from '../database/dbService';
import { messageQueue } from '../services/messageQueue';
import { BinanceService } from '../services/binanceService';
import { CoinData, FilterOptions, PaginatedResponse, StatsData, ApiResponse } from '../types';

const router = Router();
const binanceService = new BinanceService();

// 获取币对列表
router.get('/coins', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sort_by = 'alpha_listing_time',
      sort_order = 'desc',
      has_futures,
      market_cap_min,
      market_cap_max
    } = req.query;

    // 尝试从缓存获取
    const cachedCoins = await messageQueue.getCachedCoins();
    let coins = cachedCoins || await dbService.getAllCoins();

    // 如果没有缓存，保存到缓存
    if (!cachedCoins) {
      await messageQueue.cacheCoins(coins, 60);
    }

    // 搜索筛选
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      coins = coins.filter(coin => 
        coin.symbol.toLowerCase().includes(searchTerm) ||
        coin.name.toLowerCase().includes(searchTerm)
      );
    }

    // 合约状态筛选
    if (has_futures !== undefined) {
      const hasFuturesFilter = has_futures === 'true';
      coins = coins.filter(coin => 
        hasFuturesFilter ? coin.futures_data?.is_listed : !coin.futures_data?.is_listed
      );
    }

    // 市值筛选
    if (market_cap_min) {
      coins = coins.filter(coin => coin.market_cap !== null && coin.market_cap >= Number(market_cap_min));
    }
    if (market_cap_max) {
      coins = coins.filter(coin => coin.market_cap !== null && coin.market_cap <= Number(market_cap_max));
    }

    // 排序
    coins.sort((a, b) => {
      let aValue: any = a[sort_by as keyof CoinData];
      let bValue: any = b[sort_by as keyof CoinData];

      if (sort_by === 'price_change_24h') {
        aValue = a.price_change || 0;
        bValue = b.price_change || 0;
      } else if (sort_by === 'futures_listing_time') {
        // 合约上线时间排序
        aValue = a.futures_data?.listing_time || '';
        bValue = b.futures_data?.listing_time || '';

        // 未上线的放最后
        if (!aValue && bValue) return 1;
        if (aValue && !bValue) return -1;
        if (!aValue && !bValue) return 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sort_order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // 返回所有数据，不进行分页
    const response: ApiResponse<PaginatedResponse<CoinData>> = {
      success: true,
      data: {
        items: coins,
        total: coins.length,
        page: 1,
        limit: coins.length,
        totalPages: 1
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取币对列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取单个币对详情
router.get('/coins/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    // 从数据库获取所有币对（已缓存）
    const coins = await dbService.getAllCoins();
    const coin = coins.find(c => c.symbol === symbol);

    if (!coin) {
      return res.status(404).json({
        success: false,
        error: '币对不存在',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<CoinData> = {
      success: true,
      data: coin,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取币对详情失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取统计数据
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 尝试从缓存获取
    const cachedStats = await messageQueue.getCachedStats();
    let stats: StatsData;

    if (cachedStats) {
      stats = cachedStats;
    } else {
      stats = await dbService.getStats();
      // 缓存统计数据5分钟
      await messageQueue.cacheStats(stats, 300);
    }

    const response: ApiResponse<StatsData> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取价格历史数据
router.get('/coins/:symbol/history', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { period = '24h' } = req.query;

    // 解析时间周期
    let hoursBack = 24;
    if (period === '7d') hoursBack = 24 * 7;
    else if (period === '30d') hoursBack = 24 * 30;

    // 从数据库获取历史数据
    const history = await dbService.getPriceHistory(symbol, hoursBack);

    const response: ApiResponse<any[]> = {
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取历史数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康检查
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    timestamp: new Date().toISOString()
  });
});

export default router;