import { binancePairSymbol, isSameAsset, selectMatchingMarketData, buildCoinData } from '../services/coinBuilder';

const alpha = (over: Record<string, unknown> = {}) => ({
  symbol: 'ACN', name: 'AITECH Cloud Network', alpha_listing_time: '2026-10-01T00:00:00.000Z',
  is_active: true, current_price: 0.0036, circulating_supply: 1_875_000_000, ...over,
});

describe('binancePairSymbol', () => {
  it('uses the Binance coin name when Alpha says the token is listed on Binance', () => {
    expect(binancePairSymbol({ symbol: 'XYZ', cex_coin_name: 'XYZNEW' })).toBe('XYZNEWUSDT');
    expect(binancePairSymbol({ symbol: 'ACN' })).toBe('ACNUSDT');
  });
});

describe('isSameAsset', () => {
  it('rejects same-ticker assets whose price is far from the Alpha on-chain price', () => {
    expect(isSameAsset(255.16, alpha())).toBe(false); // ACNUSDT = Accenture stock perp
    expect(isSameAsset(0.0036 * 0.489, alpha())).toBe(false); // ~2x off, e.g. AI
  });

  it('accepts prices within the tolerance band', () => {
    expect(isSameAsset(0.0036 * 1.2, alpha())).toBe(true);
    expect(isSameAsset(0.0036 * 0.8, alpha())).toBe(true);
  });

  it('trusts Binance for tokens Alpha marks as listed, even with a stale Alpha price', () => {
    expect(isSameAsset(0.0036 * 0.32, alpha({ cex_coin_name: 'ACN' }))).toBe(true);
  });

  it('cannot confirm identity without an Alpha price', () => {
    expect(isSameAsset(1, alpha({ current_price: null }))).toBe(false);
    expect(isSameAsset(null, alpha())).toBe(false);
  });
});

describe('selectMatchingMarketData', () => {
  it('drops a mismatched spot ticker and marks mismatched futures as not listed', () => {
    const r = selectMatchingMarketData(alpha(), { lastPrice: '255.16' }, { is_listed: true, futures_price: 255.16 });
    expect(r.tickerData).toBeNull();
    expect(r.futuresData).toEqual({ is_listed: false });
  });

  it('keeps matching data and leaves unavailable futures as null', () => {
    const t = { lastPrice: '0.0037' };
    const r = selectMatchingMarketData(alpha(), t, null);
    expect(r.tickerData).toBe(t);
    expect(r.futuresData).toBeNull();
  });

  it('end to end: a stock perp no longer inflates the market cap', () => {
    const a = alpha();
    const { tickerData, futuresData } = selectMatchingMarketData(a, { lastPrice: '255.16', quoteVolume: '1' }, { is_listed: true, futures_price: 255.16 });
    const coin = buildCoinData(a, tickerData, futuresData);
    expect(coin.current_price).toBe(0.0036);
    expect(coin.market_cap).toBeCloseTo(0.0036 * 1_875_000_000);
    expect(coin.futures_data?.is_listed).toBe(false);
  });
});

describe('Binance quantity-prefixed tickers', () => {
  const { cexUnitMultiplier } = require('../services/coinBuilder');

  it('recognises 1000/1M prefixes but not real names that start with a digit', () => {
    expect(cexUnitMultiplier('1000CHEEMS')).toBe(1000);
    expect(cexUnitMultiplier('1MBABYDOGE')).toBe(1_000_000);
    expect(cexUnitMultiplier('1000000MOG')).toBe(1_000_000);
    expect(cexUnitMultiplier('2Z')).toBe(1);
    expect(cexUnitMultiplier('0G')).toBe(1);
    expect(cexUnitMultiplier('1INCH')).toBe(1);
    expect(cexUnitMultiplier(undefined)).toBe(1);
  });

  it('converts per-1000 prices to per-token prices before computing market cap', () => {
    const cheems = { symbol: 'Cheems', name: 'Cheems', alpha_listing_time: '2026-01-01T00:00:00.000Z', is_active: true,
      current_price: 0.000000386, circulating_supply: 187_495_034_775_398, cex_coin_name: '1000CHEEMS' };
    const { tickerData, futuresData } = selectMatchingMarketData(cheems, { lastPrice: '0.000381', quoteVolume: '5000' }, { is_listed: true, futures_price: 0.000382 });
    const coin = buildCoinData(cheems, tickerData, futuresData);
    expect(coin.current_price).toBeCloseTo(0.000000381, 12);
    expect(coin.market_cap).toBeCloseTo(71_435_608, -3); // ~$71M, not $71B
    expect(coin.volume_24h).toBe(5000);
    expect(coin.futures_data?.futures_price).toBeCloseTo(0.000000382, 12);
  });
});
