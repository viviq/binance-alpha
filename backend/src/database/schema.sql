-- 币安Alpha监控系统数据库Schema

-- 创建数据库（如果需要）
-- CREATE DATABASE binance_alpha;

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_symbol (symbol),
    INDEX idx_alpha_listing_time (alpha_listing_time),
    INDEX idx_is_active (is_active)
);

-- 价格历史数据表（时序数据）
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    coin_id INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    price DECIMAL(20, 8),
    volume_24h DECIMAL(20, 2),
    market_cap DECIMAL(20, 2),
    circulating_supply DECIMAL(20, 2),
    price_change_24h DECIMAL(10, 4),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_coin_id (coin_id),
    INDEX idx_symbol (symbol),
    INDEX idx_timestamp (timestamp),
    INDEX idx_coin_timestamp (coin_id, timestamp)
);

-- 合约数据表
CREATE TABLE IF NOT EXISTS futures_data (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_coin (coin_id),
    INDEX idx_symbol (symbol),
    INDEX idx_is_listed (is_listed),
    INDEX idx_listing_time (listing_time)
);

-- 通知历史表
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    coin_symbol VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_type (type),
    INDEX idx_coin_symbol (coin_symbol),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read)
);

-- 数据收集任务日志表
CREATE TABLE IF NOT EXISTS collection_logs (
    id BIGSERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    coins_processed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,

    INDEX idx_task_type (task_type),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at)
);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_coins_updated_at
    BEFORE UPDATE ON coins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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
