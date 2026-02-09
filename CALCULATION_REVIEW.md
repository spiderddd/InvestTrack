# InvestTrack 计算逻辑 Review 报告

## 一、重复计算逻辑

### 1. `getStrategyForDate` - 完全重复

| 位置 | 文件路径 |
|------|----------|
| 前端 | `client/src/utils/calculators.ts` |
| 后端 | `server/services/dashboardService.js` |

**代码对比**：
```typescript
// 前端
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

```javascript
// 后端
const getStrategyForDate = (versions, dateStr) => {
  const active = versions.filter(v => v.status === 'active');
  const sorted = (active.length > 0 ? active : versions)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  let target = dateStr;
  if (dateStr.length === 7) {
    const [y, m] = dateStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    target = `${dateStr}-${lastDay.toString().padStart(2, '0')}`;
  }
  return sorted.find(v => v.startDate <= target) || sorted[sorted.length - 1];
};
```

**问题**：算法完全一致，后端多了一个 `status === 'active'` 过滤逻辑，但前端调用时应该只需要后端返回的结果即可。

---

### 2. `getAssetTargetMap` - 完全重复

| 位置 | 文件路径 |
|------|----------|
| 前端 | `client/src/utils/calculators.ts` |
| 后端 | `server/services/dashboardService.js` |

**代码对比**：
```typescript
// 前端
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

```javascript
// 后端
const getAssetTargetMap = (strategy) => {
  const map = new Map();
  if (!strategy) return map;
  strategy.layers.forEach(layer => {
    layer.items.forEach(target => {
      map.set(target.assetId, { target, layerId: layer.id });
    });
  });
  return map;
};
```

**问题**：逻辑完全一样，只需要保留一份（建议放后端）。

---

### 3. ROI/盈亏计算 - 部分重复

| 位置 | 文件路径 | 用途 |
|------|----------|------|
| 前端 | `AssetManager.tsx` | 资产历史记录的盈亏和回报率 |
| 后端 | `dashboardService.js` | 仪表盘收益指标 |

**前端代码**：
```typescript
const profit = row.marketValue - row.totalCost;
const roi = row.totalCost > 0 ? ((row.marketValue - row.totalCost) / row.totalCost * 100) : 0;
```

**后端代码**：
```javascript
const profit = (endVal - endCost) - (startVal - startCost);
const returnRate = startInv > 0 ? (profit / startInv) * 100 : 0;
```

**问题**：公式有差异（后端计算的是期间收益变化，前端计算的是单点盈亏），但核心逻辑相似。后端 `AssetService.getHistory` 已经返回了 `marketValue` 和 `totalCost`，前端只需要做简单减法即可，这部分可以接受。

---

### 4. 权重计算逻辑 - 部分重复

| 位置 | 文件路径 | 用途 |
|------|----------|------|
| 前端 | `StrategyManager.tsx` | 剩余权重、自动分配权重计算 |
| 后端 | `dashboardService.js` | 配置分析中的自动权重计算 |

**前端代码**：
```typescript
// 剩余权重计算
const used = layer.items
    .filter((i: StrategyTarget) => i.weight >= 0 && (!modalAsset.item || i.id !== modalAsset.item.id))
    .reduce((sum: number, i: StrategyTarget) => sum + i.weight, 0);
return Math.max(0, 100 - used);

// 自动分配权重
const effectiveWeight = item.weight === -1 ? autoWeight : item.weight;
const globalWeight = (layer.weight * effectiveWeight / 100);
```

**后端代码**：
```javascript
const fixedItems = layer.items.filter(i => i.weight >= 0);
const autoItems = layer.items.filter(i => i.weight === -1);
const usedWeight = fixedItems.reduce((sum, i) => sum + i.weight, 0);
const autoWeight = Math.max(0, 100 - usedWeight) / autoItems.length;
```

**问题**：算法一致，前端用于 UI 编辑校验，后端用于配置分析。建议抽取为共享工具函数。

---

## 二、前端冗余计算（应该后端返回）

### 1. `breakdownTotals` - 前端重新汇总

| 文件 | `client/src/hooks/useDashboardData.ts` |
|------|--------------------------------------|

**问题**：后端 `getAttribution` 已经返回了包含 `profit`、`endCost` 等数据的数组，前端又用 `reduce` 重新汇总一次。

**建议**：后端直接返回汇总字段 `{ endVal, endCost, changeVal, changeInput, profit }`，前端直接使用。

---

### 2. ROI计算 - 前端重新计算

| 文件 | `client/src/components/dashboard/HistorySection.tsx` |
|------|------------------------------------------------------|

**代码**：
```typescript
// 行内ROI计算
const roi = row.endCost > 0 ? (row.profit / row.endCost) * 100 : 0;

// 汇总ROI计算
const totalRoi = breakdownTotals.endCost > 0 ? (breakdownTotals.profit / breakdownTotals.endCost) * 100 : 0;
```

**问题**：后端返回的数据已经包含 `profit` 和 `endCost`，前端只需做简单除法。汇总 ROI 应该在后端计算好再返回。

---

### 3. 持仓量/成本计算 - 前端在表单中使用

| 文件 | `client/src/hooks/useStatementForm.ts` |
|------|--------------------------------------|

**代码**：
```typescript
const newQuantity = r.prevQuantity + qChange;
const newCost = r.prevCost + cChange;
const marketValue = newQuantity * price;
```

**问题**：这是表单录入时的实时预览计算，属于 UI 交互逻辑，放在前端是合理的。

---

## 三、后端应该提供但未提供的数据

### 1. 资产配置百分比

**现状**：后端 `getAllocation` 返回 `percent` 和 `deviation`，前端直接使用。

**评价**：✅ 合理，后端已经计算好。

---

### 2. 策略版本列表

**现状**：前端 `useAssetGrouping` 调用 `getStrategyForDate` 来查找适用策略。

**问题**：前端已经有完整的策略版本列表，为什么需要在前端做日期匹配？

**建议**：后端 API 应该直接返回「指定日期适用的策略」，而不是让前端拿所有版本自己去匹配。

---

### 3. 分组汇总数据

**现状**：前端 `displaySections` 按类别/层级分组资产列表。

**问题**：分组逻辑在前端实现，每次都要遍历整个资产列表。

**建议**：后端返回已分组的资产数据 `{ sections: [{ id, label, items: [...] }] }`。

---

## 四、代码重复问题汇总表

| 序号 | 计算项 | 前端位置 | 后端位置 | 严重程度 | 建议 |
|------|--------|----------|----------|----------|------|
| 1 | `getStrategyForDate` | calculators.ts | dashboardService.js | 🔴 高 | 删前端，API返回已匹配的策略 |
| 2 | `getAssetTargetMap` | calculators.ts | dashboardService.js | 🔴 高 | 删前端，API返回映射数据 |
| 3 | ROI计算 | HistorySection.tsx | dashboardService.js | 🟡 中 | 后端返回ROI，前端只展示 |
| 4 | breakdownTotals | useDashboardData.ts | dashboardService.js | 🟡 中 | 后端返回汇总，前端直接用 |
| 5 | 剩余/自动权重 | StrategyManager.tsx | dashboardService.js | 🟢 低 | 抽取为共享工具函数 |
| 6 | 持仓量计算 | useStatementForm.ts | statementService.js | 🟢 低 | UI交互，合理放在前端 |

---

## 五、改进建议

### 5.1 删除前端重复代码

**优先级：高）**

```typescript
// 删除 client/src/utils/calculators.ts 中的：
// - getStrategyForDate
// - getAssetTargetMap

// 修改前端逻辑：
// - 调用后端 API 获取已匹配的策略版本
// - 调用后端 API 获取资产-策略映射
```

### 5.2 后端补充返回字段

**优先级：中）**

```javascript
// dashboardService.js - getAttribution 增加：
return {
  // ... 现有字段
  roi: endCost > 0 ? (profit / endCost) * 100 : 0,
  roiPercent: returnRate,  // 期间收益率
};

// getAllocation 增加返回汇总：
return {
  items: [...],  // 各配置项
  totalValue,
  totalWeight,   // 总权重
};
```

### 5.3 抽取共享工具函数

**优先级：低）**

将重复的计算逻辑抽取到 `shared/utils/calculation.js`：

```javascript
// shared/utils/calculation.js
export function getStrategyForDate(versions, dateStr) {
  // 统一逻辑
}

export function getAssetTargetMap(strategy) {
  // 统一逻辑
}

export function calculateAutoWeight(items) {
  // 计算自动分配权重
}

export function calculateROI(profit, cost) {
  return cost > 0 ? (profit / cost) * 100 : 0;
}
```

---

## 六、结论

### 需要重构的问题

1. **删除前端冗余代码**：移除 `calculators.ts` 中与后端重复的函数
2. **后端补充返回字段**：ROI、汇总数据等在前端重新计算的字段，应该后端直接返回
3. **API 调整**：后端提供「已匹配策略」「资产-策略映射」等数据，前端不再需要本地计算

### 可以保留的前端计算

1. **UI 交互相关的实时计算**：表单录入时的持仓预览
2. **纯展示格式化**：数字格式化、百分比保留小数位
3. **前端状态管理**：UI 展开/折叠、筛选条件等

### 架构原则

- **后端**：业务逻辑、核心计算、数据聚合
- **前端**：UI 渲染、用户交互、实时预览（不影响数据正确性）
