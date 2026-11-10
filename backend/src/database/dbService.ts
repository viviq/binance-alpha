import { PoolClient } from 'pg';
import { pool } from './config';
import { CoinData, FuturesData } from '../types';
import { logger } from '../utils/logger';

type Queryable = Pick<PoolClient, 'query'>;

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  coinSymbol?: string;
}

// DECIMAL 字段由 pg 返回字符串；只有 null/undefined 视为缺失，0 保留为 0
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export class DatabaseService {
  // ========== 币对相关操作 ==========

  // 保存或更新币对信息
  async upsertCoin(coin: CoinData, db: Queryable = pool): Promise<number> {
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

    const result = await db.query(query, values);
    return result.rows[0].id;
  }

  // 在一个事务中批量保存一轮采集结果：币对、价格历史、合约数据、通知。
  // 每类数据只执行一条 SQL（unnest 数组参数），不再逐条查询/写入。
  async saveCollectionResults(
    coins: CoinData[],
    notifications: NotificationInput[] = []
  ): Promise<Map<string, number>> {
    // 同一 symbol 只保留最后一条，避免 ON CONFLICT 同一行被更新两次
    const unique = Array.from(new Map(coins.map(c => [c.symbol, c])).values());
    const coinIds = new Map<string, number>();
    if (unique.length === 0 && notifications.length === 0) return coinIds;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (unique.length > 0) {
        // 1. 币对基础信息
        const coinResult = await client.query(
          `
          INSERT INTO coins (symbol, name, alpha_listing_time, is_active, alpha_id, chain_id, contract_address)
          SELECT * FROM unnest($1::text[], $2::text[], $3::timestamp[], $4::boolean[], $5::text[], $6::text[], $7::text[])
          ON CONFLICT (symbol)
          DO UPDATE SET
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            alpha_id = EXCLUDED.alpha_id,
            chain_id = EXCLUDED.chain_id,
            contract_address = EXCLUDED.contract_address,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, symbol
          `,
          [
            unique.map(c => c.symbol),
            unique.map(c => c.name),
            unique.map(c => c.alpha_listing_time),
            unique.map(c => c.is_active !== undefined ? c.is_active : true),
            unique.map(c => c.alpha_id || null),
            unique.map(c => c.chain_id || null),
            unique.map(c => c.contract_address || null),
          ]
        );
        for (const row of coinResult.rows) coinIds.set(row.symbol, row.id);

        // 2. 价格历史（同一轮使用同一个时间戳）
        await client.query(
          `
          INSERT INTO price_history (
            coin_id, symbol, price, volume_24h, market_cap,
            circulating_supply, total_supply, fdv, price_change_24h, timestamp
          )
          SELECT t.*, $10::timestamp
          FROM unnest(
            $1::int[], $2::text[], $3::numeric[], $4::numeric[], $5::numeric[],
            $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[]
          ) AS t
          `,
          [
            unique.map(c => coinIds.get(c.symbol)),
            unique.map(c => c.symbol),
            unique.map(c => c.current_price ?? null),
            unique.map(c => c.volume_24h ?? null),
            unique.map(c => c.market_cap ?? null),
            unique.map(c => c.circulating_supply ?? null),
            unique.map(c => c.total_supply ?? null),
            unique.map(c => c.fdv ?? null),
            unique.map(c => c.price_change ?? null),
            new Date(),
          ]
        );

        // 3. 合约数据（futures_data 为空表示本轮拿不到合约数据，保留数据库现有状态）
        const withFutures = unique.filter(c => c.futures_data);
        if (withFutures.length > 0) {
          const f = (c: CoinData) => c.futures_data as FuturesData;
          await client.query(
            `
            INSERT INTO futures_data (
              coin_id, symbol, is_listed, listing_time, futures_price,
              open_interest, open_interest_1h, oi_to_mcap_ratio,
              open_interest_market_cap_ratio, futures_volume_24h,
              spot_futures_spread, mark_price, index_price
            )
            SELECT * FROM unnest(
              $1::int[], $2::text[], $3::boolean[], $4::timestamp[], $5::numeric[],
              $6::numeric[], $7::numeric[], $8::numeric[],
              $9::numeric[], $10::numeric[],
              $11::numeric[], $12::numeric[], $13::numeric[]
            )
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
            `,
            [
              withFutures.map(c => coinIds.get(c.symbol)),
              withFutures.map(c => c.symbol),
              withFutures.map(c => f(c).is_listed),
              withFutures.map(c => f(c).listing_time || null),
              withFutures.map(c => f(c).futures_price ?? null),
              withFutures.map(c => f(c).open_interest ?? null),
              withFutures.map(c => f(c).open_interest_1h ?? null),
              withFutures.map(c => f(c).oi_to_mcap_ratio ?? null),
              withFutures.map(c => f(c).open_interest_market_cap_ratio ?? null),
              withFutures.map(c => f(c).futures_volume_24h ?? f(c).volume_24h ?? null),
              withFutures.map(c => f(c).spot_futures_spread ?? null),
              withFutures.map(c => f(c).mark_price ?? null),
              withFutures.map(c => f(c).index_price ?? null),
            ]
          );
        }
      }

      // 4. 通知
      if (notifications.length > 0) {
        await client.query(
          `
          INSERT INTO notifications (type, title, message, coin_symbol)
          SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
          `,
          [
            notifications.map(n => n.type),
            notifications.map(n => n.title),
            notifications.map(n => n.message),
            notifications.map(n => n.coinSymbol || null),
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(`批量保存完成：${unique.length} 个币对，${notifications.length} 条通知`);
      return coinIds;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('批量保存采集结果失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取币对ID
  async getCoinId(symbol: string, db: Queryable = pool): Promise<number | null> {
    const query = 'SELECT id FROM coins WHERE symbol = $1';
    const result = await db.query(query, [symbol]);
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
    }));
  }

  // ========== 价格历史相关操作 ==========

  // 保存价格历史数据
  async savePriceHistory(coinId: number, coin: CoinData, db: Queryable = pool): Promise<void> {
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

    await db.query(query, values);
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
      futuresData.futures_price ?? null,
      futuresData.open_interest ?? null,
      futuresData.open_interest_1h ?? null,
      futuresData.oi_to_mcap_ratio ?? null,
      futuresData.open_interest_market_cap_ratio ?? null,
      futuresData.futures_volume_24h ?? futuresData.volume_24h ?? null,
      futuresData.spot_futures_spread ?? null,
      futuresData.mark_price ?? null,
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
  async cleanupOldPriceHistory(daysToKeep: number = 7): Promise<number> {
    const query = `
      DELETE FROM price_history
      WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    logger.info(`清理了 ${result.rowCount} 条旧的价格历史记录（保留${daysToKeep}天）`);
    return result.rowCount || 0;
  }

  // 清理旧的通知记录
  async cleanupOldNotifications(daysToKeep: number = 7): Promise<number> {
    const query = `
      DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    logger.info(`清理了 ${result.rowCount} 条旧的通知记录（保留${daysToKeep}天）`);
    return result.rowCount || 0;
  }

  // 清理旧的采集日志
  async cleanupOldCollectionLogs(daysToKeep: number = 7): Promise<number> {
    const query = `
      DELETE FROM collection_logs
      WHERE started_at < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    logger.info(`清理了 ${result.rowCount} 条旧的采集日志（保留${daysToKeep}天）`);
    return result.rowCount || 0;
  }

  // 统一清理所有旧数据
  async cleanupAllOldData(): Promise<{
    priceHistory: number;
    notifications: number;
    collectionLogs: number;
    upcomingFutures: number;
    total: number;
  }> {
    logger.info('开始清理所有旧数据...');
    const startTime = Date.now();

    const priceHistory = await this.cleanupOldPriceHistory(7);
    const notifications = await this.cleanupOldNotifications(7);
    const collectionLogs = await this.cleanupOldCollectionLogs(7);
    const upcomingFutures = await this.cleanupOldUpcomingFutures(30);

    const total = priceHistory + notifications + collectionLogs + upcomingFutures;
    const duration = Date.now() - startTime;

    logger.info(`数据清理完成！共删除 ${total} 条记录，耗时 ${duration}ms`);

    return {
      priceHistory,
      notifications,
      collectionLogs,
      upcomingFutures,
      total
    };
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
  }, db: Queryable = pool): Promise<void> {
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

    await db.query(query, [
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
        await this.upsertUpcomingFutures(data, client);
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

  // 清理非活跃的旧币对（谨慎使用，会级联删除相关数据）
  async cleanupInactiveCoins(monthsToKeep: number = 6): Promise<number> {
    const query = `
      DELETE FROM coins
      WHERE is_active = false
      AND alpha_listing_time < NOW() - INTERVAL '${monthsToKeep} months'
    `;

    const result = await pool.query(query);
    logger.info(`清理了 ${result.rowCount} 个非活跃币对（${monthsToKeep}个月前）`);
    return result.rowCount || 0;
  }

  // 获取数据库空间占用统计
  async getDatabaseStats(): Promise<{
    tables: Array<{
      table: string;
      rows: number;
      size: string;
    }>;
  }> {
    const query = `
      SELECT
        schemaname as schema,
        tablename as table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;

    const result = await pool.query(query);

    // 获取每个表的行数
    const tablesWithRows = await Promise.all(
      result.rows.map(async (row) => {
        const countQuery = `SELECT COUNT(*) as count FROM ${row.table}`;
        try {
          const countResult = await pool.query(countQuery);
          return {
            table: row.table,
            rows: parseInt(countResult.rows[0].count),
            size: row.size
          };
        } catch (error) {
          return {
            table: row.table,
            rows: 0,
            size: row.size
          };
        }
      })
    );

    return { tables: tablesWithRows };
  }
}

export const dbService = new DatabaseService();
