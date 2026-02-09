# InvestTrack 前端计算逻辑分析文档

本文档详细记录了 `client/src` 目录下所有包含计算逻辑的代码，包括 hooks、components、services 和 utils 中的计算逻辑。

---

## 1. Hooks 中的计算逻辑

### `/home/qyao/gitspace/InvestTrack/client/src/hooks/useAssetGrouping.ts`

#### `assetPerformanceMap` (useMemo)
- **用途**: 从月度账单详情中提取资产表现数据，构建资产ID到表现数据的映射
- **输入**: `viewStatement` (MonthlyStatementDetail), `selectedDate` (选择的日期)
- **输出**: Map<string, AssetPerformance>，key为资产ID，value包含quantity、marketValue、totalCost、unitPrice、date、isHistorical
- **算法/步骤**:
  1. 遍历 `viewStatement.positions` 中的所有持仓
  2. 过滤掉 `quantity === 0` 的持仓
  3. 为每个持仓创建 AssetPerformance 对象
  4. 如果 `selectedDate === 'latest'`，标记为实时数据，否则标记为历史数据

```typescript
const assetPerformanceMap = useMemo(() => {
  const map = new Map<string, AssetPerformance>();
  if (viewStatement && viewStatement.positions) {
      viewStatement.positions.forEach((a: Position) => {
          if (a.quantity !== 0) {
              map.set(a.assetId, {
                  quantity: a.quantity,
                  marketValue: a.marketValue,
                  totalCost: a.totalCost,
                  unitPrice: a.unitPrice,
                  date: viewStatement.date,
                  isHistorical: selectedDate !== 'latest'
              });
          }
      });
  }
  return map;
}, [viewStatement, selectedDate]);
```

#### `displaySections` (useMemo)
- **用途**: 根据分组方式（类别或层级）将资产组织成展示区块
- **输入**: `assets` (所有资产), `groupBy` (分组方式), `assetPerformanceMap` (资产表现数据), `activeStrategy` (当前策略)
- **输出**: Array of sections，每个section包含id、label、icon、color、items
- **算法/步骤**:
  1. 根据 `groupBy` 初始化sections数组（按类别或按层级）
  2. 如果按层级，建立资产到层级的映射
  3. 遍历所有资产，根据搜索词过滤
  4. 根据showHeldOnly过滤未持仓资产
  5. 将资产分配到对应section
  6. 按市值降序排序每个section内的资产

```typescript
const displaySections = useMemo(() => {
  let sections: any[] = [];
  // 按类别或按层级初始化sections...
  // 遍历资产并分配到对应section...
  // 按市值排序...
  return sections.filter(s => s.items.length > 0);
}, [assets, searchTerm, assetPerformanceMap, showHeldOnly, groupBy, activeStrategy]);
```

---

### `/home/qyao/gitspace/InvestTrack/client/src/hooks/useDashboardData.ts`

#### `rangeConfig` (useMemo)
- **用途**: 根据时间范围配置计算起始日期和标签
- **输入**: `timeRange` ('all' | 'ytd' | '1y')
- **输出**: { startDate: string | null, label: string }
- **算法/步骤**:
  - `'all'`: startDate = null, label = '历史累计'
  - `'ytd'`: startDate = 'YYYY-01' (当年第一天), label = '今年以来'
  - `'1y'`: startDate = 'YYYY-MM-01' (一年前), label = '近一年'

```typescript
const rangeConfig = useMemo(() => {
  if (timeRange === 'all') return { startDate: null, label: '历史累计' };
  const now = new Date();
  let start = new Date();
  if (timeRange === 'ytd') {
    start = new Date(now.getFullYear(), 0, 1);
    return { startDate: start.toISOString().slice(0, 7), label: '今年以来' };
  } else {
    start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    return { startDate: start.toISOString().slice(0, 7), label: '近一年' };
  }
}, [timeRange]);
```

#### `breakdownTotals` (useMemo)
- **用途**: 汇总分解数据表的所有数值
- **输入**: `breakdownData` (分解数据数组)
- **输出**: { endVal, endCost, changeVal, changeInput, profit }
- **算法/步骤**: 遍历breakdownData，累加每个字段

```typescript
const breakdownTotals = useMemo(() => {
  return breakdownData.reduce((acc, row) => ({
      endVal: acc.endVal + row.endVal,
      endCost: acc.endCost + row.endCost,
      changeVal: acc.changeVal + row.changeVal,
      changeInput: acc.changeInput + row.changeInput,
      profit: acc.profit + row.profit
  }), { endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0 });
}, [breakdownData]);
```

---

### `/home/qyao/gitspace/InvestTrack/client/src/hooks/useStatementForm.ts`

#### `prepareSubmission` (函数)
- **用途**: 将表单数据转换为月度账单详情对象
- **输入**: `rows` (表单行数据数组), `date`, `note`
- **输出**: MonthlyStatementDetail 对象
- **算法/步骤**:
  1. 遍历rows，计算每个资产的新持仓量和新成本
  2. 应用买入/卖出符号
  3. 计算市值 = 持仓量 × 单价
  4. 汇总总市值和总投入
  5. 返回完整的账单详情对象

```typescript
const prepareSubmission = (): MonthlyStatementDetail => {
  const finalPositions: Position[] = rows.map(r => {
      const price = (r.category === 'fixed' || r.category === 'wealth') ? 1 : (parseFloat(r.price) || 0);
      const sign = r.transactionType === 'sell' ? -1 : 1;
      const qChangeAbs = parseFloat(r.quantityChange) || 0;
      const cChangeAbs = parseFloat(r.costChange) || 0;
      const qChange = qChangeAbs * sign;
      const cChange = cChangeAbs * sign;
      const newQuantity = r.prevQuantity + qChange;
      const newCost = r.prevCost + cChange;
      return {
          id: r.recordId,
          assetId: r.assetId || generateId(),
          name: r.name,
          category: r.category,
          unitPrice: price,
          quantity: newQuantity,
          marketValue: newQuantity * price,
          totalCost: newCost,
          addedPrincipal: cChange,
          addedQuantity: qChange,
          note: r.note
      };
  });
  const totalVal = finalPositions.reduce((sum: number, p: Position) => sum + p.marketValue, 0);
  const totalInv = finalPositions.reduce((sum: number, p: Position) => sum + p.totalCost, 0);
  return {
      id: selectedStatementId || generateId(),
      date,
      positions: finalPositions,
      totalValue: totalVal,
      totalInvested: totalInv,
      note: note
  };
};
```

---

## 2. Utils 中的计算逻辑

### `/home/qyao/gitspace/InvestTrack/client/src/utils/calculators.ts`

#### `getStrategyForDate`
- **用途**: 根据日期查找适用的策略版本
- **输入**: `versions` (策略版本数组), `dateStr` (日期字符串)
- **输出**: StrategyVersion | null
- **算法/步骤**:
  1. 按startDate降序排序策略版本
  2. 处理YYYY-MM格式（获取该月最后一天）
  3. 找到第一个startDate小于等于目标日期的策略
  4. 如果没找到，返回最新版本

```typescript
export const getStrategyForDate = (versions: StrategyVersion[], dateStr: string): StrategyVersion | null => {
  if (!versions || versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => b.startDate.localeCompare(a.startDate));
  let targetDate: string;
  if (dateStr.length === 7) {
      const [year, month] = dateStr.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      targetDate = `${dateStr}-${lastDay.toString().padStart(2, '0')}`;
  } else {
      targetDate = dateStr;
  }
  return sorted.find(v => v.startDate <= targetDate) || sorted[sorted.length - 1];
};
```

#### `getAssetTargetMap`
- **用途**: 构建资产ID到策略目标及其层级ID的映射
- **输入**: `strategy` (策略版本)
- **输出**: Map<string, { target: StrategyTarget, layerId: string }>
- **算法/步骤**: 遍历策略的所有层级及其目标资产，建立映射

```typescript
export const getAssetTargetMap = (strategy: StrategyVersion | null) => {
  const map = new Map<string, { target: StrategyTarget, layerId: string }>();
  if (!strategy) return map;
  strategy.layers.forEach((layer: StrategyLayer) => {
      layer.items.forEach((target: StrategyTarget) => {
          map.set(target.assetId, { target, layerId: layer.id });
      });
  });
  return map;
};
```

---

## 3. Components 中的计算逻辑

### `/home/qyao/gitspace/InvestTrack/client/src/components/AssetManager.tsx`

#### 资产历史记录计算 (useEffect)
- **用途**: 计算资产历史记录的盈亏和回报率
- **输入**: 后端返回的历史数据数组
- **输出**: 格式化后的AssetHistoryRecord数组
- **算法/步骤**:
  1. 遍历后端返回的历史数据
  2. 计算盈亏 = 市值 - 总成本
  3. 计算回报率 = (盈亏 / 总成本) × 100%
  4. 按日期排序

```typescript
const formatted: AssetHistoryRecord[] = data.map((row: any) => ({
  date: row.date,
  unitPrice: row.unitPrice,
  quantity: row.quantity,
  marketValue: row.marketValue,
  totalCost: row.totalCost,
  profit: row.marketValue - row.totalCost,
  roi: row.totalCost > 0 ? ((row.marketValue - row.totalCost) / row.totalCost * 100) : 0,
  addedQuantity: row.addedQuantity,
  addedPrincipal: row.addedPrincipal,
  note: row.note || ''
}));
```

#### 资产卡片计算 (`renderAssetCard` 函数)
- **用途**: 计算单个资产卡片的展示数据
- **输入**: `asset` (资产对象), `status` (资产表现数据)
- **输出**: 用于渲染卡片的计算值
- **算法/步骤**:
  - 市值 = status.marketValue
  - 成本 = status.totalCost
  - 盈亏 = 市值 - 成本
  - 回报率 = (盈亏 / 成本) × 100%

```typescript
const marketValue = status ? status.marketValue : 0;
const totalCost = status ? status.totalCost : 0;
const profit = marketValue - totalCost;
const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
```

---

### `/home/qyao/gitspace/InvestTrack/client/src/components/dashboard/HistorySection.tsx`

#### ROI计算 (表格行内)
- **用途**: 计算分解表中每行的回报率
- **输入**: `row.endCost`, `row.profit`
- **输出**: ROI百分比
- **算法/步骤**: `roi = row.endCost > 0 ? (row.profit / row.endCost) * 100 : 0`

#### 汇总ROI计算 (tfoot中)
- **用途**: 计算分解表所有数据的汇总回报率
- **输入**: `breakdownTotals.endCost`, `breakdownTotals.profit`
- **输出**: 汇总ROI百分比
- **算法/步骤**: `totalRoi = breakdownTotals.endCost > 0 ? (breakdownTotals.profit / breakdownTotals.endCost) * 100 : 0`

---

### `/home/qyao/gitspace/InvestTrack/client/src/components/statements/MonthlyStatementForm.tsx`

#### 总资产价值计算
- **用途**: 计算当前表单所有资产的总市值
- **输入**: `rows` (表单行数据)
- **输出**: totalAssetsVal (总资产价值)
- **算法/步骤**:
  ```typescript
  const totalAssetsVal = rows.reduce((sum, r) => {
      const p = parseFloat(r.price) || (r.category === 'fixed' || r.category === 'wealth' ? 1 : 0);
      const sign = r.transactionType === 'sell' ? -1 : 1;
      const qChangeAbs = parseFloat(r.quantityChange) || 0;
      const qChange = qChangeAbs * sign;
      const q = r.prevQuantity + qChange;
      return sum + (p * q);
  }, 0);
  ```

#### 行内计算 (map函数内)
- **用途**: 计算每行的实时数据
- **输入**: row中的各个字段
- **输出**: currentQ, currentVal, impliedProfit
- **算法/步骤**:
  ```typescript
  const p = parseFloat(row.price) || (isCashLike ? 1 : 0);
  const sign = row.transactionType === 'sell' ? -1 : 1;
  const qChangeAbs = parseFloat(row.quantityChange) || 0;
  const cChangeAbs = parseFloat(row.costChange) || 0;
  const qChangeSigned = qChangeAbs * sign;
  const cChangeSigned = cChangeAbs * sign;
  const currentQ = row.prevQuantity + qChangeSigned;  // 当前持仓量
  const currentVal = currentQ * p;  // 当前市值
  const impliedProfit = isCashLike ? (qChangeSigned - cChangeSigned) : 0;  // 隐含盈亏(现金类)
  ```

---

### `/home/qyao/gitspace/InvestTrack/client/src/components/StrategyManager.tsx`

#### 总层级权重计算
- **用途**: 计算所有层级的权重总和
- **输入**: `currentVersion.layers`
- **输出**: totalLayerWeight (总权重百分比)
- **算法/步骤**:
  ```typescript
  const totalLayerWeight = currentVersion ?
      currentVersion.layers.reduce((sum: number, l: StrategyLayer) => sum + l.weight, 0) : 0;
  ```

#### 剩余权重计算 (`remainingWeightInModalLayer` useMemo)
- **用途**: 计算模态框中当前层级剩余可用权重
- **输入**: 当前层级已分配的固定权重
- **输出**: 剩余可用权重
- **算法/步骤**:
  ```typescript
  const used = layer.items
      .filter((i: StrategyTarget) => i.weight >= 0 && (!modalAsset.item || i.id !== modalAsset.item.id))
      .reduce((sum: number, i: StrategyTarget) => sum + i.weight, 0);
  return Math.max(0, 100 - used);
  ```

#### 有效权重计算
- **用途**: 计算资产在层级内的有效权重（固定权重或自动分配权重）
- **输入**: 资产目标权重、自动计算的权重
- **算法**:
  ```typescript
  const effectiveWeight = item.weight === -1 ? autoWeight : item.weight;
  const globalWeight = (layer.weight * effectiveWeight / 100);  // 全局权重
  ```

---

## 4. 核心计算公式汇总

### 投资回报相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| 盈亏 | 市值 - 总成本 | 可正可负 |
| 回报率 | (盈亏 / 总成本) × 100% | 百分比表示 |
| 市值 | 持仓量 × 单价 | 资产当前市场价值 |
| 成本 | 历史累计投入 | 总本金投入 |

### 持仓相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| 新持仓量 | 前期持仓量 + 本期变动量 | 累加计算 |
| 变动量 | 输入值 × (买入:1 / 卖出:-1) | 带符号计算 |
| 现金类市值 | 本金变动量 × 1 | 固定为1:1 |

### 策略权重相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| 有效权重 | 固定权重 或 自动分配权重 | 二选一 |
| 全局权重 | 层级权重 × 层内权重 / 100 | 资产在总组合中的占比 |
| 剩余权重 | 100 - 已分配固定权重 | 用于自动分配 |

---

## 5. 数据流向说明

### 月度账单录入流程
```
用户输入 → AssetRowInput → prepareSubmission() → MonthlyStatementDetail → API
```

### 仪表盘数据流程
```
API响应 → useDashboardData → breakdownTotals计算 → UI展示
```

### 资产卡片渲染流程
```
MonthlyStatementDetail → assetPerformanceMap → renderAssetCard() → 卡片UI
```

---

本文档涵盖了 InvestTrack 前端所有主要的计算逻辑。这些计算主要涉及：
1. **投资指标计算**: 盈亏、回报率、市值
2. **持仓状态计算**: 累加持仓量、成本
3. **策略配置计算**: 权重分配、全局占比
4. **数据聚合计算**: 分组、汇总、平均
