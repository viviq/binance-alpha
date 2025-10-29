-- 添加FDV和总供应量字段
-- 此迁移脚本用于添加完全稀释估值(FDV)和总供应量(total_supply)字段

-- 1. 添加字段到price_history表
ALTER TABLE price_history
ADD COLUMN IF NOT EXISTS total_supply DECIMAL(20, 2),
ADD COLUMN IF NOT EXISTS fdv DECIMAL(20, 2);

-- 2. 更新视图以包含新字段
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
WHERE c.is_active = true;

-- 3. 添加索引以优化查询性能（可选）
CREATE INDEX IF NOT EXISTS idx_price_history_fdv ON price_history(fdv) WHERE fdv IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_total_supply ON price_history(total_supply) WHERE total_supply IS NOT NULL;

-- 完成
-- 运行此迁移后，系统将能够存储和显示真实的FDV数据，而不是基于估算的值
