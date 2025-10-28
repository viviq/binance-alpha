# 合约未平仓量数据修复

## 问题描述
合约未平仓量数据不准确，显示的数据异常大。

## 问题原因
币安API的 `/openInterest` 接口返回的是**合约数量**（如BTC数量），而不是USDT价值。

例如：
- BTCUSDT的openInterest返回：`79291.210`
- 单位：79291.210个BTC
- 实际USDT价值：79291.210 × BTC价格 ≈ 54亿美元

但我们直接显示了这个数字，导致显示不正确。

## 修复方案

### 修改文件：`backend/src/services/binanceService.ts`

**修改前**:
```typescript
const openInterest = await this.getOpenInterest(symbol);

return {
  is_listed: true,
  futures_price: parseFloat(ticker[0].lastPrice),
  open_interest: openInterest, // 直接使用原始数据
  ...
};
```

**修改后**:
```typescript
const openInterestRaw = await this.getOpenInterest(symbol);
const futuresPrice = parseFloat(ticker[0].lastPrice);

// 计算未平仓量的USDT价值
// openInterest API返回的是合约数量，需要乘以价格得到USDT价值
let openInterestUSDT: number | null = null;
if (openInterestRaw && futuresPrice > 0) {
  openInterestUSDT = openInterestRaw * futuresPrice;
}

return {
  is_listed: true,
  futures_price: futuresPrice,
  open_interest: openInterestUSDT, // 转换为USDT价值
  ...
};
```

## 计算公式

```
未平仓量(USDT) = 未平仓量(合约数量) × 合约价格
```

## 示例

**修复前**:
- BTCUSDT: open_interest = 79291.210
- 显示异常大

**修复后**:
- BTCUSDT: 
  - 合约数量: 79291.210 BTC
  - 合约价格: $68,000
  - open_interest = 79291.210 × 68000 = 5,391,802,280 USDT
  - 显示：5.39B（格式化后）

## 数据单位说明

币安API各字段单位：
- `openInterest`: 合约数量（如BTC数量）
- `volume`: 24小时交易量（合约数量）
- `quoteVolume`: 24小时交易额（USDT）

## 已完成

- ✅ 识别未平仓量单位问题
- ✅ 修改计算逻辑，将合约数量转换为USDT价值
- ✅ 重新构建并部署后端
- ✅ 等待数据刷新验证

## 验证方法

```bash
# 查看修复后的数据
curl http://localhost:3001/api/coins | jq '.data.items[] | select(.futures_data.is_listed == true) | {symbol, futures_price: .futures_data.futures_price, open_interest: .futures_data.open_interest}'
```

预期结果：未平仓量应该是合理的USDT价值范围。

