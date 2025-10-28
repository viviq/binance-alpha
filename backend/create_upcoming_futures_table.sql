-- 创建即将上线的合约表
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
CREATE INDEX IF NOT EXISTS idx_upcoming_futures_listing_time ON upcoming_futures(expected_listing_time);

-- 显示表结构
\d upcoming_futures;

SELECT 'upcoming_futures 表创建成功！' AS message;
