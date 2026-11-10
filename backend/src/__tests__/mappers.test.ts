import { mapCoinRow, toNumberOrNull } from '../database/mappers';

describe('toNumberOrNull', () => {
  it('keeps zero and parses DECIMAL strings', () => {
    expect(toNumberOrNull('0')).toBe(0);
    expect(toNumberOrNull('0.00000000')).toBe(0);
    expect(toNumberOrNull('12.5')).toBe(12.5);
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull('NaN')).toBeNull();
  });
});

describe('mapCoinRow', () => {
  const base = {
    symbol: 'AAA', name: 'Aaa', alpha_listing_time: '2026-11-01', is_active: true,
    alpha_id: 'A1', chain_id: '56', contract_address: '0x1',
    current_price: '1.5', market_cap: null, circulating_supply: null, total_supply: null, fdv: null,
    volume_24h: '0', price_change: '0.0000', last_updated: '2026-11-10',
  };

  it('maps numeric columns and keeps zeros', () => {
    const coin = mapCoinRow({ ...base, futures_is_listed: false });
    expect(coin.current_price).toBe(1.5);
    expect(coin.volume_24h).toBe(0);
    expect(coin.price_change).toBe(0);
    expect(coin.market_cap).toBeNull();
    expect(coin.circulating_supply).toBeNull();
    expect(coin.futures_data).toBeUndefined();
  });

  it('builds futures_data only for listed futures', () => {
    const coin = mapCoinRow({
      ...base, futures_is_listed: true, futures_listing_time: '2026-11-05',
      futures_price: '2.1', open_interest: '21', spot_futures_spread: '0',
    });
    expect(coin.futures_data).toMatchObject({ is_listed: true, futures_price: 2.1, open_interest: 21, spot_futures_spread: 0 });
  });
});
