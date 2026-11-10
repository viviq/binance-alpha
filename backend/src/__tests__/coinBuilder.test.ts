import { buildCoinData, toFiniteNumber, positiveOrNull } from '../services/coinBuilder';

const alpha = (over: Record<string, unknown> = {}) => ({
  symbol: 'AAA',
  name: 'Aaa',
  alpha_listing_time: '2026-11-01T00:00:00.000Z',
  is_active: true,
  ...over,
});

describe('toFiniteNumber / positiveOrNull', () => {
  it('parses numeric strings and rejects garbage', () => {
    expect(toFiniteNumber('1.5')).toBe(1.5);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber('abc')).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
  });

  it('keeps only positive values', () => {
    expect(positiveOrNull('2')).toBe(2);
    expect(positiveOrNull(0)).toBeNull();
    expect(positiveOrNull(-1)).toBeNull();
  });
});

describe('buildCoinData price priority', () => {
  it('prefers spot: price, USDT quote volume and change come from the spot ticker', () => {
    const coin = buildCoinData(
      alpha({ current_price: 1.5, circulating_supply: 100, total_supply: 1000 }),
      { lastPrice: '2', quoteVolume: '1000', volume: '500', priceChangePercent: '0' },
      { is_listed: true, futures_price: 3, futures_volume_24h: 900 }
    );
    expect(coin.current_price).toBe(2);
    expect(coin.volume_24h).toBe(1000); // quoteVolume, not base-asset volume
    expect(coin.price_change).toBe(0); // 0% is kept, not treated as missing
    expect(coin.market_cap).toBe(200); // spot price x circulating supply
    expect(coin.fdv).toBe(2000);
  });

  it('falls back to futures price when there is no spot market', () => {
    const coin = buildCoinData(
      alpha({ current_price: 1.5, price_change: 250, circulating_supply: 10 }),
      null,
      { is_listed: true, futures_price: 3, futures_volume_24h: 900 }
    );
    expect(coin.current_price).toBe(3);
    expect(coin.volume_24h).toBe(900);
    expect(coin.price_change).toBe(250); // large real moves are not replaced
    expect(coin.market_cap).toBe(30);
  });

  it('uses Alpha on-chain data last, including Alpha-provided market cap', () => {
    const coin = buildCoinData(alpha({ current_price: 0.5, market_cap: 777, volume_24h: 12 }), null, { is_listed: false });
    expect(coin.current_price).toBe(0.5);
    expect(coin.market_cap).toBe(777);
    expect(coin.volume_24h).toBe(12);
  });

  it('does not reuse the Alpha market cap when the price came from another source', () => {
    const coin = buildCoinData(alpha({ current_price: 0.5, market_cap: 777 }), { lastPrice: '2', quoteVolume: '1' }, null);
    expect(coin.current_price).toBe(2);
    expect(coin.market_cap).toBeNull();
  });

  it('leaves every missing field as null instead of fabricating values', () => {
    const coin = buildCoinData(alpha(), null, null);
    expect(coin).toMatchObject({
      current_price: null,
      volume_24h: null,
      price_change: null,
      market_cap: null,
      circulating_supply: null,
      total_supply: null,
      fdv: null,
    });
    expect(coin.futures_data).toBeUndefined();
  });

  it('ignores non-positive spot prices and negative volume', () => {
    const coin = buildCoinData(alpha({ current_price: 1, volume_24h: -5 }), { lastPrice: '0', quoteVolume: '10' }, null);
    expect(coin.current_price).toBe(1);
    expect(coin.volume_24h).toBeNull();
  });
});
