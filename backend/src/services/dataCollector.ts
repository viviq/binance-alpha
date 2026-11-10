import { BinanceService, MarketSnapshot } from './binanceService';
import { dbService, NotificationInput } from '../database/dbService';
import { messageQueue } from './messageQueue';
import { logger } from '../utils/logger';
import { announcementService } from './announcementService';
import { CoinData } from '../types';
import { buildCoinData, binancePairSymbol, isSameAsset, selectMatchingMarketData, toFiniteNumber } from './coinBuilder';

export class DataCollector {
  private binanceService: BinanceService;
  private isCollecting: boolean = false;
  private existingCoins: Map<string, CoinData> = new Map();

  constructor() {
    this.binanceService = new BinanceService();
  }

  // 开始数据收集
  async startCollection(): Promise<void> {
    if (this.isCollecting) {
      logger.info('数据收集已在进行中');
      return;
    }

    this.isCollecting = true;
    logger.info('开始数据收集...');

    const startTime = Date.now();
    const logId = await dbService.startCollectionLog('full_collection');

    try {
      // 加载现有币种数据用于检测新增
      await this.loadExistingCoins();

      // 执行一次数据收集
      await this.collectAllData();

      // 抓取即将上线的合约（每次数据采集时更新）
      try {
        await this.collectUpcomingFutures();
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          logger.error('抓取即将上线合约失败:', error);
        }
      }

      const duration = Date.now() - startTime;
      await dbService.completeCollectionLog(logId, 'success', this.existingCoins.size, duration);

      logger.info(`数据收集完成，耗时 ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      await dbService.completeCollectionLog(logId, 'failed', 0, duration, String(error));
      logger.error('数据收集失败:', error);
    } finally {
      this.isCollecting = false;
    }
  }

  // 加载现有币种数据
  private async loadExistingCoins(): Promise<void> {
    try {
      const coins = await dbService.getAllCoins();
      this.existingCoins = new Map(coins.map(coin => [coin.symbol, coin]));
      logger.info(`加载了 ${this.existingCoins.size} 个现有币种`);
    } catch (error) {
      logger.error('加载现有币种失败:', error);
    }
  }

  // 停止数据收集
  stopCollection(): void {
    this.isCollecting = false;
    logger.info('数据收集已停止');
  }

  // 并发处理池大小
  private readonly CONCURRENT_LIMIT = 10;

  // 收集所有数据
  // 每轮请求：Alpha 列表 1 次 + 行情快照 3 次 + 已上线合约的未平仓量各 1 次（限并发）
  private async collectAllData(): Promise<void> {
    logger.info('开始收集币种数据...');

    const [rawAlphaCoins, snapshot] = await Promise.all([
      this.binanceService.getAlphaCoins(),
      this.binanceService.getMarketSnapshot(),
    ]);
    // 按 symbol 去重（保留最后一条），避免重复通知和重复请求
    const alphaCoins = Array.from(
      new Map(rawAlphaCoins.filter(c => c.symbol).map(c => [c.symbol as string, c])).values()
    );
    logger.info(
      `获取到 ${alphaCoins.length} 个Alpha币种，现货行情 ${snapshot.spotOk ? snapshot.spotTickers.size : '不可用'}，` +
      `合约 ${snapshot.futuresOk ? snapshot.futuresSymbols.size : '不可用'}`
    );

    // Alpha 列表拿不到时不写库、不推送，避免用空列表覆盖前端数据
    if (alphaCoins.length === 0) {
      logger.warn('Alpha 币种列表为空，跳过本轮保存');
      return;
    }

    // 只为已上线合约的 Alpha 币种请求未平仓量
    const listedFuturesSymbols = alphaCoins
      .filter(c => {
        const pair = binancePairSymbol(c);
        if (!snapshot.futuresSymbols.has(pair)) return false;
        // 价格对不上的同名合约不请求未平仓量
        return isSameAsset(toFiniteNumber(snapshot.futuresTickers.get(pair)?.lastPrice), c);
      })
      .map(c => binancePairSymbol(c));
    const openInterests = await this.binanceService.getOpenInterests(listedFuturesSymbols, this.CONCURRENT_LIMIT);

    const coinDataList: CoinData[] = [];
    for (const alphaCoin of alphaCoins) {
      const coin = this.processCoinData(alphaCoin, snapshot, openInterests);
      if (coin) coinDataList.push(coin);
    }

    await this.saveData(coinDataList);
  }

  // 处理单个币种数据（纯计算，不发网络请求）
  private processCoinData(
    alphaCoin: Partial<CoinData>,
    snapshot: MarketSnapshot,
    openInterests: Map<string, number>
  ): CoinData | null {
    try {
      const pairSymbol = binancePairSymbol(alphaCoin);
      const rawFutures = this.binanceService.buildFuturesData(pairSymbol, snapshot, openInterests);
      const rawTicker = snapshot.spotTickers.get(pairSymbol) ?? null;

      // 同代码不一定是同一资产：价格对不上时丢弃对应的现货/合约数据
      const { tickerData, futuresData } = selectMatchingMarketData(alphaCoin, rawTicker, rawFutures);
      return buildCoinData(alphaCoin, tickerData, futuresData);
    } catch (error) {
      logger.error(`处理币种 ${alphaCoin.symbol} 失败:`, error);
      return null;
    }
  }

  // 保存数据：一个事务内批量写入，提交成功后再推送事件
  private async saveData(coinDataList: CoinData[]): Promise<void> {
    const notifications: NotificationInput[] = [];
    const newCoins: CoinData[] = [];
    const newFutures: CoinData[] = [];

    for (const coin of coinDataList) {
      const existingCoin = this.existingCoins.get(coin.symbol);

      if (coin.futures_data?.is_listed && !existingCoin?.futures_data?.is_listed) {
        newFutures.push(coin);
        notifications.push({ type: 'success', title: '合约上线', message: `${coin.symbol} 永续合约已上线`, coinSymbol: coin.symbol });
      }

      if (!existingCoin) {
        newCoins.push(coin);
        notifications.push({ type: 'info', title: 'Alpha上线', message: `${coin.symbol} 已在Alpha平台上线`, coinSymbol: coin.symbol });
      }
    }

    await dbService.saveCollectionResults(coinDataList, notifications);

    await Promise.all([
      ...newFutures.map(coin => messageQueue.publishNewFutures(coin)),
      ...newCoins.map(coin => messageQueue.publishNewCoin(coin)),
    ]);

    // 先使缓存失效，再通知各实例的 WebSocket 推送最新数据（推送时会重新读库并回填缓存）
    await messageQueue.invalidateDataCache();
    await messageQueue.publishDataSync();

    logger.info(`数据保存完成，共处理 ${coinDataList.length} 个币种`);
  }

  // 抓取即将上线的合约
  private async collectUpcomingFutures(): Promise<void> {
    try {
      if (process.env.NODE_ENV !== 'production') {
        logger.info('开始抓取即将上线的合约...');
      }

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
          expectedListingTime: item.expectedListingDate,
        }));

        await dbService.batchUpsertUpcomingFutures(dataList);

        if (process.env.NODE_ENV !== 'production') {
          logger.info(`成功保存 ${upcomingFutures.length} 个即将上线的合约`);
        }
      }
    } catch (error: any) {
      // 如果表不存在，只记录警告而不是错误
      if (error.code === '42P01') {
        logger.warn('upcoming_futures表尚未创建，跳过即将上线合约抓取');
      } else if (process.env.NODE_ENV !== 'production') {
        logger.error('抓取即将上线合约失败:', error);
      }
    }
  }

  // 获取收集状态
  getCollectionStatus(): { isCollecting: boolean } {
    return { isCollecting: this.isCollecting };
  }
}