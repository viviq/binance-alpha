import { pool } from './config';
import { CoinData, FuturesData } from '../types';
import { logger } from '../utils/logger';

export class DatabaseService {
  // ========== 币对相关操作 ==========

  // 保存或更新币对信息
  async upsertCoin(coin: CoinData): Promise<number> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO coins (
          symbol, name, alpha_listing_time, is_active,
          alpha_id, chain_id, contract_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol)
        DO UPDATE SET
          name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          alpha_id = EXCLUDED.alpha_id,
          chain_id = EXCLUDED.chain_id,
          contract_address = EXCLUDED.contract_address,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const values = [
        coin.symbol,
        coin.name,
        coin.alpha_listing_time,
        coin.is_active !== undefined ? coin.is_active : true,
        coin.alpha_id || null,
        coin.chain_id || null,
        coin.contract_address || null
      ];

      const result = await client.query(query, values);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  // 批量保存币对数据
  async batchUpsertCoins(coins: CoinData[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const coin of coins) {
        await this.upsertCoin(coin);
      }

      await client.query('COMMIT');
      logger.info(`批量保存 ${coins.length} 个币对成功`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('批量保存币对失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取币对ID
  async getCoinId(symbol: string): Promise<number | null> {
    const query = 'SELECT id FROM coins WHERE symbol = $1';
    const result = await pool.query(query, [symbol]);
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  // 获取所有币对（从视图获取最新数据）
  async getAllCoins(): Promise<CoinData[]> {
    const query = `
      SELECT
        symbol, name, alpha_listing_time, is_active,
        alpha_id, chain_id, contract_address,
        current_price, volume_24h, market_cap,
        circulating_supply, total_supply, fdv, price_change,
        last_updated,
        futures_listed as "futures_is_listed",
        futures_listing_time,
        futures_price,
        open_interest,
        open_interest_1h,
        oi_to_mcap_ratio,
        futures_volume_24h,
        spot_futures_spread
      FROM v_coins_latest
      ORDER BY alpha_listing_time DESC
    `;

    const result = await pool.query(query);

    return result.rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      alpha_listing_time: row.alpha_listing_time,
      current_price: row.current_price ? parseFloat(row.current_price) : null,
      market_cap: row.market_cap ? parseFloat(row.market_cap) : null,
      circulating_supply: row.circulating_supply ? parseFloat(row.circulating_supply) : 0,
      total_supply: row.total_supply ? parseFloat(row.total_supply) : null,
      fdv: row.fdv ? parseFloat(row.fdv) : null,
      volume_24h: row.volume_24h ? parseFloat(row.volume_24h) : null,
      price_change: row.price_change ? parseFloat(row.price_change) : null,
      futures_data: row.futures_is_listed ? {
        is_listed: row.futures_is_listed,
        listing_time: row.futures_listing_time,
        futures_price: row.futures_price ? parseFloat(row.futures_price) : null,
        open_interest: row.open_interest ? parseFloat(row.open_interest) : null,
        open_interest_1h: row.open_interest_1h ? parseFloat(row.open_interest_1h) : null,
        oi_to_mcap_ratio: row.oi_to_mcap_ratio ? parseFloat(row.oi_to_mcap_ratio) : null,
        futures_volume_24h: row.futures_volume_24h ? parseFloat(row.futures_volume_24h) : null,
        spot_futures_spread: row.spot_futures_spread ? parseFloat(row.spot_futures_spread) : null,
      } : undefined,
      last_updated: row.last_updated || new Date().toISOString(),
      is_active: row.is_active,
      alpha_id: row.alpha_id,
      chain_id: row.chain_id,
      contract_address: row.contract_address
    }));
  }

  // ========== 价格历史相关操作 ==========

  // 保存价格历史数据
  async savePriceHistory(coinId: number, coin: CoinData): Promise<void> {
    const query = `
      INSERT INTO price_history (
        coin_id, symbol, price, volume_24h, market_cap,
        circulating_supply, total_supply, fdv, price_change_24h, timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    const values = [
      coinId,
      coin.symbol,
      coin.current_price,
      coin.volume_24h,
      coin.market_cap,
      coin.circulating_supply,
      coin.total_supply,
      coin.fdv,
      coin.price_change,
      new Date()
    ];

    await pool.query(query, values);
  }

  // 批量保存价格历史
  async batchSavePriceHistory(coins: CoinData[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const coin of coins) {
        const coinId = await this.getCoinId(coin.symbol);
        if (coinId) {
          await this.savePriceHistory(coinId, coin);
        }
      }

      await client.query('COMMIT');
      logger.info(`批量保存 ${coins.length} 条价格历史成功`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('批量保存价格历史失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取价格历史
  async getPriceHistory(symbol: string, hoursBack: number = 24): Promise<any[]> {
    const query = `
      SELECT
        timestamp, price, volume_24h, price_change_24h
      FROM price_history
      WHERE symbol = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [symbol]);
    return result.rows;
  }

  // ========== 合约数据相关操作 ==========

  // 保存或更新合约数据
  async upsertFuturesData(coinId: number, symbol: string, futuresData: FuturesData): Promise<void> {
    const query = `
      INSERT INTO futures_data (
        coin_id, symbol, is_listed, listing_time, futures_price,
        open_interest, open_interest_1h, oi_to_mcap_ratio,
        open_interest_market_cap_ratio, futures_volume_24h,
        spot_futures_spread, mark_price, index_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (coin_id)
      DO UPDATE SET
        is_listed = EXCLUDED.is_listed,
        listing_time = EXCLUDED.listing_time,
        futures_price = EXCLUDED.futures_price,
        open_interest = EXCLUDED.open_interest,
        open_interest_1h = EXCLUDED.open_interest_1h,
        oi_to_mcap_ratio = EXCLUDED.oi_to_mcap_ratio,
        open_interest_market_cap_ratio = EXCLUDED.open_interest_market_cap_ratio,
        futures_volume_24h = EXCLUDED.futures_volume_24h,
        spot_futures_spread = EXCLUDED.spot_futures_spread,
        mark_price = EXCLUDED.mark_price,
        index_price = EXCLUDED.index_price,
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
      coinId,
      symbol,
      futuresData.is_listed,
      futuresData.listing_time || null,
      futuresData.futures_price || null,
      futuresData.open_interest || null,
      futuresData.open_interest_1h || null,
      futuresData.oi_to_mcap_ratio || null,
      futuresData.open_interest_market_cap_ratio || null,
      futuresData.futures_volume_24h || futuresData.volume_24h || null,
      futuresData.spot_futures_spread || null,
      futuresData.mark_price || null,
      futuresData.index_price || null
    ];

    await pool.query(query, values);
  }

  // ========== 通知相关操作 ==========

  // 保存通知
  async saveNotification(type: string, title: string, message: string, coinSymbol?: string): Promise<void> {
    const query = `
      INSERT INTO notifications (type, title, message, coin_symbol)
      VALUES ($1, $2, $3, $4)
    `;

    await pool.query(query, [type, title, message, coinSymbol || null]);
  }

  // 获取最近的通知
  async getRecentNotifications(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT * FROM notifications
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // ========== 数据收集日志相关操作 ==========

  // 开始收集任务
  async startCollectionLog(taskType: string): Promise<number> {
    const query = `
      INSERT INTO collection_logs (task_type, status, started_at)
      VALUES ($1, 'running', NOW())
      RETURNING id
    `;

    const result = await pool.query(query, [taskType]);
    return result.rows[0].id;
  }

  // 完成收集任务
  async completeCollectionLog(
    logId: number,
    status: 'success' | 'failed',
    coinsProcessed: number,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE collection_logs
      SET status = $1, coins_processed = $2, duration_ms = $3,
          error_message = $4, completed_at = NOW()
      WHERE id = $5
    `;

    await pool.query(query, [status, coinsProcessed, durationMs, errorMessage || null, logId]);
  }

  // ========== 统计数据 ==========

  // 获取统计数据
  async getStats(): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_coins,
        COUNT(CASE WHEN fd.is_listed THEN 1 END) as contracts_listed,
        COUNT(CASE WHEN c.alpha_listing_time::date = CURRENT_DATE THEN 1 END) as new_today,
        COUNT(CASE WHEN c.alpha_listing_time >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_this_week,
        AVG(ph.market_cap) as avg_market_cap,
        SUM(ph.volume_24h) as total_volume_24h
      FROM coins c
      LEFT JOIN LATERAL (
        SELECT * FROM price_history
        WHERE coin_id = c.id
        ORDER BY timestamp DESC
        LIMIT 1
      ) ph ON true
      LEFT JOIN futures_data fd ON fd.coin_id = c.id
      WHERE c.is_active = true
    `;

    const result = await pool.query(query);
    const row = result.rows[0];

    return {
      total_coins: parseInt(row.total_coins) || 0,
      contracts_listed: parseInt(row.contracts_listed) || 0,
      new_today: parseInt(row.new_today) || 0,
      new_this_week: parseInt(row.new_this_week) || 0,
      avg_market_cap: parseFloat(row.avg_market_cap) || 0,
      total_volume_24h: parseFloat(row.total_volume_24h) || 0
    };
  }

  // 清理旧的价格历史数据
  async cleanupOldPriceHistory(daysToKeep: number = 30): Promise<number> {
    const query = `
      DELETE FROM price_history
      WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    logger.info(`清理了 ${result.rowCount} 条旧的价格历史记录`);
    return result.rowCount || 0;
  }

  // ========== 即将上线合约相关操作 ==========

  // 保存或更新即将上线的合约
  async upsertUpcomingFutures(data: {
    symbol: string;
    name?: string;
    announcementId: string;
    announcementTitle: string;
    announcementUrl: string;
    expectedListingDate?: Date;
    expectedListingTime?: Date;
  }): Promise<void> {
    const query = `
      INSERT INTO upcoming_futures (
        symbol, name, announcement_id, announcement_title, announcement_url,
        expected_listing_date, expected_listing_time, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT (announcement_id)
      DO UPDATE SET
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        announcement_title = EXCLUDED.announcement_title,
        announcement_url = EXCLUDED.announcement_url,
        expected_listing_date = EXCLUDED.expected_listing_date,
        expected_listing_time = EXCLUDED.expected_listing_time,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      data.symbol,
      data.name || null,
      data.announcementId,
      data.announcementTitle,
      data.announcementUrl,
      data.expectedListingDate || null,
      data.expectedListingTime || null,
    ]);
  }

  // 批量保存即将上线的合约
  async batchUpsertUpcomingFutures(dataList: Array<{
    symbol: string;
    name?: string;
    announcementId: string;
    announcementTitle: string;
    announcementUrl: string;
    expectedListingDate?: Date;
    expectedListingTime?: Date;
  }>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const data of dataList) {
        await this.upsertUpcomingFutures(data);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取即将上线的合约列表
  // 如果不传status，则返回所有最近30天的记录
  async getUpcomingFutures(status?: string): Promise<any[]> {
    let query: string;
    let params: any[];

    if (status) {
      // 按状态筛选
      query = `
        SELECT *
        FROM upcoming_futures
        WHERE status = $1
        ORDER BY
          CASE
            WHEN expected_listing_time IS NOT NULL THEN expected_listing_time
            WHEN expected_listing_date IS NOT NULL THEN expected_listing_date
            ELSE created_at
          END DESC
        LIMIT 50
      `;
      params = [status];
    } else {
      // 返回所有最近30天的记录
      query = `
        SELECT *
        FROM upcoming_futures
        WHERE created_at >= NOW() - INTERVAL '30 days'
        ORDER BY
          CASE
            WHEN expected_listing_time IS NOT NULL THEN expected_listing_time
            WHEN expected_listing_date IS NOT NULL THEN expected_listing_date
            ELSE created_at
          END DESC
        LIMIT 50
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  // 将即将上线的合约标记为已上线
  async markUpcomingFuturesAsListed(symbol: string): Promise<void> {
    const query = `
      UPDATE upcoming_futures
      SET status = 'listed', updated_at = CURRENT_TIMESTAMP
      WHERE symbol = $1 AND status = 'pending'
    `;

    await pool.query(query, [symbol]);
  }

  // 清理旧的即将上线合约记录
  async cleanupOldUpcomingFutures(daysToKeep: number = 30): Promise<number> {
    const query = `
      DELETE FROM upcoming_futures
      WHERE status = 'listed'
      AND updated_at < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    return result.rowCount || 0;
  }
}

export const dbService = new DatabaseService();
