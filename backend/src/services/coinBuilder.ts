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

// 非官方上线的同名资产，价格与 Alpha 链上价格的允许偏差倍数。
// 实测同一资产的偏差都在 ±25% 以内，同名不同资产通常相差 2 倍到数十万倍。
export const PRICE_MATCH_TOLERANCE = 1.5;

// Alpha 代币对应的币安 USDT 交易对：已正式上线币安时用其币安代码，否则用 Alpha 代码
export function binancePairSymbol(alphaCoin: Partial<CoinData>): string {
  return `${alphaCoin.cex_coin_name || alphaCoin.symbol}USDT`;
}

/**
 * 币安对低价代币以"每 N 个"计价，代码带数量前缀（如 1000CHEEMS、1MBABYDOGE）。
 * 返回该前缀代表的数量；普通代码（包括 2Z、0G 这类以数字开头的真实名称）返回 1。
 */
export function cexUnitMultiplier(cexCoinName: string | undefined): number {
  const m = cexCoinName?.match(/^(1000000|100000|10000|1000|1M)(?=[A-Z])/);
  if (!m) return 1;
  return m[1] === '1M' ? 1_000_000 : Number(m[1]);
}

/**
 * 判断币安上的同代码交易对是否就是这个 Alpha 代币。
 * - Alpha 标记已上线币安（cex_coin_name）：以币安为准。这类代币的 Alpha 价格常已停止更新，不做价格比对。
 * - 否则：币安价格须与 Alpha 链上价格相差不超过 PRICE_MATCH_TOLERANCE 倍；
 *   拿不到 Alpha 价格时无法确认，视为不匹配。
 */
export function isSameAsset(cexPrice: number | null, alphaCoin: Partial<CoinData>): boolean {
  if (alphaCoin.cex_coin_name) return true;
  const alphaPrice = positiveOrNull(alphaCoin.current_price);
  if (cexPrice === null || cexPrice <= 0 || alphaPrice === null) return false;
  const ratio = cexPrice / alphaPrice;
  return ratio <= PRICE_MATCH_TOLERANCE && ratio >= 1 / PRICE_MATCH_TOLERANCE;
}

/**
 * 过滤掉与 Alpha 代币不是同一资产的现货/合约数据。
 * 合约不匹配时返回 { is_listed: false }，以便纠正数据库中此前错配的合约状态；
 * futuresData 为 null（本轮拿不到合约数据）时保持 null。
 */
export function selectMatchingMarketData(
  alphaCoin: Partial<CoinData>,
  tickerData: any | null,
  futuresData: FuturesData | null
): { tickerData: any | null; futuresData: FuturesData | null } {
  // 按数量前缀换算成单个代币的价格（成交额、未平仓量本就是 USDT 金额，无需换算）
  const unit = cexUnitMultiplier(alphaCoin.cex_coin_name);
  const perToken = (price: unknown) => {
    const n = toFiniteNumber(price);
    return n === null ? null : n / unit;
  };
  if (unit !== 1) {
    if (tickerData) tickerData = { ...tickerData, lastPrice: perToken(tickerData.lastPrice) };
    if (futuresData?.is_listed) futuresData = { ...futuresData, futures_price: perToken(futuresData.futures_price) };
  }

  const spotOk = tickerData !== null && isSameAsset(toFiniteNumber(tickerData.lastPrice), alphaCoin);
  const futuresOk = !futuresData?.is_listed || isSameAsset(toFiniteNumber(futuresData.futures_price), alphaCoin);
  return {
    tickerData: spotOk ? tickerData : null,
    futuresData: futuresOk ? futuresData : { is_listed: false },
  };
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
