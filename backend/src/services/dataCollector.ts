import { BinanceService, MarketSnapshot } from './binanceService';
import { dbService, NotificationInput } from '../database/dbService';
import { messageQueue } from './messageQueue';
import { logger } from '../utils/logger';
import { announcementService } from './announcementService';
import { CoinData, FuturesData } from '../types';

// 解析为有限数字，无法解析时返回 null
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

// 仅保留正数，其余返回 null
function positiveOrNull(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n !== null && n > 0 ? n : null;
}

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
      .map(c => `${c.symbol}USDT`)
      .filter(s => snapshot.futuresSymbols.has(s) && snapshot.futuresTickers.has(s));
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
      const pairSymbol = `${alphaCoin.symbol}USDT`;
      const futuresData = this.binanceService.buildFuturesData(pairSymbol, snapshot, openInterests);
      const tickerData = snapshot.spotTickers.get(pairSymbol) ?? null;

      // 价格优先级：现货 > 合约 > Alpha 链上价格。
      // 拿不到的字段一律保留 null，绝不生成估算/随机值。
      let currentPrice: number | null = null;
      let volume24h: number | null = null;
      let priceChange24h: number | null = null;
      let priceSource: 'spot' | 'futures' | 'alpha' | null = null;

      const spotPrice = tickerData ? toFiniteNumber(tickerData.lastPrice) : null;
      const futuresPrice = futuresData?.is_listed ? toFiniteNumber(futuresData.futures_price) : null;
      const alphaPrice = toFiniteNumber(alphaCoin.current_price);

      if (spotPrice !== null && spotPrice > 0) {
        currentPrice = spotPrice;
        volume24h = toFiniteNumber(tickerData.quoteVolume); // USDT 计价成交额
        priceChange24h = toFiniteNumber(tickerData.priceChangePercent);
        priceSource = 'spot';
      } else if (futuresPrice !== null && futuresPrice > 0) {
        currentPrice = futuresPrice;
        volume24h = toFiniteNumber(futuresData?.futures_volume_24h) ?? toFiniteNumber(alphaCoin.volume_24h);
        priceChange24h = toFiniteNumber(alphaCoin.price_change);
        priceSource = 'futures';
      } else if (alphaPrice !== null && alphaPrice > 0) {
        currentPrice = alphaPrice;
        volume24h = toFiniteNumber(alphaCoin.volume_24h);
        priceChange24h = toFiniteNumber(alphaCoin.price_change);
        priceSource = 'alpha';
      }

      const circulatingSupply = positiveOrNull(alphaCoin.circulating_supply);
      const totalSupply = positiveOrNull(alphaCoin.total_supply);

      // 市值：有价格和流通量就按当前价格计算（Alpha 提供的市值基于链上价格，
      // 现货/合约价格更准确）；否则仅在使用 Alpha 价格时沿用 Alpha 提供的市值。
      let marketCap: number | null = null;
      if (currentPrice !== null && circulatingSupply !== null) {
        marketCap = currentPrice * circulatingSupply;
      } else if (priceSource === 'alpha') {
        marketCap = positiveOrNull(alphaCoin.market_cap);
      }

      const fdv = currentPrice !== null && totalSupply !== null
        ? currentPrice * totalSupply
        : positiveOrNull(alphaCoin.fdv);

      const coinData: CoinData = {
        symbol: alphaCoin.symbol || '',
        name: alphaCoin.name || alphaCoin.symbol || '',
        alpha_listing_time: alphaCoin.alpha_listing_time || new Date().toISOString(),
        current_price: currentPrice,
        price_change: priceChange24h,
        volume_24h: volume24h !== null && volume24h >= 0 ? volume24h : null,
        market_cap: marketCap,
        circulating_supply: circulatingSupply,
        total_supply: totalSupply,
        fdv,
        futures_data: futuresData || undefined,
        last_updated: new Date().toISOString(),
        is_active: alphaCoin.is_active !== undefined ? alphaCoin.is_active : true,
        alpha_id: alphaCoin.alpha_id,
        chain_id: alphaCoin.chain_id,
        contract_address: alphaCoin.contract_address
      };

      return coinData;
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

    // 发布价格更新事件
    await messageQueue.publishPriceUpdate(coinDataList);

    // 发布数据同步事件
    await messageQueue.publishDataSync();

    // 清除缓存
    await messageQueue.clearAllCache();

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