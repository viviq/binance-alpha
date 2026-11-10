import { CoinData, FuturesData } from '../types';

// 解析为有限数字，无法解析时返回 null
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

// 仅保留正数，其余返回 null
export function positiveOrNull(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n !== null && n > 0 ? n : null;
}

/**
 * 由 Alpha 接口数据、现货 24h ticker、合约数据组装一条币对记录（纯函数，不发请求）。
 * @param tickerData 现货 /ticker/24hr 中该交易对的条目，没有现货时为 null
 * @param futuresData 合约数据；null 表示本轮拿不到合约数据（不写入，保留数据库原状态）
 */
export function buildCoinData(
  alphaCoin: Partial<CoinData>,
  tickerData: any | null,
  futuresData: FuturesData | null
): CoinData {
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

  return {
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
}
