import { Router, Request, Response } from 'express';
import { dbService } from '../database/dbService';
import { messageQueue } from '../services/messageQueue';
import { BinanceService } from '../services/binanceService';
import { announcementService } from '../services/announcementService';
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
      let aValue: any;
      let bValue: any;

      // 根据排序字段获取值
      if (sort_by === 'price_change_24h') {
        aValue = a.price_change;
        bValue = b.price_change;
      } else if (sort_by === 'futures_listing_time') {
        // 合约上线时间排序
        aValue = a.futures_data?.listing_time || null;
        bValue = b.futures_data?.listing_time || null;
      } else if (sort_by === 'fdv') {
        // FDV 排序
        aValue = a.fdv;
        bValue = b.fdv;
      } else {
        aValue = a[sort_by as keyof CoinData];
        bValue = b[sort_by as keyof CoinData];
      }

      // 处理 null/undefined 值：将它们放在最后
      const aIsNull = aValue === null || aValue === undefined;
      const bIsNull = bValue === null || bValue === undefined;

      if (aIsNull && bIsNull) return 0;
      if (aIsNull) return sort_order === 'asc' ? 1 : 1; // null 值总是放最后
      if (bIsNull) return sort_order === 'asc' ? -1 : -1;

      // 字符串比较（转小写）
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // 执行排序
      if (sort_order === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
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

// 获取即将上线的合约（显示所有最近的，不按状态过滤）
router.get('/upcoming-futures', async (req: Request, res: Response) => {
  try {
    // 获取所有最近的合约公告（包括pending和listed状态）
    const allFutures = await dbService.getUpcomingFutures();

    const response: ApiResponse<any[]> = {
      success: true,
      data: allFutures,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取即将上线合约失败:', error);

    // 如果表不存在，返回空数组而不是错误（表会在数据库初始化时创建）
    if (error.code === '42P01') {
      console.warn('upcoming_futures表尚未创建，返回空数组');
      const response: ApiResponse<any[]> = {
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      };
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// 手动刷新即将上线的合约
router.post('/upcoming-futures/refresh', async (req: Request, res: Response) => {
  try {
    console.log('开始手动刷新即将上线的合约数据...');

    // 从币安API获取最新公告
    const upcomingFutures = await announcementService.getUpcomingFutures();

    if (upcomingFutures.length > 0) {
      // 保存到数据库
      const dataList = upcomingFutures.map(item => ({
        symbol: item.symbol,
        name: item.name,
        announcementId: item.announcementId,
        announcementTitle: item.announcementTitle,
        announcementUrl: item.announcementUrl,
        expectedListingDate: item.expectedListingDate,
        // 使用同一个日期对象，因为我们已经在announcementService中处理了时区
        expectedListingTime: item.expectedListingDate,
      }));

      await dbService.batchUpsertUpcomingFutures(dataList);

      console.log(`成功刷新 ${upcomingFutures.length} 个即将上线的合约`);

      const response: ApiResponse<{ count: number; data: any[] }> = {
        success: true,
        data: {
          count: upcomingFutures.length,
          data: await dbService.getUpcomingFutures()
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } else {
      const response: ApiResponse<{ count: number; data: any[] }> = {
        success: true,
        data: {
          count: 0,
          data: []
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    }
  } catch (error: any) {
    console.error('手动刷新即将上线合约失败:', error);

    res.status(500).json({
      success: false,
      error: error.message || '刷新失败，请稍后重试',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取数据库统计信息
router.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const stats = await dbService.getDatabaseStats();

    const response: ApiResponse<any> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取数据库统计失败:', error);

    res.status(500).json({
      success: false,
      error: error.message || '获取统计失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 手动清理数据库旧数据
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    console.log('开始手动清理数据库旧数据...');

    const result = await dbService.cleanupAllOldData();

    console.log(`数据清理完成，共删除 ${result.total} 条记录`);

    const response: ApiResponse<{
      priceHistory: number;
      notifications: number;
      collectionLogs: number;
      upcomingFutures: number;
      total: number;
      message: string;
    }> = {
      success: true,
      data: {
        ...result,
        message: `成功清理 ${result.total} 条旧数据`
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('手动清理数据失败:', error);

    res.status(500).json({
      success: false,
      error: error.message || '清理失败，请稍后重试',
      timestamp: new Date().toISOString()
    });
  }
});

// 清理所有 collection_logs（日志表可以全部清空）
router.post('/cleanup/logs', async (req: Request, res: Response) => {
  try {
    console.log('开始清理所有采集日志...');

    const result = await dbService.cleanupOldCollectionLogs(0); // 清理所有

    console.log(`采集日志清理完成，共删除 ${result} 条记录`);

    const response: ApiResponse<{
      deleted: number;
      message: string;
    }> = {
      success: true,
      data: {
        deleted: result,
        message: `成功清理 ${result} 条采集日志`
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('清理采集日志失败:', error);

    res.status(500).json({
      success: false,
      error: error.message || '清理失败',
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