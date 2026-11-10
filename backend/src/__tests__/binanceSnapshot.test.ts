import { BinanceService, MarketSnapshot } from '../services/binanceService';

const snapshot = (over: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  spotTickers: new Map(),
  futuresSymbols: new Map([['AAAUSDT', { symbol: 'AAAUSDT', onboardDate: Date.UTC(2026, 10, 1) }]]),
  futuresTickers: new Map([['AAAUSDT', { symbol: 'AAAUSDT', lastPrice: '2', quoteVolume: '500', volume: '250' }]]),
  spotOk: true,
  futuresOk: true,
  ...over,
});

describe('BinanceService.buildFuturesData', () => {
  const service = new BinanceService();

  it('returns null when futures data is unavailable, so DB state is kept', () => {
    expect(service.buildFuturesData('AAAUSDT', snapshot({ futuresOk: false }), new Map())).toBeNull();
  });

  it('marks symbols missing from the snapshot as not listed', () => {
    expect(service.buildFuturesData('BBBUSDT', snapshot(), new Map())).toEqual({ is_listed: false });
  });

  it('converts open interest to USDT and uses quote volume', () => {
    const data = service.buildFuturesData('AAAUSDT', snapshot(), new Map([['AAAUSDT', 10]]));
    expect(data).toMatchObject({
      is_listed: true,
      listing_time: '2026-11-01T00:00:00.000Z',
      futures_price: 2,
      open_interest: 20,
      futures_volume_24h: 500,
    });
  });

  it('leaves open interest null when it could not be fetched', () => {
    expect(service.buildFuturesData('AAAUSDT', snapshot(), new Map())?.open_interest).toBeNull();
  });
});

describe('BinanceService.getOpenInterests', () => {
  it('fetches each symbol once, respects the concurrency limit, and skips failures', async () => {
    const service = new BinanceService();
    let active = 0;
    let peak = 0;
    const calls: string[] = [];
    service.getOpenInterest = async (symbol: string) => {
      calls.push(symbol);
      active++;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      return symbol === 'BADUSDT' ? null : 7;
    };

    const symbols = ['A', 'B', 'C', 'D', 'E', 'BADUSDT'].map(s => (s.endsWith('USDT') ? s : `${s}USDT`));
    const result = await service.getOpenInterests(symbols, 2);

    expect(calls.sort()).toEqual([...symbols].sort());
    expect(peak).toBeLessThanOrEqual(2);
    expect(result.size).toBe(5);
    expect(result.has('BADUSDT')).toBe(false);
  });
});
