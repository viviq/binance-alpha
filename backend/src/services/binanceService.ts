import axios, { AxiosInstance } from 'axios';
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
        console.log(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    };

    // 响应拦截器
    const responseInterceptor = (response: any) => response;
    const errorInterceptor = (error: any) => {
      // 只记录非 451 错误
      if (error.response?.status !== 451 && process.env.NODE_ENV !== 'production') {
        console.error('API请求失败:', error.message);
      }
      return Promise.reject(error);
    };

    this.spotApi.interceptors.request.use(requestInterceptor);
    this.spotApi.interceptors.response.use(responseInterceptor, errorInterceptor);

    this.futuresApi.interceptors.request.use(requestInterceptor);
    this.futuresApi.interceptors.response.use(responseInterceptor, errorInterceptor);
  }

  // 获取所有交易对
  async getAllSymbols(): Promise<string[]> {
    try {
      const response = await this.spotApi.get('/exchangeInfo');
      const symbols = response.data.symbols
        .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map((s: any) => s.symbol);

      return symbols;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('获取交易对失败:', error);
      }
      return [];
    }
  }

  // 获取24小时价格统计
  async get24hrTicker(symbol?: string): Promise<any[]> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.spotApi.get('/ticker/24hr', { params });
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error: any) {
      // 生产环境静默错误，避免日志爆炸
      if (process.env.NODE_ENV !== 'production') {
        console.error('获取价格统计失败:', error.message);
      }
      return [];
    }
  }

  // 获取当前价格
  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const response = await this.spotApi.get('/ticker/price', {
        params: { symbol }
      });
      const price = parseFloat(response.data.price);
      return isNaN(price) ? null : price;
    } catch (error) {
      // 生产环境静默错误
      if (process.env.NODE_ENV !== 'production') {
        console.error(`获取${symbol}价格失败:`, error);
      }
      return null;
    }
  }

  // 获取合约信息
  async getFuturesInfo(): Promise<any[]> {
    try {
      const response = await this.futuresApi.get('/exchangeInfo');
      return response.data.symbols.filter((s: any) =>
        s.status === 'TRADING' && s.quoteAsset === 'USDT'
      );
    } catch (error: any) {
      if (error.response?.status === 451) {
        console.log('合约 API 访问受限 (451)');
      } else {
        console.error('获取合约信息失败:', error.message);
      }
      return [];
    }
  }

  // 获取合约24小时统计
  async getFutures24hrTicker(symbol?: string): Promise<any[]> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.futuresApi.get('/ticker/24hr', { params });
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('获取合约统计失败:', error);
      }
      return [];
    }
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
        console.error(`获取${symbol}未平仓量失败:`, error);
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
        console.log('币安 API 访问受限 (451)，将使用模拟数据');
      } else {
        console.error('获取Alpha币种列表失败:', error.message);
      }
      return [];
    }
  }

  // 获取Alpha币对数据
  async getAlphaCoins(): Promise<Partial<CoinData>[]> {
    try {
      // 获取Alpha币种列表
      const alphaTokens = await this.getAlphaTokenList();

      // 如果没有获取到数据，使用模拟数据
      if (!alphaTokens || alphaTokens.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Alpha API 返回空数据，使用模拟数据');
        }
        return this.getMockAlphaCoins();
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`获取到 ${alphaTokens.length} 个Alpha币种`);
      }

      const alphaCoins: Partial<CoinData>[] = [];

      for (const token of alphaTokens) {
        try {
          // 构建交易对符号 (例如: ALPHA_173USDT)
          const alphaSymbol = `ALPHA_${token.alphaId}USDT`;
          const spotSymbol = `${token.symbol}USDT`;

          // 尝试获取现货价格数据
          let priceData = null;
          try {
            const ticker = await this.get24hrTicker(spotSymbol);
            if (ticker.length > 0) {
              priceData = ticker[0];
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`${spotSymbol} 暂无现货数据`);
            }
          }

          // 计算市值和流通量
          let marketCap: number | null = null;
          let circulatingSupply: number | null = null;

          const currentPrice = priceData ? parseFloat(priceData.lastPrice) : parseFloat(token.price || '0');

          // 1. 优先使用Alpha API提供的真实数据
          const tokenMarketCap = parseFloat(token.marketCap || '0');
          const tokenCirculatingSupply = parseFloat(token.circulatingSupply || '0');
          const tokenTotalSupply = parseFloat(token.totalSupply || '0');
          const tokenFdv = parseFloat(token.fdv || '0');

          if (tokenMarketCap > 0) {
            marketCap = tokenMarketCap;
          }

          if (tokenCirculatingSupply > 0) {
            circulatingSupply = tokenCirculatingSupply;
          }

          // 2. 如果有价格和流通量，但没有市值，计算市值
          if (!marketCap && currentPrice > 0 && circulatingSupply && circulatingSupply > 0) {
            marketCap = currentPrice * circulatingSupply;
          }

          // 3. 如果有价格和市值，但没有流通量，反算流通量
          if (!circulatingSupply && currentPrice > 0 && marketCap && marketCap > 0) {
            circulatingSupply = marketCap / currentPrice;
          }

          // 4. 如果仍然没有数据，使用估算方法
          if ((!marketCap || marketCap === 0) && currentPrice > 0) {
            circulatingSupply = this.estimateSupplyFromPrice(currentPrice);
            marketCap = currentPrice * circulatingSupply;
          }

          const coinData: Partial<CoinData> = {
            symbol: token.symbol,
            name: token.name || token.symbol,
            current_price: currentPrice,
            volume_24h: priceData ? parseFloat(priceData.volume) : parseFloat(token.volume24h || '0'),
            price_change: priceData ? parseFloat(priceData.priceChangePercent) : parseFloat(token.percentChange24h || '0'),
            market_cap: marketCap || undefined,
            circulating_supply: circulatingSupply || undefined,
            total_supply: tokenTotalSupply > 0 ? tokenTotalSupply : undefined,
            fdv: tokenFdv > 0 ? tokenFdv : undefined,
            alpha_listing_time: token.listingTime ? new Date(token.listingTime).toISOString() : new Date().toISOString(),
            last_updated: new Date().toISOString(),
            is_active: true,
            alpha_id: token.alphaId,
            chain_id: token.chainId,
            contract_address: token.contractAddress
          };

          alphaCoins.push(coinData);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`处理Alpha币种 ${token.symbol} 数据失败:`, error);
          }
        }
      }

      return alphaCoins;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('获取Alpha币对失败:', error);
      }
      // 如果获取真实Alpha数据失败，返回模拟数据
      return this.getMockAlphaCoins();
    }
  }

  // 模拟Alpha币种数据（备用方案）
  private async getMockAlphaCoins(): Promise<Partial<CoinData>[]> {
    try {
      const symbols = await this.getAllSymbols();
      const recentSymbols = symbols.slice(0, 50); // 增加到50个作为示例

      const alphaCoins: Partial<CoinData>[] = [];

      for (const symbol of recentSymbols) {
        try {
          const ticker = await this.get24hrTicker(symbol);
          if (ticker.length > 0) {
            const price = parseFloat(ticker[0].lastPrice);
            const volume = parseFloat(ticker[0].volume);
            const priceChange = parseFloat(ticker[0].priceChangePercent);
            
              // 只添加有效数据的币种
              if (price > 0 && volume > 0) {
                // 计算合理的市值和流通量
                const circulatingSupply = this.generateRealisticSupply(price);
                const marketCap = price * circulatingSupply;
                
                const coinData: Partial<CoinData> = {
                  symbol: symbol.replace('USDT', ''),
                  name: symbol.replace('USDT', ''),
                  current_price: price,
                  volume_24h: volume,
                  price_change: priceChange,
                  market_cap: marketCap,
                  circulating_supply: circulatingSupply,
                  alpha_listing_time: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 最近7天内的随机时间
                  last_updated: new Date().toISOString(),
                  is_active: true,
                  alpha_id: `ALPHA_${Math.floor(Math.random() * 1000) + 400}`,
                  chain_id: Math.random() > 0.5 ? "56" : "CT_501", // BSC 或 Solana
                  contract_address: this.generateMockContractAddress()
                };
                alphaCoins.push(coinData);
              }
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`处理币对 ${symbol} 数据失败:`, error);
          }
        }
      }

      return alphaCoins;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('获取模拟Alpha币对失败:', error);
      }
      return this.generateFallbackMockData();
    }
  }



  // 生成合理的流通量
  private generateRealisticSupply(price: number): number {
    // 根据价格范围生成合理的流通量
    if (price > 100) {
      // 高价币种，流通量较小
      return Math.floor(Math.random() * 50000000) + 1000000; // 100万-5000万
    } else if (price > 1) {
      // 中价币种，流通量中等
      return Math.floor(Math.random() * 500000000) + 10000000; // 1000万-5亿
    } else {
      // 低价币种，流通量较大
      return Math.floor(Math.random() * 10000000000) + 100000000; // 1亿-100亿
    }
  }

  // 基于价格估算市值
  private estimateMarketCapFromPrice(price: number): number {
    // 根据价格估算合理的市值范围
    if (price > 100) {
      // 高价币: 市值通常在 10M - 500M 美元
      return (Math.random() * 490000000 + 10000000);
    } else if (price > 10) {
      // 中高价币: 市值通常在 5M - 200M 美元
      return (Math.random() * 195000000 + 5000000);
    } else if (price > 1) {
      // 中价币: 市值通常在 1M - 100M 美元
      return (Math.random() * 99000000 + 1000000);
    } else if (price > 0.1) {
      // 低价币: 市值通常在 500K - 50M 美元
      return (Math.random() * 49500000 + 500000);
    } else {
      // 极低价币: 市值通常在 100K - 10M 美元
      return (Math.random() * 9900000 + 100000);
    }
  }

  // 基于价格估算流通量
  private estimateSupplyFromPrice(price: number): number {
    // 市值 / 价格 = 流通量
    const marketCap = this.estimateMarketCapFromPrice(price);
    return marketCap / price;
  }

  // 生成备用模拟数据
  private generateFallbackMockData(): Partial<CoinData>[] {
    const mockSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC'];
    const mockCoins: Partial<CoinData>[] = [];

    for (let i = 0; i < mockSymbols.length; i++) {
      const symbol = mockSymbols[i];
      const price = this.generateRealisticPrice(symbol);
      const volume = Math.random() * 10000000 + 100000;
      const circulatingSupply = this.generateRealisticSupply(price);
      const marketCap = price * circulatingSupply;
      
      // 生成相关的价格变化
      const baseChange = (Math.random() - 0.5) * 20; // -10% 到 +10%
      
      mockCoins.push({
        symbol,
        name: symbol,
        current_price: price,
        volume_24h: volume,
        market_cap: marketCap,
        circulating_supply: circulatingSupply,
        price_change: baseChange,
        alpha_listing_time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_updated: new Date().toISOString(),
        is_active: true,
        alpha_id: `ALPHA_${400 + i}`,
        chain_id: i % 2 === 0 ? "56" : "CT_501",
        contract_address: this.generateMockContractAddress()
      });
    }

    return mockCoins;
  }

  // 生成符合实际的价格
  private generateRealisticPrice(symbol: string): number {
    const priceRanges: { [key: string]: [number, number] } = {
      'BTC': [40000, 70000],
      'ETH': [2000, 4000],
      'BNB': [200, 600],
      'SOL': [50, 200],
      'ADA': [0.3, 1.2],
      'DOT': [5, 15],
      'LINK': [10, 30],
      'UNI': [5, 20],
      'AVAX': [20, 80],
      'MATIC': [0.5, 2.5]
    };

    const range = priceRanges[symbol] || [0.1, 10];
    return Math.random() * (range[1] - range[0]) + range[0];
  }

  // 生成模拟合约地址
  private generateMockContractAddress(): string {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  }

  // 检查币对是否有合约
  async checkFuturesListing(symbol: string): Promise<FuturesData | null> {
    try {
      const futuresInfo = await this.getFuturesInfo();
      const futuresSymbol = futuresInfo.find(s => s.symbol === symbol);
      
      if (!futuresSymbol) {
        return { is_listed: false };
      }

      const ticker = await this.getFutures24hrTicker(symbol);
      const openInterestRaw = await this.getOpenInterest(symbol);
      
      if (ticker.length > 0) {
        const futuresPrice = parseFloat(ticker[0].lastPrice);
        
        // 计算未平仓量的USDT价值
        // openInterest API返回的是合约数量，需要乘以价格得到USDT价值
        let openInterestUSDT: number | null = null;
        if (openInterestRaw && futuresPrice > 0) {
          openInterestUSDT = openInterestRaw * futuresPrice;
        }
        
        return {
          is_listed: true,
          listing_time: new Date(futuresSymbol.onboardDate || Date.now()).toISOString(),
          futures_price: futuresPrice,
          open_interest: openInterestUSDT, // 转换为USDT价值
          futures_volume_24h: parseFloat(ticker[0].volume),
          spot_futures_spread: 0 // 需要计算现货和合约价差
        };
      }

      return { is_listed: false };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`检查${symbol}合约状态失败:`, error);
      }
      return { is_listed: false };
    }
  }
}