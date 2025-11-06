-- 清理 collection_logs 表的所有历史数据
-- 这个表只是日志记录，清理后不影响业务功能

-- 查看当前记录数
SELECT COUNT(*) as total_logs FROM collection_logs;

-- 查看按状态分组的统计
SELECT status, COUNT(*) as count
FROM collection_logs
GROUP BY status;

-- 查看最早和最新的记录
SELECT
    MIN(started_at) as earliest,
    MAX(started_at) as latest
FROM collection_logs;

-- 清理所有历史记录（可选：只保留最近1天）
-- DELETE FROM collection_logs WHERE started_at < NOW() - INTERVAL '1 day';

-- 或者清理全部
-- DELETE FROM collection_logs;

-- 查看清理后的记录数
SELECT COUNT(*) as remaining_logs FROM collection_logs;
