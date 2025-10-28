import { pool } from './config';
import { logger } from '../utils/logger';

const SCHEMA_SQL = `
-- 币对基础信息表
CREATE TABLE IF NOT EXISTS coins (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    alpha_listing_time TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    alpha_id VARCHAR(100),
    chain_id VARCHAR(50),
    contract_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
CREATE INDEX IF NOT EXISTS idx_coins_alpha_listing_time ON coins(alpha_listing_time);
CREATE INDEX IF NOT EXISTS idx_coins_is_active ON coins(is_active);

-- 价格历史数据表
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    coin_id INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    price DECIMAL(20, 8),
    volume_24h DECIMAL(20, 2),
    market_cap DECIMAL(20, 2),
    circulating_supply DECIMAL(20, 2),
    price_change_24h DECIMAL(10, 4),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_coin_id ON price_history(coin_id);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_coin_timestamp ON price_history(coin_id, timestamp);

-- 合约数据表
CREATE TABLE IF NOT EXISTS futures_data (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE UNIQUE,
    symbol VARCHAR(50) NOT NULL,
    is_listed BOOLEAN DEFAULT false,
    listing_time TIMESTAMP,
    futures_price DECIMAL(20, 8),
    open_interest DECIMAL(20, 2),
    open_interest_1h DECIMAL(20, 2),
    oi_to_mcap_ratio DECIMAL(10, 6),
    open_interest_market_cap_ratio DECIMAL(10, 6),
    futures_volume_24h DECIMAL(20, 2),
    spot_futures_spread DECIMAL(10, 4),
    mark_price DECIMAL(20, 8),
    index_price DECIMAL(20, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_futures_data_symbol ON futures_data(symbol);
CREATE INDEX IF NOT EXISTS idx_futures_data_is_listed ON futures_data(is_listed);
CREATE INDEX IF NOT EXISTS idx_futures_data_listing_time ON futures_data(listing_time);

-- 通知历史表
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    coin_symbol VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_coin_symbol ON notifications(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 数据收集任务日志表
CREATE TABLE IF NOT EXISTS collection_logs (
    id BIGSERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    coins_processed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collection_logs_task_type ON collection_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_collection_logs_status ON collection_logs(status);
CREATE INDEX IF NOT EXISTS idx_collection_logs_started_at ON collection_logs(started_at);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加更新时间触发器
DROP TRIGGER IF EXISTS update_coins_updated_at ON coins;
CREATE TRIGGER update_coins_updated_at
    BEFORE UPDATE ON coins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_futures_data_updated_at ON futures_data;
CREATE TRIGGER update_futures_data_updated_at
    BEFORE UPDATE ON futures_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建视图：币对最新数据
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
WHERE c.is_active = true;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_price_history_latest
    ON price_history (coin_id, timestamp DESC);

-- 即将上线合约表
CREATE TABLE IF NOT EXISTS upcoming_futures (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    announcement_id VARCHAR(100) UNIQUE,
    announcement_title TEXT,
    announcement_url TEXT,
    expected_listing_date DATE,
    expected_listing_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, listed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upcoming_futures_symbol ON upcoming_futures(symbol);
CREATE INDEX IF NOT EXISTS idx_upcoming_futures_status ON upcoming_futures(status);
CREATE INDEX IF NOT EXISTS idx_upcoming_futures_expected_time ON upcoming_futures(expected_listing_time);

DROP TRIGGER IF EXISTS update_upcoming_futures_updated_at ON upcoming_futures;
CREATE TRIGGER update_upcoming_futures_updated_at
    BEFORE UPDATE ON upcoming_futures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('开始初始化数据库...');

    // 执行 SQL
    await pool.query(SCHEMA_SQL);

    logger.info('数据库初始化成功');
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
}
