# InvestTrack Backend Calculation Logic Documentation

---

## 1. Services 中的计算逻辑

### `/home/qyao/gitspace/InvestTrack/server/services/dashboardService.js`

#### `getStrategyForDate`
- **用途**: 根据指定日期查找适用的策略版本（时间旅行查询）
- **输入**:
  - `versions`: 策略版本数组
  - `dateStr`: 目标日期字符串（YYYY-MM 或 YYYY-MM-DD）
- **输出**: 适用的策略版本对象，若无则返回最早的版本
- **算法/步骤**:
  1. 过滤出状态为 'active' 的活跃策略
  2. 若无活跃策略，使用所有版本
  3. 按 `startDate` 降序排序
  4. 若输入为月格式，转换为月末日期
  5. 查找第一个 `startDate <= 目标日期` 的版本
  6. 若无匹配，返回排序后的最后一个版本

```javascript
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

#### `getAssetTargetMap`
- **用途**: 将策略目标转换为 Map 结构，便于 O(1) 查找
- **输入**: `strategy` - 策略对象（包含 layers）
- **输出**: Map 对象，key 为 assetId，value 为 `{target, layerId}`
- **算法/步骤**:
  1. 初始化空 Map
  2. 遍历策略的所有 layers
  3. 遍历每个 layer 的 items（targets）
  4. 将 assetId -> {target, layerId} 存入 Map

```javascript
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

#### `DashboardService.getMetrics`
- **用途**: 计算核心收益指标（期末价值、投入金额、收益、收益率）
- **输入**:
  - `viewMode`: 'strategy' | 'total'
  - `timeRange`: 'all' | 'ytd' | '1y'
- **输出**: `{ endValue, endInvested, startValue, startInvested, profit, returnRate, periodLabel }`
- **算法/步骤**:
  1. 获取所有报表并按日期排序
  2. 根据 timeRange 确定期初报表：
     - `ytd`: 查找当年第一份报表，若为1月则找上年12月
     - `1y`: 查找一年前的报表
     - `all`: 使用最早报表
  3. 期末使用实时报表（今日日期 + 最新价格）
  4. 过滤策略资产（若 viewMode !== 'total'）
  5. 计算：
     - `profit = (endV - endI) - (startV - startI)`（期间收益变化）
     - `returnRate = (profit / startI) * 100`（期间收益率）
     - 若 timeRange='all'，使用 `endI` 作为投入基准

```javascript
DashboardService.getMetrics = async (viewMode, timeRange) => {
  const statements = await StatementService.getAll();
  statements.sort((a, b) => a.date.localeCompare(b.date));

  const now = new Date();
  const startDate = getStartDate(timeRange, statements, now);
  const endDate = now.toISOString().slice(0, 10);

  const startStmt = statements.find(s => s.date >= startDate) || statements[0];
  const startVal = viewMode === 'total' ? startStmt.totalValue : filteredStartValue;
  const startInv = viewMode === 'total' ? startStmt.totalInvested : filteredStartInvested;

  const latestPrices = await AssetService.getLatestPrices(assetIds);
  const endVal = calculateWithLatestPrices(viewMode, latestPrices);
  const endInv = getInvestedAmount(endStmt, assetIds);

  const profit = (endVal - endInv) - (startVal - startInv);
  const returnRate = startInv > 0 ? (profit / startInv) * 100 : 0;

  return { endValue: endVal, endInvested: endInv, startValue: startVal, startInvested: startInv, profit, returnRate, periodLabel };
};
```

#### `DashboardService.getAllocation`
- **用途**: 计算资产配置分布（按类别或策略层级）
- **输入**:
  - `viewMode`: 'strategy' | 'total'
  - `layerId`: 可选，特定层级ID
- **输出**: 配置数组，每个元素包含 `name, value, percent, targetPercent, deviation`
- **算法/步骤**:
  - **Total 模式**:
    1. 按资产类型分组（security/fund -> 股票基金, fixed/wealth -> 现金固收, gold/crypto -> 商品另类）
    2. 计算每组市值
    3. 计算百分比 = (组市值 / 总市值) * 100
  - **Strategy 模式（Layer View）**:
    1. 筛选策略中的资产
    2. 计算策略总市值
    3. 每层实际占比 = (层内资产市值 / 策略总市值) * 100
    4. 偏差 = 实际占比 - 目标权重
  - **Drill Down 模式（Layer 内资产）**:
    1. 区分固定权重(>=0)和自动权重(-1)项目
    2. 计算剩余权重 = 100 - 固定权重总和
    3. 自动权重 = 剩余权重 / 自动项目数量
    4. 计算每个资产的内外百分比和偏差

```javascript
DashboardService.getAllocation = async (viewMode, layerId) => {
  if (viewMode === 'total') {
    const totalVal = stmt.totalValue;
    const categories = { 'stock-fund': 0, 'cash-bond': 0, 'alt': 0 };
    assets.forEach(a => {
      const cat = getAssetCategory(a.category);
      categories[cat] += a.marketValue;
    });
    return Object.entries(categories).map(([name, value]) => ({
      name, value, percent: (value / totalVal) * 100
    }));
  } else {
    const strategy = getStrategyForDate(versions, stmt.date);
    const totalVal = strategyAssets.reduce((sum, a) => sum + a.marketValue, 0);
    const layer = strategy.layers.find(l => l.id === layerId);
    const layerVal = layer.items.reduce((sum, t) => sum + t.asset.marketValue, 0);
    const fixedItems = layer.items.filter(i => i.weight >= 0);
    const autoItems = layer.items.filter(i => i.weight === -1);
    const usedWeight = fixedItems.reduce((sum, i) => sum + i.weight, 0);
    const autoWeight = Math.max(0, 100 - usedWeight) / autoItems.length;
    return layer.items.map(item => ({
      name: item.asset.name,
      value: item.asset.marketValue,
      percent: (item.asset.marketValue / totalVal) * 100,
      targetPercent: item.weight === -1 ? autoWeight : item.weight,
      deviation: ((item.weight === -1 ? autoWeight : item.weight) * layer.weight / 100) - (item.asset.marketValue / totalVal)
    }));
  }
};
```

#### `DashboardService.getTrend`
- **用途**: 生成历史趋势图的时间序列数据
- **输入**:
  - `viewMode`: 'strategy' | 'total'
  - `layerId`: 可选
  - `startDate`: 可选
- **输出**: `[{ date, value, invested }, ...]` 时间序列数组
- **算法/步骤**:
  1. 调用 `StatementService.getHistoryGraph()` 获取历史数据
  2. 若 viewMode='total': 直接使用每条记录的 `totalValue` 和 `totalInvested`
  3. 若 viewMode='strategy':
     - 对每个时间点，获取当时的策略
     - 筛选属于该策略的资产
     - 若指定 layerId，进一步筛选该层内的资产
     - 汇总市值和投入
  4. 按 startDate 过滤

```javascript
DashboardService.getTrend = async (viewMode, layerId, startDate) => {
  const history = await StatementService.getHistoryGraph();
  const trend = history.map(point => {
    if (viewMode === 'total') {
      return { date: point.date, value: point.totalValue, invested: point.totalInvested };
    } else {
      const strategy = getStrategyForDate(versions, point.date);
      const filteredAssets = layerId
        ? strategy.layers.find(l => l.id === layerId).items.map(i => i.asset)
        : strategy.layers.flatMap(l => l.items.map(i => i.asset));
      const value = filteredAssets.reduce((sum, a) => sum + a.marketValue, 0);
      const invested = filteredAssets.reduce((sum, a) => sum + a.totalCost, 0);
      return { date: point.date, value, invested };
    }
  }).filter(p => !startDate || p.date >= startDate);
  return trend;
};
```

#### `DashboardService.getAttribution`
- **用途**: 收益归因分析（计算各资产/层级的收益贡献）
- **输入**:
  - `viewMode`: 'strategy' | 'total'
  - `timeRange`: 'all' | 'ytd' | '1y'
  - `layerId`: 可选
- **输出**: 归因数组，每个元素包含 `endVal, endCost, changeVal, changeInput, profit`
- **算法/步骤**:
  1. 确定期初和期末报表（同 getMetrics）
  2. 计算期末和期初的统计：
     - `endVal`: 期末市值
     - `endCost`: 期末投入
     - `changeVal`: 市值变化 = endVal - startVal
     - `changeInput`: 投入变化 = endCost - startCost
     - `profit`: 收益变化 = (endVal - endCost) - (startVal - startCost)
  3. 按类别或层级分组汇总
  4. 过滤零值结果并按市值降序排序

```javascript
DashboardService.getAttribution = async (viewMode, timeRange, layerId) => {
  const [startStmt, endStmt] = await getRangeStatements(timeRange);
  const startAssets = getAssetsForView(startStmt, viewMode, layerId);
  const endAssets = getAssetsForView(endStmt, viewMode, layerId);

  const attribution = startAssets.map(s => {
    const e = endAssets.find(a => a.assetId === s.assetId) || { endVal: 0, endCost: 0 };
    return {
      assetId: s.assetId,
      name: s.name,
      endVal: e.endVal,
      endCost: e.endCost,
      changeVal: e.endVal - s.startVal,
      changeInput: e.endCost - s.startCost,
      profit: (e.endVal - e.endCost) - (s.startVal - s.startCost)
    };
  });

  const grouped = groupByCategoryOrLayer(attribution);
  return grouped.filter(g => g.endVal !== 0).sort((a, b) => b.endVal - a.endVal);
};
```

---

### `/home/qyao/gitspace/InvestTrack/server/services/statementService.js`

#### `calculateTotals`
- **用途**: 计算指定日期的投资组合总价值和总投入
- **输入**: `date` - 目标日期
- **输出**: `{ totalValue, totalInvested }`
- **算法/步骤**:
  1. 查询 `date` 前的所有交易，按资产汇总：
     - `quantity = SUM(quantity_change)`
     - `totalCost = SUM(cost_change)`
  2. 遍历每个持仓：
     - 跳过零持仓 (`|quantity| < 0.000001`)
     - 获取该资产在 `date` 及之前的最新价格
     - `marketValue = quantity * price`
  3. 累加总市值和总投入

```javascript
const calculateTotals = async (date) => {
  const transactions = await db.query(`
    SELECT asset_id, SUM(quantity_change) as quantity, SUM(cost_change) as totalCost
    FROM transactions WHERE statement_date <= ?
    GROUP BY asset_id HAVING ABS(quantity) > 0.000001
  `, [date]);

  let totalValue = 0;
  let totalInvested = 0;

  for (const t of transactions) {
    const price = await getLatestPrice(t.asset_id, date);
    const marketValue = t.quantity * price;
    totalValue += marketValue;
    totalInvested += t.totalCost;
  }

  return { totalValue, totalInvested };
};
```

#### `getHistoryGraph`
- **用途**: 重建完整的历史持仓快照（用于趋势图）
- **输入**: 无（查询所有数据）
- **输出**: `[{ id, date, totalValue, totalInvested, assets: [...] }, ...]`
- **算法/步骤**:
  1. 加载所有报表、交易、价格数据
  2. 按资产建立价格索引（已排序）
  3. 使用游标（cursor）按时间顺序处理交易：
     - 维护 runningState: Map<assetId, {quantity, cost}>
     - 累计每笔交易到 runningState
  4. 对每个报表时间点：
     - 遍历 runningState
     - 跳过零持仓
     - 反向查找最近的交易日价格
     - 计算市值
     - 汇总总市值和总投入

```javascript
StatementService.getHistoryGraph = async () => {
  const [statements, transactions, prices] = await Promise.all([
    db.query('SELECT * FROM monthly_statements ORDER BY date'),
    db.query('SELECT * FROM transactions ORDER BY statement_date, id'),
    db.query('SELECT * FROM prices ORDER BY date')
  ]);

  const priceIndex = buildPriceIndex(prices);
  const cursor = { idx: 0, state: new Map() };
  const history = [];

  for (const stmt of statements) {
    while (cursor.idx < transactions.length && transactions[cursor.idx].statement_date <= stmt.date) {
      const t = transactions[cursor.idx];
      const current = cursor.state.get(t.asset_id) || { quantity: 0, cost: 0 };
      cursor.state.set(t.asset_id, {
        quantity: current.quantity + t.quantity_change,
        cost: current.cost + t.cost_change
      });
      cursor.idx++;
    }

    let totalValue = 0;
    let totalInvested = 0;
    const assets = [];

    cursor.state.forEach((pos, assetId) => {
      if (Math.abs(pos.quantity) > 0.000001) {
        const price = findPriceBefore(assetIndex, stmt.date);
        const marketValue = pos.quantity * price;
        totalValue += marketValue;
        totalInvested += pos.cost;
        assets.push({ assetId, quantity: pos.quantity, marketValue, totalCost: pos.cost });
      }
    });

    history.push({ id: stmt.id, date: stmt.date, totalValue, totalInvested, assets });
  }

  return history;
};
```

#### `getDetails`
- **用途**: 获取指定报表的完整详情
- **输入**: `id` - 报表ID
- **输出**: 报表对象，包含 `assets` 数组（每资产含市值、成本、期初变化等）
- **算法/步骤**:
  1. 获取报表头信息
  2. 计算 totals（调用 calculateTotals）
  3. 查询 `date` 前的累计持仓（HAVING quantity != 0）
  4. 查询本月交易（用于获取 note 和期初变化）
  5. 对每个持仓：
     - 获取资产信息（名称、类型）
     - 获取最新价格
     - 固定/理财产品单价为1
     - 计算市值 = quantity * unitPrice
     - 获取本月变化量
  6. 组装完整资产对象

```javascript
StatementService.getDetails = async (id) => {
  const stmt = await db.query('SELECT * FROM monthly_statements WHERE id = ?', [id]);
  const totals = await calculateTotals(stmt.date);

  const [holdings, thisMonth] = await Promise.all([
    db.query(`
      SELECT asset_id, SUM(quantity_change) as quantity, SUM(cost_change) as totalCost
      FROM transactions WHERE statement_date <= ?
      GROUP BY asset_id HAVING ABS(quantity) > 0.000001
    `, [stmt.date]),
    db.query('SELECT * FROM transactions WHERE statement_id = ?', [id])
  ]);

  const assetMap = await AssetService.getIdMap();
  const transactionMap = new Map(thisMonth.map(t => [t.asset_id, t]));

  const assets = await Promise.all(holdings.map(async (h) => {
    const asset = assetMap.get(h.asset_id);
    const price = await getLatestPrice(h.asset_id, stmt.date);
    const tx = transactionMap.get(h.asset_id);
    return {
      id: generateId(),
      assetId: h.asset_id,
      name: asset.name,
      category: asset.category,
      unitPrice: (asset.category === 'fixed' || asset.category === 'wealth') ? 1 : price,
      quantity: h.quantity,
      marketValue: h.quantity * price,
      totalCost: h.totalCost,
      addedQuantity: tx?.quantity_change || 0,
      addedPrincipal: tx?.cost_change || 0,
      note: tx?.note || ''
    };
  }));

  return { ...stmt, ...totals, assets };
};
```

#### `getDetailsByPeriod`
- **用途**: 支持时间旅行查询（YYYY-MM 或 YYYY-MM-DD）
- **输入**: `date` - 目标日期
- **输出**: 同 getDetails，但按实时价格计算
- **算法/步骤**:
  1. 若为 YYYY-MM-DD：
     - 找到该日期所在月份的报表
     - 查询 `date` 前的累计持仓
  2. 若为 YYYY-MM：
     - 直接使用月报表
     - 查询 `statement_date` 前的累计持仓
  3. 获取最新价格（可能晚于报表日期）
  4. 构建资产列表（逻辑同 getDetails）

```javascript
StatementService.getDetailsByPeriod = async (date) => {
  let stmt;
  if (date.length === 10) {
    const month = date.slice(0, 7);
    stmt = await db.query('SELECT * FROM monthly_statements WHERE date LIKE ?', [month + '%']);
  } else {
    stmt = await db.query('SELECT * FROM monthly_statements WHERE date = ?', [date]);
  }

  const holdings = await db.query(`
    SELECT asset_id, SUM(quantity_change) as quantity, SUM(cost_change) as totalCost
    FROM transactions WHERE statement_date <= ?
    GROUP BY asset_id HAVING ABS(quantity) > 0.000001
  `, [date]);

  const latestPrices = await AssetService.getLatestPrices(holdings.map(h => h.asset_id));
  // ... 构建资产列表
  return { date, totalValue, totalInvested, assets };
};
```

#### `createOrUpdate`
- **用途**: 创建或更新月报表（写穿透缓存模式）
- **输入**: `{ date, assets, note }`
- **输出**: `{ success: true, id: statementId }`
- **算法/步骤**:
  1. 事务处理：
     - 若报表存在则删除其交易（保留ID）
     - 否则创建新报表
  2. 对每个资产：
     - 更新/插入价格（upsert）
     - 插入交易记录（quantity_change, cost_change）
  3. 清理相关缓存

```javascript
StatementService.createOrUpdate = async ({ date, assets, note }) => {
  const existing = await db.query('SELECT id FROM monthly_statements WHERE date = ?', [date]);
  const statementId = existing?.id || generateId();

  await db.run('BEGIN TRANSACTION');
  try {
    if (existing) {
      await db.run('DELETE FROM transactions WHERE statement_id = ?', [statementId]);
    } else {
      await db.run('INSERT INTO monthly_statements (id, date, note) VALUES (?, ?, ?)', [statementId, date, note]);
    }

    for (const a of assets) {
      await AssetService.upsertPrice(a.assetId, date, a.unitPrice);
      await db.run(`
        INSERT INTO transactions (statement_id, statement_date, asset_id, quantity_change, cost_change, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [statementId, date, a.assetId, a.quantity, a.cost, a.note || '']);
    }

    await db.run('COMMIT');
    await cache.del('statements:*');
    return { success: true, id: statementId };
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
};
```

---

### `/home/qyao/gitspace/InvestTrack/server/services/assetService.js`

#### `getHistory`
- **用途**: 生成单个资产的历史净值曲线
- **输入**: `assetId` - 资产ID
- **输出**: `[{ date, unitPrice, quantity, marketValue, totalCost, addedQuantity, addedPrincipal, note }, ...]`
- **算法/步骤**:
  1. 获取该资产的所有交易、价格、报表日期
  2. 遍历每个报表日期：
     - 处理该日期前的交易（指针前进）
     - 累计 `cumQ`（数量）和 `cumC`（成本）
     - 记录本月变化量（periodAddedQ, periodAddedC）
     - 反向查找最近价格
     - 计算市值
     - 跳过零变化且零持仓的记录
  3. 返回历史序列

```javascript
AssetService.getHistory = async (assetId) => {
  const [transactions, prices, statements] = await Promise.all([
    db.query('SELECT * FROM transactions WHERE asset_id = ? ORDER BY statement_date', [assetId]),
    db.query('SELECT * FROM prices WHERE asset_id = ? ORDER BY date', [assetId]),
    db.query('SELECT date FROM monthly_statements ORDER BY date')
  ]);

  const priceIndex = new Map(prices.map(p => [p.date, p.price]));
  const history = [];
  let cumQ = 0, cumC = 0, txIdx = 0;

  for (const stmt of statements) {
    while (txIdx < transactions.length && transactions[txIdx].statement_date <= stmt.date) {
      cumQ += transactions[txIdx].quantity_change;
      cumC += transactions[txIdx].cost_change;
      txIdx++;
    }

    if (cumQ === 0 && cumC === 0) continue;

    const price = findLatestPrice(priceIndex, stmt.date);
    history.push({
      date: stmt.date,
      unitPrice: price,
      quantity: cumQ,
      marketValue: cumQ * price,
      totalCost: cumC,
      addedQuantity: transactions[txIdx - 1]?.quantity_change || 0,
      addedPrincipal: transactions[txIdx - 1]?.cost_change || 0,
      note: transactions[txIdx - 1]?.note || ''
    });
  }

  return history;
};
```

#### `getPrices`
- **用途**: 获取多个资产的最新价格
- **输入**: `assetIds` - 资产ID数组
- **输出**: `{ assetId: { price, date }, ... }`
- **算法/步骤**:
  1. 构建 SQL 查询（多个 ? 占位符）
  2. 限制日期 <= 今天
  3. 遍历结果，为每个资产保留最新日期的价格

```javascript
AssetService.getLatestPrices = async (assetIds) => {
  if (!assetIds.length) return {};
  const placeholders = assetIds.map(() => '?').join(',');
  const prices = await db.query(`
    SELECT p.* FROM prices p
    INNER JOIN (
      SELECT asset_id, MAX(date) as max_date FROM prices
      WHERE asset_id IN (${placeholders}) AND date <= date('now')
      GROUP BY asset_id
    ) latest ON p.asset_id = latest.asset_id AND p.date = latest.max_date
  `, assetIds);

  return Object.fromEntries(prices.map(p => [p.asset_id, { price: p.price, date: p.date }]));
};
```

---

### `/home/qyao/gitspace/InvestTrack/server/services/priceSyncService.js`

#### `makeSecid`
- **用途**: 生成东财 API 所需的股票代码标识
- **输入**: `ticker` - 股票代码
- **输出**: 格式为 `1.XXX` 或 `0.XXX` 的字符串
- **算法/步骤**:
  - 以 6/9/5 开头 -> 沪市 (`1.XXX`)
  - 其他 -> 深市 (`0.XXX`)

```javascript
const makeSecid = (ticker) => {
  const prefix = ticker[0];
  if (['6', '9', '5'].includes(prefix)) return `1.${ticker}`;
  return `0.${ticker}`;
};
```

#### `fetchStockPrice`
- **用途**: 获取股票的实时价格或历史收盘价
- **输入**: `ticker` - 股票代码
- **输出**: `{ name, price }` 或 `null`
- **算法/步骤**:
  1. 优先获取实时价格：
     - 调用东财 `push2.eastmoney.com/api/qt/stock/get`
     - 解析 `f43`（价格，除以100）
  2. 失败则回退到历史收盘价：
     - 调用东财 `push2his.eastmoney.com/api/qt/stock/kline/get`
     - 获取日K线数据
     - 取最后一个K线的收盘价（字段2）

```javascript
const fetchStockPrice = async (ticker) => {
  const secid = makeSecid(ticker);
  try {
    const resp = await fetch(`https://push2.eastmoney.com/api/qt/stock/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59&secid=${secid}`);
    const data = await resp.json();
    if (data.data && data.data.secid) {
      return { name: data.data.name, price: data.data.f43 / 100 };
    }
  } catch (e) {}

  try {
    const resp = await fetch(`https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59&secid=${secid}&klt=101&fqt=1&beg=0&end=20500101`);
    const data = await resp.json();
    if (data.data && data.data.klines?.length) {
      const last = data.data.klines[data.data.klines.length - 1].split(',');
      return { name: last[0], price: parseFloat(last[1]) };
    }
  } catch (e) {}

  return null;
};
```

#### `fetchShGoldPrice`
- **用途**: 获取上海黄金交易所 Au9999 金价
- **输入**: 无
- **输出**: `price`（数字）或 `null`
- **算法/步骤**:
  1. 请求 5huangjin.com
  2. GBK 解码响应
  3. 正则匹配 `var hq_str_gds_AUTD="..."`
  4. 逗号分隔取第一个字段（金价）

```javascript
const fetchShGoldPrice = async () => {
  try {
    const resp = await fetch('https://5huangjin.com/price/');
    const html = iconv.decode(Buffer.from(await resp.arrayBuffer()), 'gbk');
    const match = html.match(/var hq_str_gds_AUTD="([^"]+)"/);
    if (match) {
      const parts = match[1].split(',');
      return parseFloat(parts[0]);
    }
  } catch (e) {}
  return null;
};
```

#### `PriceSyncService.syncGoldPrices`
- **用途**: 同步所有黄金资产的价格
- **输入**: 无
- **输出**: `{ price, assetsUpdated, date, type }`
- **算法/步骤**:
  1. 获取所有 gold 类型资产
  2. 调用 fetchShGoldPrice
  3. 对每个资产调用 updatePrice
  4. 清理相关缓存

```javascript
PriceSyncService.syncGoldPrices = async () => {
  const assets = await db.query("SELECT id, name FROM assets WHERE category = 'gold'");
  const price = await fetchShGoldPrice();
  if (!price) return { price: null, assetsUpdated: 0, date: null, type: 'gold' };

  const today = new Date().toISOString().slice(0, 10);
  for (const a of assets) {
    await AssetService.upsertPrice(a.id, today, price);
  }

  return { price, assetsUpdated: assets.length, date: today, type: 'gold' };
};
```

#### `PriceSyncService.syncStockPrices`
- **用途**: 同步所有股票资产的价格
- **输入**: 无
- **输出**: `{ type, assetsUpdated, failed, skipped, date }`
- **算法/步骤**:
  1. 获取所有 security 类型且有 ticker 的资产
  2. 对每个资产：
     - 生成 secid
     - 调用 fetchStockPrice
     - 成功则更新价格
     - 跳过无效价格
     - 统计成功/失败/跳过数量
  3. 清理相关缓存

```javascript
PriceSyncService.syncStockPrices = async () => {
  const assets = await db.query("SELECT id, name, ticker FROM assets WHERE category = 'security' AND ticker IS NOT NULL");
  let updated = 0, failed = 0, skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const a of assets) {
    const data = await fetchStockPrice(a.ticker);
    if (!data) { failed++; continue; }
    if (!data.price || data.price <= 0 || data.price > 100000) { skipped++; continue; }
    await AssetService.upsertPrice(a.id, today, data.price);
    updated++;
  }

  return { type: 'stock', assetsUpdated: updated, failed, skipped, date: today };
};
```

---

### `/home/qyao/gitspace/InvestTrack/server/services/exportService.js`

#### `exportForBackup`
- **用途**: 生成完整的备份数据
- **输入**: 无
- **输出**: 包含 `_meta, assets, strategies, monthlyStatements` 的对象
- **算法/步骤**:
  1. 并行执行三个导出任务
  2. 添加元数据（版本、导出时间、类型）

```javascript
exportService.exportForBackup = async () => {
  const [assets, strategies, statements] = await Promise.all([
    exportAssets(),
    exportStrategies(),
    exportStatements()
  ]);

  return {
    _meta: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'full'
    },
    assets,
    strategies,
    monthlyStatements: statements
  };
};
```

#### `exportAssets`
- **用途**: 导出资产及价格历史
- **输入**: 无
- **输出**: 资产数组，每项包含 prices 数组
- **算法/步骤**:
  1. 查询所有资产
  2. 对每个资产，查询其所有价格记录
  3. 按日期降序返回

```javascript
const exportAssets = async () => {
  const assets = await db.query('SELECT * FROM assets ORDER BY name');
  for (const a of assets) {
    a.prices = await db.query('SELECT date, price FROM prices WHERE asset_id = ? ORDER BY date', [a.id]);
  }
  return assets;
};
```

#### `exportStatements`
- **用途**: 导出月报表及交易明细
- **输入**: 无
- **输出**: 报表数组，每项包含 transactions 数组
- **算法/步骤**:
  1. 查询所有报表
  2. 建立 assetId -> name 映射
  3. 查询所有交易，按日期分组
  4. 将交易关联到对应报表

```javascript
const exportStatements = async () => {
  const statements = await db.query('SELECT * FROM monthly_statements ORDER BY date');
  const assetMap = Object.fromEntries(
    (await db.query('SELECT id, name FROM assets')).map(a => [a.id, a.name])
  );
  const transactions = await db.query('SELECT * FROM transactions ORDER BY statement_date');

  const txByStmt = new Map();
  for (const stmt of statements) {
    txByStmt.set(stmt.id, transactions.filter(t => t.statement_id === stmt.id));
  }

  return statements.map(s => ({
    ...s,
    assetMap,
    transactions: txByStmt.get(s.id)
  }));
};
```

#### `importBackup`
- **用途**: 从备份数据恢复
- **输入**: 备份数据对象
- **输出**: `{ assets, strategies, monthlyStatements }` - 导入数量
- **算法/步骤**:
  1. 验证备份格式
  2. 事务处理：
     - **资产**: 建立 name -> newId 映射，插入资产和价格
     - **策略**: 通过 nameToId 映射关联资产ID
     - **报表**: 通过 assetName -> id 映射关联资产ID
  3. 清理缓存

```javascript
exportService.importBackup = async (backup) => {
  if (!backup._meta || !backup.assets || !backup.strategies || !backup.monthlyStatements) {
    throw new Error('Invalid backup format');
  }

  await db.run('BEGIN TRANSACTION');
  try {
    const nameToId = {};
    for (const a of backup.assets) {
      const newId = generateId();
      nameToId[a.name] = newId;
      await db.run(`INSERT INTO assets (id, name, category, ticker) VALUES (?, ?, ?, ?)`,
        [newId, a.name, a.category, a.ticker || null]);
      for (const p of a.prices || []) {
        await db.run(`INSERT OR REPLACE INTO prices (asset_id, date, price) VALUES (?, ?, ?)`,
          [newId, p.date, p.price]);
      }
    }

    for (const s of backup.strategies) {
      const newId = generateId();
      await db.run(`INSERT INTO strategies (id, name, status) VALUES (?, ?, ?)`,
        [newId, s.name, s.status]);
      for (const v of s.versions || []) {
        const verId = generateId();
        await db.run(`INSERT INTO strategy_versions (id, strategy_id, start_date, status) VALUES (?, ?, ?, ?)`,
          [verId, newId, v.start_date, v.status || 'active']);
        for (const l of v.layers || []) {
          const layerId = generateId();
          await db.run(`INSERT INTO strategy_layers (id, version_id, name, weight) VALUES (?, ?, ?, ?)`,
            [layerId, verId, l.name, l.weight]);
          for (const i of l.items || []) {
            await db.run(`INSERT INTO strategy_items (layer_id, asset_id, weight) VALUES (?, ?, ?)`,
              [layerId, nameToId[i.asset_name], i.weight]);
          }
        }
      }
    }

    for (const stmt of backup.monthlyStatements || []) {
      const stmtId = generateId();
      await db.run(`INSERT INTO monthly_statements (id, date, note) VALUES (?, ?, ?)`,
        [stmtId, stmt.date, stmt.note || '']);
      for (const tx of stmt.transactions || []) {
        await db.run(`INSERT INTO transactions (statement_id, statement_date, asset_id, quantity_change, cost_change, note) VALUES (?, ?, ?, ?, ?, ?)`,
          [stmtId, tx.statement_date, nameToId[stmt.assetMap?.[tx.asset_id] || tx.asset_name], tx.quantity_change, tx.cost_change, tx.note || '']);
      }
    }

    await db.run('COMMIT');
    await cache.del('*');
    return { assets: backup.assets.length, strategies: backup.strategies.length, monthlyStatements: backup.monthlyStatements?.length || 0 };
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
};
```

---

## 2. 核心计算公式汇总

### 投资回报相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| **市值** | `marketValue = quantity × unitPrice` | 资产当前市场价值 |
| **期间收益** | `profit = (endValue - endInvested) - (startValue - startInvested)` | 期间收益变化 |
| **期间收益率** | `returnRate = (profit / startInvested) × 100` | 期间收益率百分比 |
| **累计持仓** | `runningQuantity += quantity_change` | 逐笔累加 |
| **累计成本** | `runningCost += cost_change` | 逐笔累加 |

### 配置分析相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| **资产类别占比** | `percent = (categoryValue / totalValue) × 100` | 按类别分组 |
| **层级内资产占比** | `percent = (assetValue / strategyValue) × 100` | 策略视角 |
| **配置偏差** | `deviation = actualPercent - targetPercent` | 实际-目标 |
| **自动分配权重** | `autoWeight = (100 - fixedWeightSum) / autoItemCount` | 自动分配 |

### 价格获取相关
| 计算项 | 公式 | 说明 |
|--------|------|------|
| **最新价格** | `MAX(date) WHERE date <= target` | 时间旅行查询 |
| **沪市代码** | `secid = '1.' + ticker` | 6/9/5开头 |
| **深市代码** | `secid = '0.' + ticker` | 其他 |

---

## 3. 数据流向说明

### 月度报表处理流程
```
用户输入 → createOrUpdate() → 事务写入 → calculateTotals() → 缓存清理
                                           ↓
                              getHistoryGraph() → 趋势图数据
```

### 仪表盘指标计算流程
```
getAllStatements() → getRangeStatements() → getMetrics() → 收益指标
                                              ↓
                              getAllocation() → 配置分布
                              getTrend() → 历史趋势
                              getAttribution() → 收益归因
```

### 价格同步流程
```
syncStockPrices() → fetchStockPrice() → 东财API → upsertPrice() → 缓存清理
syncGoldPrices() → fetchShGoldPrice() → 5huangjin.com → upsertPrice() → 缓存清理
```

### 资产历史查询流程
```
getHistory() → 遍历报表日期 → 累计持仓 → 查找价格 → 计算市值 → 返回序列
```

---

## 4. 关键算法说明

### 时间旅行查询 (Time Travel Query)
后端支持查询任意历史时点的投资组合状态：
1. 根据日期查找最近的月报表
2. 累计该日期前的所有交易记录
3. 使用该日期或之前的最新价格计算市值
4. 返回完整的持仓快照

```javascript
// 核心逻辑
const holdings = await db.query(`
  SELECT asset_id, SUM(quantity_change) as quantity, SUM(cost_change) as totalCost
  FROM transactions WHERE statement_date <= ?
  GROUP BY asset_id
`);
```

### 写穿透缓存模式 (Write-Through Cache)
月报表更新时采用写穿透策略：
1. 直接更新数据库
2. 删除相关缓存条目
3. 下次查询时重新填充缓存

### 收益归因计算
```
期末收益 = 期末市值 - 期末投入
期初收益 = 期初市值 - 期初投入
期间收益 = 期末收益 - 期初收益
期间收益率 = 期间收益 / 期初投入 × 100%
```

---

本文档涵盖了 InvestTrack 后端所有主要的计算逻辑。这些计算主要涉及：
1. **投资组合计算**: 市值、收益、收益率、持仓汇总
2. **时间旅行查询**: 历史时点的组合状态重建
3. **配置分析**: 资产配置、偏差计算、权重分配
4. **价格同步**: 股票、黄金等资产的价格获取
5. **数据导出/导入**: 备份恢复的数据转换
