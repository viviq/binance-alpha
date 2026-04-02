# 修复非Alpha币种显示问题

## 问题描述

网站上显示了很多并没有上过Binance Alpha的币对。这是因为：

1. 当无法从币安Alpha API获取数据时，备用方案会获取所有币安现货交易对作为"模拟数据"
2. 这些非Alpha币种被保存到数据库中
3. 数据库视图没有正确筛选，导致非Alpha币种也被显示

## 修复方案

### 1. 代码修复（已完成）

已修改以下文件：

- **backend/src/database/migrations.ts**
  - 添加了新的迁移 `003_fix_view_to_filter_alpha_coins_only`
  - 修改视图 `v_coins_latest`，只显示有 `alpha_id` 的币种
  - 自动清理没有 `alpha_id` 的非Alpha币种

- **backend/src/services/binanceService.ts**
  - 修改 `getMockAlphaCoins()` 方法，不再生成模拟数据
  - 当无法获取Alpha API数据时，返回空数组而不是所有现货交易对

### 2. 应用修复

#### 方法一：自动迁移（推荐）

重启后端服务，迁移会自动执行：

```bash
cd backend
npm run dev
# 或
npm start
```

迁移会自动：
- 更新数据库视图，只显示Alpha币种
- 删除所有非Alpha币种及其相关数据

#### 方法二：手动清理

如果需要立即清理而不重启服务，可以运行清理脚本：

```bash
# 本地数据库
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
node clean-non-alpha-coins.js

# 或者直接传递数据库URL
node clean-non-alpha-coins.js "postgresql://user:password@localhost:5432/dbname"

# Railway生产数据库
node clean-non-alpha-coins.js "postgresql://..."
```

### 3. 验证修复

1. 刷新前端页面 https://pre.voooa.com/
2. 刷新合约页面 https://pre.voooa.com/futures
3. 确认只显示真正的Alpha币种

## 技术细节

### 如何识别Alpha币种

真正的Alpha币种具有以下特征：
- 有 `alpha_id` 字段（格式如：ALPHA_173）
- 有 `alpha_listing_time` 字段
- 有 `chain_id` 和 `contract_address` 字段

### 数据库表结构

```sql
-- coins表
CREATE TABLE coins (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100),
  alpha_listing_time TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  alpha_id VARCHAR(50),          -- Alpha ID，如：ALPHA_173
  chain_id VARCHAR(50),           -- 链ID，如：56(BSC)、CT_501(Solana)
  contract_address TEXT,          -- 合约地址
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 修复前后对比

**修复前的视图查询：**
```sql
SELECT * FROM coins WHERE is_active = true;
-- 包含所有活跃币种，包括非Alpha币种
```

**修复后的视图查询：**
```sql
SELECT * FROM coins
WHERE is_active = true
  AND alpha_id IS NOT NULL;
-- 只包含真正的Alpha币种
```

## 预防措施

1. **数据采集**：现在当Alpha API不可用时，不再生成模拟数据
2. **数据验证**：视图层面增加了筛选，确保只显示Alpha币种
3. **日志记录**：当API不可用时，会记录警告日志

## 故障排查

如果修复后仍然看到非Alpha币种：

1. **清除浏览器缓存**
   - 前端有15秒缓存，等待缓存过期或强制刷新（Ctrl+Shift+R）

2. **检查后端日志**
   ```bash
   cd backend
   npm run dev
   # 查看是否有 "无法从币安Alpha API获取数据" 的警告
   ```

3. **手动验证数据库**
   ```sql
   -- 查看是否还有非Alpha币种
   SELECT COUNT(*) FROM coins WHERE alpha_id IS NULL;

   -- 查看视图数据
   SELECT COUNT(*) FROM v_coins_latest;
   ```

4. **重新运行清理脚本**
   ```bash
   node clean-non-alpha-coins.js "$DATABASE_URL"
   ```

## 相关文件

- `backend/src/database/migrations.ts` - 数据库迁移文件
- `backend/src/services/binanceService.ts` - 币安API服务
- `backend/src/services/dataCollector.ts` - 数据采集服务
- `backend/src/database/dbService.ts` - 数据库服务
- `clean-non-alpha-coins.js` - 手动清理脚本
