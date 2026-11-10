import { CoinData } from '../types';

// DECIMAL 字段由 pg 返回字符串；只有 null/undefined 视为缺失，0 保留为 0
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

// v_coins_latest 视图的一行 -> CoinData
export function mapCoinRow(row: any): CoinData {
  return {
    symbol: row.symbol,
    name: row.name,
    alpha_listing_time: row.alpha_listing_time,
    current_price: toNumberOrNull(row.current_price),
    market_cap: toNumberOrNull(row.market_cap),
    circulating_supply: toNumberOrNull(row.circulating_supply),
    total_supply: toNumberOrNull(row.total_supply),
    fdv: toNumberOrNull(row.fdv),
    volume_24h: toNumberOrNull(row.volume_24h),
    price_change: toNumberOrNull(row.price_change),
    futures_data: row.futures_is_listed ? {
      is_listed: row.futures_is_listed,
      listing_time: row.futures_listing_time,
      futures_price: toNumberOrNull(row.futures_price),
      open_interest: toNumberOrNull(row.open_interest),
      open_interest_1h: toNumberOrNull(row.open_interest_1h),
      oi_to_mcap_ratio: toNumberOrNull(row.oi_to_mcap_ratio),
      futures_volume_24h: toNumberOrNull(row.futures_volume_24h),
      spot_futures_spread: toNumberOrNull(row.spot_futures_spread),
    } : undefined,
    last_updated: row.last_updated || new Date().toISOString(),
    is_active: row.is_active,
    alpha_id: row.alpha_id,
    chain_id: row.chain_id,
    contract_address: row.contract_address
  };
}
