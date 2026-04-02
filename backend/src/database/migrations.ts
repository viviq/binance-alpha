import { pool } from './config';
import { logger } from '../utils/logger';

/**
 * 数据库迁移运行器
 * 在应用启动时自动执行所有待执行的迁移
 */

interface Migration {
  id: string;
  name: string;
  sql: string;
}

// 定义所有迁移
const migrations: Migration[] = [
  {
    id: '001',
    name: 'add_fdv_and_total_supply',
    sql: `
      -- 添加fdv和total_supply字段到price_history表
      ALTER TABLE price_history
      ADD COLUMN IF NOT EXISTS total_supply DECIMAL(20, 2),
      ADD COLUMN IF NOT EXISTS fdv DECIMAL(20, 2);

      -- 更新视图以包含新字段
      CREATE OR REPLACE VIEW v_coins_latest AS
      SELECT
          c.id,
          c.symbol,
          c.name,
          c.alpha_listing_time,
          c.is_active,
          c.alpha_id,
          c.chain_id,
          c.contract_address,
          ph.price as current_price,
          ph.volume_24h,
          ph.market_cap,
          ph.circulating_supply,
          ph.total_supply,
          ph.fdv,
          ph.price_change_24h as price_change,
          ph.timestamp as last_updated,
          fd.is_listed as futures_listed,
          fd.listing_time as futures_listing_time,
          fd.futures_price,
          fd.open_interest,
          fd.open_interest_1h,
          fd.oi_to_mcap_ratio,
          fd.futures_volume_24h,
          fd.spot_futures_spread
      FROM coins c
      LEFT JOIN LATERAL (
          SELECT * FROM price_history
          WHERE coin_id = c.id
          ORDER BY timestamp DESC
          LIMIT 1
      ) ph ON true
      LEFT JOIN futures_data fd ON fd.coin_id = c.id
      WHERE c.is_active = true
        AND c.alpha_id IS NOT NULL;

      -- 添加索引优化查询性能
      CREATE INDEX IF NOT EXISTS idx_price_history_fdv ON price_history(fdv) WHERE fdv IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_price_history_total_supply ON price_history(total_supply) WHERE total_supply IS NOT NULL;
    `
  },
  {
    id: '002',
    name: 'create_upcoming_futures_table',
    sql: `
      -- 创建即将上线合约表
      CREATE TABLE IF NOT EXISTS upcoming_futures (
          id SERIAL PRIMARY KEY,
          symbol VARCHAR(50) NOT NULL,
          name VARCHAR(100),
          announcement_id VARCHAR(100) UNIQUE,
          announcement_title TEXT,
          announcement_url TEXT,
          expected_listing_date DATE,
          expected_listing_time TIMESTAMP,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_upcoming_futures_symbol ON upcoming_futures(symbol);
      CREATE INDEX IF NOT EXISTS idx_upcoming_futures_status ON upcoming_futures(status);
      CREATE INDEX IF NOT EXISTS idx_upcoming_futures_expected_time ON upcoming_futures(expected_listing_time);

      -- 创建触发器
      DROP TRIGGER IF EXISTS update_upcoming_futures_updated_at ON upcoming_futures;
      CREATE TRIGGER update_upcoming_futures_updated_at
          BEFORE UPDATE ON upcoming_futures
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `
  },
  {
    id: '003',
    name: 'fix_view_to_filter_alpha_coins_only',
    sql: `
      -- 修复视图：只显示真正的Alpha币种（有alpha_id的币种）
      CREATE OR REPLACE VIEW v_coins_latest AS
      SELECT
          c.id,
          c.symbol,
          c.name,
          c.alpha_listing_time,
          c.is_active,
          c.alpha_id,
          c.chain_id,
          c.contract_address,
          ph.price as current_price,
          ph.volume_24h,
          ph.market_cap,
          ph.circulating_supply,
          ph.total_supply,
          ph.fdv,
          ph.price_change_24h as price_change,
          ph.timestamp as last_updated,
          fd.is_listed as futures_listed,
          fd.listing_time as futures_listing_time,
          fd.futures_price,
          fd.open_interest,
          fd.open_interest_1h,
          fd.oi_to_mcap_ratio,
          fd.futures_volume_24h,
          fd.spot_futures_spread
      FROM coins c
      LEFT JOIN LATERAL (
          SELECT * FROM price_history
          WHERE coin_id = c.id
          ORDER BY timestamp DESC
          LIMIT 1
      ) ph ON true
      LEFT JOIN futures_data fd ON fd.coin_id = c.id
      WHERE c.is_active = true
        AND c.alpha_id IS NOT NULL;

      -- 清理非Alpha币种（没有alpha_id的币种）
      -- 这将级联删除相关的价格历史和合约数据
      DELETE FROM coins WHERE alpha_id IS NULL OR alpha_id = '';
    `
  }
  // 未来的迁移可以在这里添加
  // {
  //   id: '003',
  //   name: 'add_another_feature',
  //   sql: `...`
  // }
];

/**
 * 创建迁移历史表（如果不存在）
 */
async function createMigrationTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(sql);
    logger.info('📊 schema_migrations 表已创建或已存在');
  } catch (error: any) {
    logger.error('❌ 创建 schema_migrations 表失败:', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * 检查迁移是否已执行
 */
async function isMigrationExecuted(migrationId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT id FROM schema_migrations WHERE id = $1',
      [migrationId]
    );
    return result.rows.length > 0;
  } catch (error) {
    // 如果表不存在，说明还没有执行过任何迁移
    return false;
  }
}

/**
 * 记录迁移已执行
 */
async function recordMigration(migration: Migration): Promise<void> {
  await pool.query(
    'INSERT INTO schema_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [migration.id, migration.name]
  );
}

/**
 * 执行单个迁移
 */
async function executeMigration(migration: Migration): Promise<void> {
  const client = await pool.connect();

  try {
    logger.info(`开始执行迁移: ${migration.id} - ${migration.name}`);
    logger.info(`迁移SQL预览: ${migration.sql.substring(0, 100)}...`);

    await client.query('BEGIN');

    // 执行迁移SQL
    try {
      await client.query(migration.sql);
      logger.info(`迁移SQL执行成功: ${migration.id}`);
    } catch (sqlError: any) {
      logger.error(`迁移SQL执行失败: ${migration.id}`, {
        error: sqlError.message,
        code: sqlError.code,
        detail: sqlError.detail,
        hint: sqlError.hint,
        position: sqlError.position
      });
      throw sqlError;
    }

    // 记录迁移
    await client.query(
      'INSERT INTO schema_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [migration.id, migration.name]
    );

    await client.query('COMMIT');

    logger.info(`✅ 迁移执行成功: ${migration.id} - ${migration.name}`);
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error(`❌ 迁移执行失败: ${migration.id} - ${migration.name}`, {
      message: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 运行所有待执行的迁移
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('🔄 开始检查数据库迁移...');
    logger.info(`📋 共有 ${migrations.length} 个迁移待检查`);

    // 创建迁移历史表
    try {
      await createMigrationTable();
      logger.info('✅ 迁移历史表已就绪');
    } catch (error: any) {
      logger.error('❌ 创建迁移历史表失败:', error.message);
      throw error;
    }

    // 执行所有待执行的迁移
    let executedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      try {
        const executed = await isMigrationExecuted(migration.id);

        if (!executed) {
          logger.info(`🚀 准备执行迁移: ${migration.id} - ${migration.name}`);
          await executeMigration(migration);
          executedCount++;
        } else {
          logger.info(`⏭️  迁移已执行，跳过: ${migration.id} - ${migration.name}`);
          skippedCount++;
        }
      } catch (error: any) {
        logger.error(`❌ 迁移 ${migration.id} 执行失败:`, {
          name: migration.name,
          error: error.message,
          stack: error.stack
        });
        // 继续执行后续迁移
        continue;
      }
    }

    logger.info(`✅ 数据库迁移检查完成 - 执行: ${executedCount}, 跳过: ${skippedCount}`);
  } catch (error: any) {
    logger.error('❌ 数据库迁移系统失败:', {
      message: error.message,
      stack: error.stack
    });
    // 不抛出错误，让应用继续启动
    // throw error;
  }
}

/**
 * 获取已执行的迁移列表
 */
export async function getExecutedMigrations(): Promise<string[]> {
  try {
    const result = await pool.query(
      'SELECT id FROM schema_migrations ORDER BY executed_at'
    );
    return result.rows.map(row => row.id);
  } catch (error) {
    return [];
  }
}
