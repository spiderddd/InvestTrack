# InvestTrack 计算逻辑文档

## 概述

本文档梳理 InvestTrack 项目中所有涉及计算的逻辑，包括计算位置（前端/后端）、计算方式（SQL/内存）、计算逻辑说明以及计算目的。

---

## 一、后端计算逻辑

### 1. 核心指标计算 (dashboardService.js)

#### 1.1 区间盈亏与收益率
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:120-121` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | `profit = (期末市值 - 期末成本) - (期初市值 - 期初成本)` |
| **收益率公式** | `returnRate = 期初投入 > 0 ? (profit / 期初投入) * 100 : 0` |
| **计算目的** | 计算选定时间区间（今年来/近一年/全部）的投资盈亏和收益率 |

#### 1.2 总市值/总成本汇总
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:109-112, 141` |
| **计算方式** | JavaScript `reduce` 累加 |
| **计算逻辑** | `assets.reduce((sum, a) => sum + a.marketValue, 0)` |
| **计算目的** | 计算过滤后资产的市值总和与成本总和 |

#### 1.3 时间范围计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:76-89` |
| **计算方式** | JavaScript Date 对象操作 |
| **计算逻辑** | - YTD: 找当前年份第一个快照<br>- 1年: `new Date().setFullYear(new Date().getFullYear() - 1)` |
| **计算目的** | 根据 timeRange 参数确定区间起始点 |

---

### 2. 资产配置计算 (dashboardService.js)

#### 2.1 资产类别占比
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:145-162` |
| **计算方式** | JavaScript `reduce` 分组 + 内存计算 |
| **计算逻辑** | `percent = (类别市值 / 总市值) * 100` |
| **类别映射** | security/fund → 股票基金<br>fixed/wealth → 现金固收<br>gold/crypto → 商品另类 |
| **计算目的** | 计算大类资产配置比例（总览视图） |

#### 2.2 策略层级占比
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:176-197` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | `actualPercent = (层级市值 / 策略总市值) * 100` |
| **计算目的** | 计算各防御层级在策略中的实际占比 |

#### 2.3 偏离度计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:194, 226` |
| **计算方式** | JavaScript 减法运算 |
| **计算逻辑** | `deviation = 实际占比 - 目标占比` |
| **计算目的** | 显示实际配置与策略目标的偏离程度 |

#### 2.4 权重自动分配
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:209-213` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | 1. `usedWeight = 固定权重项之和`<br>2. `remaining = Math.max(0, 100 - usedWeight)`<br>3. `autoWeight = 自动项数量 > 0 ? remaining / 数量 : 0` |
| **计算目的** | 为标记为"自动"(-1)的资产平均分配剩余权重 |

---

### 3. 收益归因计算 (dashboardService.js)

#### 3.1 类别盈亏归因
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:330-370` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | `profit = (期末市值-期末成本) - (期初市值-期初成本)`<br>`changeVal = 期末市值 - 期初市值`<br>`changeInput = 期末成本 - 期初成本` |
| **计算目的** | 按资产类别分析区间盈亏来源 |

#### 3.2 层级/资产盈亏归因
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/dashboardService.js:375-413` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | 同上，按层级或单个资产聚合计算 |
| **计算目的** | 支持按策略层级或单个资产查看收益归因 |

---

### 4. SQL 聚合计算 (snapshotService.js)

#### 4.1 快照总数统计
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:11` |
| **计算方式** | SQL COUNT 聚合 |
| **SQL语句** | `SELECT COUNT(*) as count FROM snapshots` |
| **计算目的** | 分页时获取快照总数 |

#### 4.2 月度投入统计
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:15-21` |
| **计算方式** | SQL SUM + GROUP BY |
| **SQL语句** | `SELECT s.id, s.date, COALESCE(SUM(t.cost_change), 0) as totalInvested FROM snapshots s LEFT JOIN transactions t ON s.date = t.date GROUP BY s.id` |
| **计算目的** | 计算每个月的总投入金额 |

#### 4.3 持仓聚合计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:39-43, 173-183` |
| **计算方式** | SQL SUM + GROUP BY + HAVING |
| **SQL语句** | `SELECT asset_id, SUM(quantity_change) as quantity, SUM(cost_change) as totalCost FROM transactions WHERE date <= ? GROUP BY asset_id HAVING quantity != 0` |
| **计算目的** | 计算某个时间点（累计到某月）的持仓数量和成本 |

---

### 5. 市值计算 (snapshotService.js)

#### 5.1 单项资产市值
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:58, 137, 311` |
| **计算方式** | JavaScript 乘法运算 |
| **计算逻辑** | `marketValue = quantity * price` |
| **计算目的** | 计算单个资产的当前市值 |

#### 5.2 总资产市值
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:320-321` |
| **计算方式** | JavaScript `reduce` 累加 |
| **计算逻辑** | `totalValue = assets.reduce((sum, a) => sum + a.marketValue, 0)` |
| **计算目的** | 计算投资组合总市值 |

#### 5.3 价格日期处理
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/snapshotService.js:49, 126, 192` |
| **计算方式** | JavaScript 字符串操作 |
| **计算逻辑** | `priceDate = date.length === 7 ? \`${date}-31\` : date` |
| **计算目的** | 将 YYYY-MM 格式转换为 YYYY-MM-DD 用于价格查询 |

---

### 6. 价格同步计算 (priceSyncService.js)

#### 6.1 东方财富价格转换
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/priceSyncService.js:51` |
| **计算方式** | JavaScript 除法 |
| **计算逻辑** | `price = data.data.f43 / 100` |
| **计算目的** | 东方财富 API 返回的价格是整数（分），需转换为元 |

#### 6.2 K线收盘价解析
| 项目 | 详情 |
|------|------|
| **文件位置** | `server/services/priceSyncService.js:84` |
| **计算方式** | JavaScript parseFloat |
| **计算逻辑** | `price = parseFloat(last[2])` |
| **计算目的** | 从 K 线数据数组中提取收盘价 |

---

## 二、前端计算逻辑

### 1. 仪表盘指标卡 (MetricsCards.tsx)

#### 1.1 区间盈亏计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/dashboard/MetricsCards.tsx:19-21` |
| **计算方式** | JavaScript 条件运算 |
| **计算逻辑** | 全部时间: `期末市值 - 期末投入`<br>区间: `(期末市值-期末投入) - (期初市值-期初投入)` |
| **计算目的** | 显示累计或区间盈亏金额 |

#### 1.2 区间收益率
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/dashboard/MetricsCards.tsx:22` |
| **计算方式** | JavaScript 除法运算 |
| **计算逻辑** | `returnRate = 期末投入 > 0 ? (盈亏 / 期末投入) * 100 : 0` |
| **计算目的** | 显示投资收益率百分比 |

---

### 2. 资产管理器 (AssetManager.tsx)

#### 2.1 资产卡片盈亏
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/AssetManager.tsx:152-153` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | `profit = marketValue - totalCost`<br>`roi = totalCost > 0 ? (profit / totalCost) * 100 : 0` |
| **计算目的** | 在资产卡片显示盈亏金额和收益率 |

#### 2.2 历史记录盈亏
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/AssetManager.tsx:81-82, 487-488` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | 同上 |
| **计算目的** | 在历史详情弹窗中计算每条记录的盈亏 |

---

### 3. 策略管理器 (StrategyManager.tsx)

#### 3.1 层级总权重
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/StrategyManager.tsx:285` |
| **计算方式** | JavaScript `reduce` 累加 |
| **计算逻辑** | `totalLayerWeight = layers.reduce((sum, l) => sum + l.weight, 0)` |
| **计算目的** | 校验所有层级的权重之和是否为 100% |

#### 3.2 层内权重分配
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/StrategyManager.tsx:477-481` |
| **计算方式** | JavaScript 内存计算 |
| **计算逻辑** | 1. `fixedItems = items.filter(i => i.weight >= 0)`<br>2. `usedWeight = fixedItems.reduce((sum, i) => sum + i.weight, 0)`<br>3. `remaining = Math.max(0, 100 - usedWeight)`<br>4. `autoWeight = autoItems.length > 0 ? remaining / autoItems.length : 0` |
| **计算目的** | 自动分配剩余权重给标记为"自动"的资产 |

#### 3.3 全局权重计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/StrategyManager.tsx:525` |
| **计算方式** | JavaScript 乘除运算 |
| **计算逻辑** | `globalWeight = (layer.weight * effectiveWeight / 100).toFixed(1)` |
| **计算目的** | 计算资产在整个投资组合中的实际权重 |

#### 3.4 有效权重确定
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/StrategyManager.tsx:506` |
| **计算方式** | JavaScript 条件运算 |
| **计算逻辑** | `effectiveWeight = item.weight === -1 ? autoWeight : item.weight` |
| **计算目的** | 确定资产实际使用的权重值（手动或自动） |

#### 3.5 剩余权重计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/StrategyManager.tsx:306-317` |
| **计算方式** | JavaScript `filter` + `reduce` |
| **计算逻辑** | `remaining = 100 - 已用固定权重（排除当前编辑项）` |
| **计算目的** | 在资产编辑弹窗中显示剩余可用权重 |

---

### 4. 快照表单 (useSnapshotForm.ts)

#### 4.1 交易方向处理
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:225` |
| **计算方式** | JavaScript 条件运算 |
| **计算逻辑** | `sign = transactionType === 'sell' ? -1 : 1` |
| **计算目的** | 卖出为负，买入为正 |

#### 4.2 变动数量计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:227-230` |
| **计算方式** | JavaScript 乘法运算 |
| **计算逻辑** | `qChange = quantityChangeAbs * sign`<br>`cChange = costChangeAbs * sign` |
| **计算目的** | 根据买卖方向计算带符号的变动数量 |

#### 4.3 新持仓计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:233-234` |
| **计算方式** | JavaScript 加法运算 |
| **计算逻辑** | `newQuantity = prevQuantity + qChange`<br>`newCost = prevCost + cChange` |
| **计算目的** | 计算交易后的新持仓数量和成本 |

#### 4.4 市值计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:243` |
| **计算方式** | JavaScript 乘法运算 |
| **计算逻辑** | `marketValue = newQuantity * price` |
| **计算目的** | 计算交易后的资产市值 |

#### 4.5 表单总值计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:251-252` |
| **计算方式** | JavaScript `reduce` 累加 |
| **计算逻辑** | `totalVal = assets.reduce((sum, a) => sum + a.marketValue, 0)` |
| **计算目的** | 计算表单中所有资产的总市值和总成本 |

#### 4.6 固收类同步
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useSnapshotForm.ts:183-185` |
| **计算方式** | JavaScript 条件赋值 |
| **计算逻辑** | `if (category === 'fixed' \|\| category === 'wealth') quantityChange = costChange` |
| **计算目的** | 存款/理财类资产数量等于本金变动 |

---

### 5. 快照录入表单 (SnapshotEntryForm.tsx)

#### 5.1 实时总资产计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/snapshots/SnapshotEntryForm.tsx:57-63` |
| **计算方式** | JavaScript `reduce` 累加 |
| **计算逻辑** | `totalAssetsVal = rows.reduce((sum, r) => sum + (price * quantity), 0)` |
| **计算目的** | 实时计算表单中所有资产的总市值（含变动后） |

#### 5.2 当前持仓计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/snapshots/SnapshotEntryForm.tsx:173-176` |
| **计算方式** | JavaScript 运算 |
| **计算逻辑** | `currentQ = prevQuantity + qChangeSigned`<br>`currentVal = currentQ * price` |
| **计算目的** | 实时显示每项资产的当前持仓和市值 |

#### 5.3 隐含收益计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/snapshots/SnapshotEntryForm.tsx:177` |
| **计算方式** | JavaScript 减法运算 |
| **计算逻辑** | `impliedProfit = isCashLike ? (qChangeSigned - cChangeSigned) : 0` |
| **计算目的** | 存款类资产显示利息收益 |

---

### 6. 历史盈亏表格 (HistorySection.tsx)

#### 6.1 单项 ROI 计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/dashboard/HistorySection.tsx:97` |
| **计算方式** | JavaScript 除法运算 |
| **计算逻辑** | `roi = endCost > 0 ? (profit / endCost) * 100 : 0` |
| **计算目的** | 计算每个资产/层级的收益率 |

#### 6.2 汇总统计
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/components/dashboard/HistorySection.tsx:87-94` |
| **计算方式** | JavaScript `reduce` 聚合 |
| **计算逻辑** | `breakdownTotals = breakdownData.reduce((acc, row) => {...}, { endVal: 0, ... })` |
| **计算目的** | 汇总所有行的市值、成本、盈亏 |

---

### 7. 资产分组 (useAssetGrouping.ts)

#### 7.1 按市值排序
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/hooks/useAssetGrouping.ts:151-157` |
| **计算方式** | JavaScript `sort` |
| **计算逻辑** | `items.sort((a, b) => b.marketValue - a.marketValue)` |
| **计算目的** | 将资产按市值从大到小排序 |

---

### 8. 日期计算 (calculators.ts)

#### 8.1 月末日期计算
| 项目 | 详情 |
|------|------|
| **文件位置** | `client/src/utils/calculators.ts:23-25` |
| **计算方式** | JavaScript Date 对象 |
| **计算逻辑** | `lastDay = new Date(year, month, 0).getDate()` |
| **计算目的** | 获取某月的最后一天日期 |

---

## 三、计算方式统计汇总

### 按位置统计

| 计算位置 | 计算次数 | 主要类型 |
|----------|----------|----------|
| dashboardService.js | 25+ | 收益率、配置、归因 |
| snapshotService.js | 15+ | 市值、持仓聚合 |
| MetricsCards.tsx | 3 | 区间盈亏、收益率 |
| AssetManager.tsx | 6 | 卡片盈亏、历史盈亏 |
| StrategyManager.tsx | 10+ | 权重分配、校验 |
| useSnapshotForm.ts | 8 | 交易计算、持仓更新 |
| SnapshotEntryForm.tsx | 4 | 实时计算 |

### 按类型统计

| 计算类型 | 出现次数 | 典型公式 |
|----------|----------|----------|
| reduce 求和 | 20+ | `arr.reduce((s, i) => s + i.value, 0)` |
| 市值计算 | 10+ | `quantity * price` |
| 收益率 | 8 | `(市值-成本)/成本*100%` |
| 权重分配 | 6 | `remaining/numAutoItems` |
| 偏离度 | 4 | `actual - target` |
| SQL SUM | 5 | `SUM(cost_change)` |

---

## 四、核心公式速查

### 4.1 收益率相关
```javascript
// 单项资产 ROI
roi = totalCost > 0 ? ((marketValue - totalCost) / totalCost * 100) : 0

// 区间收益率
periodReturnRate = startInvested > 0 ? (periodProfit / startInvested * 100) : 0

// 区间盈亏
periodProfit = (endValue - endInvested) - (startValue - startInvested)
```

### 4.2 配置相关
```javascript
// 类别占比
categoryPercent = (categoryValue / totalValue) * 100

// 层级实际占比
layerActualPercent = (layerValue / strategyTotalValue) * 100

// 偏离度
deviation = actualPercent - targetPercent

// 自动权重
autoWeight = remainingWeight / autoItemsCount
```

### 4.3 市值相关
```javascript
// 单项市值
marketValue = quantity * price

// 总资产
 totalValue = assets.reduce((sum, a) => sum + a.marketValue, 0)

// 持仓更新
newQuantity = prevQuantity + quantityChange
newCost = prevCost + costChange
```

---

## 五、注意事项

1. **精度处理**: 所有百分比保留 1 位小数（`toFixed(1)`），金额使用 `toLocaleString()` 格式化
2. **除零保护**: 所有除法运算都有除零检查（`> 0 ? ... : 0`）
3. **固收类特殊处理**: fixed/wealth 类型资产价格固定为 1，数量等于本金
4. **时间格式**: 策略使用 YYYY-MM-DD，快照使用 YYYY-MM，计算时需要转换
5. **缓存策略**: snapshotService 使用 LRU 缓存计算结果（totals、historyGraph）
