# 数据库清理指南

## 📊 数据库表分析

### 可以清理的表

| 表名 | 用途 | 建议保留期 | 清理影响 |
|------|------|-----------|----------|
| **collection_logs** | 数据采集日志 | 1-7天 或全部清理 | ✅ 无影响（仅日志） |
| **notifications** | 系统通知 | 7天 | ✅ 无影响（旧通知） |
| **price_history** | 价格历史 | 7天 | ⚠️ 影响历史图表 |
| **upcoming_futures** | 即将上线合约 | 30天（已上线） | ✅ 无影响 |
| **coins** (is_active=false) | 非活跃币对 | 6个月 | ⚠️ 会级联删除相关数据 |

### 不建议清理的表

| 表名 | 原因 |
|------|------|
| **coins** (is_active=true) | 核心业务数据 |
| **futures_data** | 数据量小，每币一条 |

---

## 🚀 新增的清理功能

### 1. 查看数据库统计信息

查看各表的记录数和占用空间：

```bash
# 方法1：通过 API
curl http://localhost:3001/api/database/stats

# 方法2：Railway 环境（需要替换为实际域名）
curl https://your-app.railway.app/api/database/stats
```

返回示例：
```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "table": "price_history",
        "rows": 145000,
        "size": "156 MB"
      },
      {
        "table": "collection_logs",
        "rows": 8500,
        "size": "2.5 MB"
      },
      {
        "table": "notifications",
        "rows": 320,
        "size": "128 kB"
      }
    ]
  }
}
```

---

### 2. 自动清理（每日凌晨3点）

✅ 已配置的自动清理任务：
- price_history: 保留 7天
- notifications: 保留 7天
- collection_logs: 保留 7天
- upcoming_futures: 保留 30天（status='listed'）

---

### 3. 手动清理所有旧数据

清理所有表的旧数据：

```bash
# 本地环境
curl -X POST http://localhost:3001/api/cleanup

# Railway 环境
curl -X POST https://your-app.railway.app/api/cleanup
```

返回示例：
```json
{
  "success": true,
  "data": {
    "priceHistory": 132480,
    "notifications": 250,
    "collectionLogs": 8200,
    "upcomingFutures": 15,
    "total": 140945,
    "message": "成功清理 140945 条旧数据"
  }
}
```

---

### 4. 清理所有采集日志（推荐！）

⚠️ **collection_logs 是最安全的清理目标**，可以全部删除：

```bash
# 本地环境
curl -X POST http://localhost:3001/api/cleanup/logs

# Railway 环境
curl -X POST https://your-app.railway.app/api/cleanup/logs
```

这会删除**所有** collection_logs 记录，完全安全！

---

## 💡 推荐的清理策略

### 立即执行（一次性清理）

1. **查看当前数据库状态**
   ```bash
   curl http://localhost:3001/api/database/stats
   ```

2. **清理所有采集日志**（最安全）
   ```bash
   curl -X POST http://localhost:3001/api/cleanup/logs
   ```

3. **清理其他旧数据**
   ```bash
   curl -X POST http://localhost:3001/api/cleanup
   ```

### 长期策略

- ✅ 自动清理会在**每天凌晨3点**自动执行
- ✅ 如果发现数据库还是很大，可以考虑：
  - 将 price_history 保留期缩短到 **3天**
  - 定期（每周）手动执行清理

---

## 🔧 直接在数据库中清理

如果你有数据库访问权限，也可以直接执行 SQL：

### 清理所有采集日志
```sql
DELETE FROM collection_logs;
```

### 清理所有通知
```sql
DELETE FROM notifications;
```

### 清理7天前的价格历史
```sql
DELETE FROM price_history
WHERE timestamp < NOW() - INTERVAL '7 days';
```

### 清理已上线的旧合约公告
```sql
DELETE FROM upcoming_futures
WHERE status = 'listed'
AND updated_at < NOW() - INTERVAL '30 days';
```

---

## 📈 预期效果

假设运行1个月后的数据量（20个币种）：

| 项目 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| price_history | ~172,800条 (30天) | ~40,320条 (7天) | 77% |
| collection_logs | ~8,640条 | ~2,016条 (7天) | 77% |
| notifications | 无限制积累 | ~336条 (7天) | >90% |
| **总体数据库大小** | ~500MB | ~150MB | **70%** |

---

## ⚠️ 注意事项

1. **首次清理**：建议先查看统计信息，再决定清理策略
2. **备份**：如果不确定，先备份数据库
3. **监控**：查看每日凌晨3点的清理日志
4. **调整**：如果需要更长/短的保留期，可以修改代码中的默认值

---

## 🆘 常见问题

### Q: collection_logs 可以全部删除吗？
A: ✅ 可以！这只是日志表，删除后不影响任何功能。

### Q: 删除 price_history 会影响图表吗？
A: ⚠️ 会影响历史图表的显示范围，但不影响实时数据。

### Q: 如何恢复误删的数据？
A: ❌ 无法恢复。删除前请确认或做好备份。

### Q: 自动清理任务失败了怎么办？
A: 检查后端日志，搜索 "数据清理" 相关信息。

---

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看后端日志：`railway logs`
2. 检查数据库连接
3. 手动执行 SQL 清理脚本
