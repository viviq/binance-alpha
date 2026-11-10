import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { CoinData, FuturesData } from '../types';

export class BinanceService {
  private spotApi: AxiosInstance;
  private futuresApi: AxiosInstance;

  constructor() {
    // 币安现货API
    this.spotApi = axios.create({
      baseURL: 'https://api.binance.com/api/v3',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 币安合约API
    this.futuresApi = axios.create({
      baseURL: 'https://fapi.binance.com/fapi/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器（生产环境禁用详细日志）
    const requestInterceptor = (config: any) => {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    };

    // 响应拦截器
    const responseInterceptor = (response: any) => response;
    const errorInterceptor = (error: any) => {
      // 只记录非 451 错误
      if (error.response?.status !== 451 && process.env.NODE_ENV !== 'production') {
        logger.error('API请求失败:', error.message);
      }
      return Promise.reject(error);
    };

    this.spotApi.interceptors.request.use(requestInterceptor);
    this.spotApi.interceptors.response.use(responseInterceptor, errorInterceptor);

    this.futuresApi.interceptors.request.use(requestInterceptor);
    this.futuresApi.interceptors.response.use(responseInterceptor, errorInterceptor);
  }

  // 获取未平仓合约
  async getOpenInterest(symbol: string): Promise<number | null> {
    try {
      const response = await this.futuresApi.get('/openInterest', {
        params: { symbol }
      });
      const openInterest = parseFloat(response.data.openInterest);
      return isNaN(openInterest) ? null : openInterest;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error(`获取${symbol}未平仓量失败:`, error);
      }
      return null;
    }
  }

  // 获取币安Alpha币种列表
  async getAlphaTokenList(): Promise<any[]> {
    try {
      const response = await axios.get('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list');
      if (response.data && response.data.code === '000000') {
        return response.data.data || [];
      }
      return [];
    } catch (error: any) {
      // 如果是 451 地理位置限制错误，静默返回空数组，使用备用数据
      if (error.response?.status === 451) {
        logger.info('币安 Alpha API 访问受限 (451)');
      } else {
        logger.error('获取Alpha币种列表失败:', error.message);
      }
      return [];
    }
  }

  // 获取Alpha币对数据
  // 只解析 Alpha 接口自带的数据（链上价格/市值/流通量），不再逐个请求现货行情；
  // 现货/合约价格由 DataCollector 基于 getMarketSnapshot() 的批量数据覆盖。
  async getAlphaCoins(): Promise<Partial<CoinData>[]> {
    try {
      const alphaTokens = await this.getAlphaTokenList();

      if (!alphaTokens || alphaTokens.length === 0) {
        logger.warn('无法从币安Alpha API获取数据，返回空数组');
        return [];
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.info(`获取到 ${alphaTokens.length} 个Alpha币种`);
      }

      const alphaCoins: Partial<CoinData>[] = [];

      for (const token of alphaTokens) {
        try {
          const price = toPositive(token.price);
          let marketCap = toPositive(token.marketCap);
          let circulatingSupply = toPositive(token.circulatingSupply);

          // 有价格和流通量但没有市值：计算市值
          if (marketCap === null && price !== null && circulatingSupply !== null) {
            marketCap = price * circulatingSupply;
          }
          // 有价格和市值但没有流通量：反算流通量（均基于 Alpha 链上价格，口径一致）
          if (circulatingSupply === null && price !== null && marketCap !== null) {
            circulatingSupply = marketCap / price;
          }
          // 仍然缺失则保留为空，不做估算

          alphaCoins.push({
            symbol: token.symbol,
            name: token.name || token.symbol,
            current_price: price,
            volume_24h: toNumber(token.volume24h),
            price_change: toNumber(token.percentChange24h),
            market_cap: marketCap,
            circulating_supply: circulatingSupply,
            total_supply: toPositive(token.totalSupply),
            fdv: toPositive(token.fdv),
            alpha_listing_time: token.listingTime ? new Date(token.listingTime).toISOString() : new Date().toISOString(),
            last_updated: new Date().toISOString(),
            is_active: true,
            alpha_id: token.alphaId,
            chain_id: token.chainId,
            contract_address: token.contractAddress,
            // listingCex 为 true 表示该 Alpha 代币已正式上线币安，cexCoinName 为其币安代码
            cex_coin_name: token.listingCex && token.cexCoinName ? String(token.cexCoinName) : undefined
          });
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            logger.error(`处理Alpha币种 ${token.symbol} 数据失败:`, error);
          }
        }
      }

      return alphaCoins;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error('获取Alpha币对失败:', error);
      }
      return [];
    }
  }

  // 一次性拉取全市场行情快照：现货 24h ticker、合约交易对信息、合约 24h ticker 各 1 次请求。
  // 某个来源请求失败时对应的 *Ok 标记为 false，调用方据此区分"没有上线"和"拿不到数据"。
  async getMarketSnapshot(): Promise<MarketSnapshot> {
    const [spotRes, futuresInfoRes, futuresTickerRes] = await Promise.allSettled([
      this.spotApi.get('/ticker/24hr'),
      this.futuresApi.get('/exchangeInfo'),
      this.futuresApi.get('/ticker/24hr'),
    ]);

    const snapshot: MarketSnapshot = {
      spotTickers: new Map(),
      futuresSymbols: new Map(),
      futuresTickers: new Map(),
      spotOk: false,
      futuresOk: false,
    };

    if (spotRes.status === 'fulfilled' && Array.isArray(spotRes.value.data)) {
      for (const t of spotRes.value.data) snapshot.spotTickers.set(t.symbol, t);
      snapshot.spotOk = true;
    } else {
      this.logSnapshotFailure('现货 ticker', spotRes);
    }

    if (
      futuresInfoRes.status === 'fulfilled' && Array.isArray(futuresInfoRes.value.data?.symbols) &&
      futuresTickerRes.status === 'fulfilled' && Array.isArray(futuresTickerRes.value.data)
    ) {
      for (const s of futuresInfoRes.value.data.symbols) {
        // 只保留加密货币永续合约，排除股票/商品等 TradFi 合约（如 ACNUSDT、KOUSDT 是美股永续）
        const isCryptoPerpetual =
          (s.contractType === undefined || s.contractType === 'PERPETUAL') &&
          (s.underlyingType === undefined || s.underlyingType === 'COIN');
        if (s.status === 'TRADING' && s.quoteAsset === 'USDT' && isCryptoPerpetual) snapshot.futuresSymbols.set(s.symbol, s);
      }
      for (const t of futuresTickerRes.value.data) snapshot.futuresTickers.set(t.symbol, t);
      snapshot.futuresOk = true;
    } else {
      this.logSnapshotFailure('合约 exchangeInfo', futuresInfoRes);
      this.logSnapshotFailure('合约 ticker', futuresTickerRes);
    }

    return snapshot;
  }

  private logSnapshotFailure(label: string, result: PromiseSettledResult<any>): void {
    if (result.status !== 'rejected') return;
    const status = result.reason?.response?.status;
    if (status === 451) {
      logger.info(`${label} 访问受限 (451)`);
    } else {
      logger.error(`获取${label}失败:`, result.reason?.message || result.reason);
    }
  }

  // 批量获取未平仓量（合约数量），以固定并发数请求，单个失败不影响其他
  async getOpenInterests(symbols: string[], concurrency: number = 10): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    let cursor = 0;

    const worker = async () => {
      while (cursor < symbols.length) {
        const symbol = symbols[cursor++];
        const oi = await this.getOpenInterest(symbol);
        if (oi !== null) result.set(symbol, oi);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
    return result;
  }

  // 基于行情快照构造合约数据；合约数据不可用时返回 null（调用方不应覆盖数据库中的已有状态）
  buildFuturesData(symbol: string, snapshot: MarketSnapshot, openInterests: Map<string, number>): FuturesData | null {
    if (!snapshot.futuresOk) return null;

    const info = snapshot.futuresSymbols.get(symbol);
    const ticker = snapshot.futuresTickers.get(symbol);
    if (!info || !ticker) return { is_listed: false };

    const futuresPrice = toPositive(ticker.lastPrice);
    const openInterestRaw = openInterests.get(symbol);

    return {
      is_listed: true,
      listing_time: new Date(info.onboardDate || Date.now()).toISOString(),
      futures_price: futuresPrice,
      // openInterest 接口返回合约数量，乘以价格得到 USDT 价值
      open_interest: openInterestRaw !== undefined && futuresPrice !== null ? openInterestRaw * futuresPrice : null,
      futures_volume_24h: toNumber(ticker.quoteVolume), // USDT 计价成交额
      spot_futures_spread: 0 // 需要计算现货和合约价差
    };
  }
}

export interface MarketSnapshot {
  spotTickers: Map<string, any>;
  futuresSymbols: Map<string, any>;
  futuresTickers: Map<string, any>;
  spotOk: boolean;
  futuresOk: boolean;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function toPositive(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n > 0 ? n : null;
}
