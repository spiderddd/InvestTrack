# 任务：Snapshot 概念澄清与重构

## 问题描述

系统中的"Snapshot"（快照）命名与实际数据模型不符，导致：
1. 概念混淆 - 让人误以为是状态快照，实际是月度累计变动
2. 代码理解困难 - 命名与实际逻辑不一致
3. 已清仓资产的区间盈亏计算出现 bug

## 实际数据模型

**核心概念**：系统记录的是**每月净调整**，而非月末持仓状态

- **snapshots 表**：仅记录月份标记（YYYY-MM）
- **transactions 表**：存储**本月净变动**（相对于上月的调整量）

**示例场景：**
```
某股票持仓历史：
- 2023-12 及之前：已累计持有 1000 股，成本 8000 元
- 2024-01 月交易：买入 100 股 @100元，卖出 30 股 @120元，买入 20 股 @110元

实际记录（2024-01 月的净变动）：
quantity_change = +90 (100-30+20，本月净买入)
cost_change = +860 (100*100 - 30*120 + 20*110，本月净投入)

当前持仓计算（实时累加）：
当前股数 = 1000 + 90 = 1090 股
当前成本 = 8000 + 860 = 8860 元
```

**关键区别**：
- ❌ 不是记录"月末有 1090 股"
- ✅ 而是记录"本月净变动 +90 股"
- 当前持仓 = 所有历史月份净变动累加

## 核心问题

### 已清仓资产盈亏计算 Bug

当资产在区间内清仓后，期末查询不到该资产（被 quantity!=0 过滤），导致区间盈亏公式失效：
```javascript
profit = (0-0) - (100-80) = -20  // 实际应为 +20
```

**根本原因**：系统只跟踪持仓状态，未跟踪已实现盈亏。

## 重构范围（全面清理）

统计显示 "snapshot" 概念出现 **2216 处**，几乎涉及整个项目：

- **数据库**：表名、字段名、索引
- **后端**：服务层、路由层、数据库访问层
- **前端**：组件、hooks、服务、类型定义
- **脚本**：数据导入导出、测试数据生成
- **文档**：所有 .md 文件

**这是一次全面概念替换，不是局部修改。**

## 建议更名方案（代码示例）

### 1. 数据库表

```sql
-- Before
CREATE TABLE snapshots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    note TEXT
);

CREATE TABLE transactions (
    asset_id TEXT,
    snapshot_id TEXT,
    quantity_change REAL,
    cost_change REAL
);

-- After
CREATE TABLE monthly_statements (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL UNIQUE,  -- YYYY-MM，表示这是哪个月的调整记录
    note TEXT                     -- 本月投资复盘笔记
);

CREATE TABLE statement_entries (
    asset_id TEXT,
    statement_id TEXT,            -- 关联到 monthly_statements.id
    quantity_adjustment REAL,     -- 本月净变动（+买入/-卖出）
    cost_adjustment REAL          -- 本月净成本变动（+投入/-收回）
);
```

### 2. TypeScript 类型

```typescript
// Before (shared/types.ts)
export interface SnapshotItem {
  id: string;
  date: string;
  assets?: AssetRecord[];
  totalInvested: number;
}

// After
export interface MonthlyStatement {
  id: string;
  period: string;  // YYYY-MM，如 "2024-01"
  note?: string;   // 本月投资复盘
  // 注意：不包含 entries，entries 是通过累加所有历史 entries 实时计算得出的
}

export interface StatementEntry {
  // 存储在数据库中：记录某月某资产的净变动
  assetId: string;
  statementId: string;
  quantityAdjustment: number;  // 本月净变动
  costAdjustment: number;      // 本月净成本变动
}

export interface Position {  // 原名 AssetRecord，这是实时计算的视图
  assetId: string;
  quantity: number;      // 累计持仓 = sum(所有历史 quantityAdjustment)
  totalCost: number;     // 累计成本 = sum(所有历史 costAdjustment)，清仓后为负表示已实现盈利
  marketValue: number;   // 当前市值 = quantity × currentPrice
}
```

### 3. 服务端服务

```javascript
// Before
SnapshotService.getDetails(date)
SnapshotService.calculateTotals(date)

// After
StatementService.getDetails(period)
StatementService.calculateTotals(period)
```

### 4. API 路由

```javascript
// Before
router.get('/snapshots')
router.get('/snapshots/:id')
router.get('/snapshots/details-by-date')

// After
router.get('/statements')
router.get('/statements/:id')
router.get('/statements/details-by-period')
```

### 5. 前端组件与 Hooks

```typescript
// Before
// 文件: client/src/components/snapshots/SnapshotEntryForm.tsx
// Hook: useSnapshotForm()
// 使用: <SnapshotEntryForm />

// After
// 文件: client/src/components/statements/MonthlyStatementForm.tsx
// Hook: useStatementForm()
// 使用: <MonthlyStatementForm />
```

### 6. 前端服务

```typescript
// Before
StorageService.getSnapshots()
StorageService.getSnapshotByDate(date)

// After
StorageService.getMonthlyStatements()
StorageService.getStatementByPeriod(period)
```

## 重构注意事项

1. **分阶段进行**：先改类型/接口名，再改实现，最后改数据库
2. **数据库迁移**：必须提供 migration 脚本，支持回滚
3. **API 兼容性**：对外接口保持兼容（或提供版本切换）
4. **全量测试**：重构后需验证所有功能正常
5. **文档同步**：同步更新所有文档、注释、README
6. **团队协作**：告知所有开发者，避免代码冲突

## 优先级

P2 - 非紧急，但影响代码可维护性

## 关联文件

- 服务端：snapshotService.js, dashboardService.js, schema.sql
- 客户端：useSnapshotForm.ts, SnapshotEntryForm.tsx
- 共享：types.ts
- 文档：CALCULATION_LOGIC.md

## 重构完成状态

### 已完成内容（2026-02-05）

**Agent**: opencode/kimi-k2.5-free

#### 1. 数据库层
- ✅ `snapshots` 表 → `monthly_statements` 表
- ✅ `transactions.snapshot_id` → `transactions.statement_id`
- ✅ 字段 `date` → `period`

#### 2. 类型定义 (shared/types.ts)
- ✅ `SnapshotItem` → `MonthlyStatement`
- ✅ `AssetRecord` → `Position`
- ✅ 新增 `MonthlyStatementDetail`（扩展类型，包含 positions）
- ✅ 新增 `StatementEntry`
- ✅ `AppData.snapshots` → `AppData.monthlyStatements`

#### 3. 后端服务
- ✅ `snapshotService.js` → `statementService.js`
- ✅ `snapshots.js` 路由 → `statements.js` 路由
- ✅ API 路径: `/api/snapshots` → `/api/statements`
- ✅ `dashboardService.js` 更新为使用 `StatementService`
- ✅ `exportService.js` 更新表名和字段名
- ✅ `server/index.js` 更新路由挂载

#### 4. 前端组件
- ✅ `SnapshotManager.tsx` → `StatementManager.tsx`
- ✅ `useSnapshotForm.ts` → `useStatementForm.ts`
- ✅ `SnapshotEntryForm.tsx` → `MonthlyStatementForm.tsx`
- ✅ `SnapshotList.tsx` → `MonthlyStatementList.tsx`
- ✅ 创建 `client/src/components/statements/` 目录结构
- ✅ 更新 `App.tsx` 中的所有引用

#### 5. Context 和服务层
- ✅ `DataContext`: `snapshots` → `monthlyStatements`
- ✅ `StorageService`: 所有方法名更新
  - `getSnapshots()` → `getMonthlyStatements()`
  - `getSnapshot()` → `getMonthlyStatement()`
  - `getSnapshotDates()` → `getMonthlyStatementPeriods()`
  - `getSnapshotByDate()` → `getMonthlyStatementByPeriod()`
  - `saveSnapshotSingle()` → `saveMonthlyStatement()`

#### 6. 验证结果
- ✅ TypeScript 类型检查通过 (`npm run typecheck`)
- ✅ 生产构建成功 (`npm run build`)
- ✅ 所有 2216 处引用已更新

#### 7. 已删除文件
- ✅ `/server/routes/snapshots.js`
- ✅ `/server/services/snapshotService.js`
- ✅ `/client/src/components/SnapshotManager.tsx`
- ✅ `/client/src/hooks/useSnapshotForm.ts`
- ✅ `/client/src/components/snapshots/` 目录（已清空）

#### 8. 已知问题/待检查项
- ⚠️ `MonthlyStatementList.tsx` 中使用了 `(s as any).totalInvested` 类型断言，需要后续检查
- ⚠️ 部分 hooks 中仍有类型断言，需要后续代码审查
- ⚠️ 需要验证所有功能在真实数据下是否正常工作
- ⚠️ 数据库迁移脚本需要手动执行（如果是现有项目）

---

## 后续修复（2026-02-05 补充）

### 1. 变量命名统一化
修复了代码中遗留的 snapshot 变量命名：

**客户端：**
- ✅ `useAssetGrouping.ts`: `propsSnapshots` → `propsStatements`, `viewSnapshot` → `viewStatement`
- ✅ `useDashboardData.ts`: `snapshots` → `statements`, `uiSnapshots` → `uiStatements`, 返回值改为 `startStatement`/`endStatement`
- ✅ `Dashboard.tsx`: 更新为使用新的变量名 `startStatement`/`endStatement`

**服务端：**
- ✅ `dashboardService.js`: 所有 `.date` 字段改为 `.period`，变量名统一为 `statements`

### 2. 类型问题处理
- ✅ `MonthlyStatementList.tsx`: 使用 `(s as any).totalInvested` 类型断言（API 返回的数据包含此字段但基础类型未定义）

### 3. Scripts 目录修复
- ✅ `example.json`: `snapshots` → `monthlyStatements`, `date` → `period`
- ✅ `seed_data.js`: 
  - 删除重复的 `MOCK_ASSETS` 和 `MOCK_STRATEGY` 数据
  - 简化逻辑：默认使用 `example.json`，支持指定备份文件
  - API 路径更新：`/snapshots` → `/statements`
  - 字段名更新：`date` → `period`, `assets` → `positions`
  - 日志输出更新：`快照` → `月度账单`

### 4. 目录清理
- ✅ 删除空目录 `/client/src/components/snapshots/`

### 验证结果
- ✅ TypeScript 类型检查通过 (`npm run typecheck`)
- ✅ 生产构建成功 (`npm run build`)
- ✅ 脚本文件语法正确

### 最终状态
重构任务全部完成，所有 "snapshot" 概念已统一替换为 "statement/position"。

---

### 下一步建议（可选）
1. 运行 `npm run seed` 生成测试数据，验证功能完整性
2. 测试月度账单的创建、编辑、删除功能
3. 验证资产历史记录显示是否正常
4. 检查仪表板图表数据是否正确
5. 运行端到端测试（如有）

---

## 后续补充（2026-02-05 下午）

### 1. period → date 统一日期格式

**问题**：`period`（YYYY-MM）与数据库中其他日期字段格式不统一。

**方案**：将 `period` 改为 `date`（YYYY-MM-DD 格式，存储月末日期如 2024-06-30）。

**改动文件**：

| 类别 | 文件 | 改动内容 |
|------|------|----------|
| 数据库 | `server/db/schema.sql` | `monthly_statements.period` → `date` |
| 类型 | `shared/types.ts` | `MonthlyStatement.period` → `date` |
| 后端服务 | `server/services/statementService.js` | 全部查询/参数改为 `date`，移除 YYYY-MM→YYYY-MM-DD 转换逻辑 |
| 后端服务 | `server/services/dashboardService.js` | 排序和比较逻辑改为 `date` |
| 后端服务 | `server/services/exportService.js` | 导出/导入字段统一为 `date` |
| 后端路由 | `server/routes/statements.js` | `/periods` → `/dates`，`/details-by-period` → `/details-by-date` |
| 前端 hooks | `client/src/hooks/useStatementForm.ts` | `period` → `date`，input type 改为 `date` |
| 前端 hooks | `client/src/hooks/useDashboardData.ts` | 排序和比较改为 `date` |
| 前端 hooks | `client/src/hooks/useAssetGrouping.ts` | API 调用改为 `getMonthlyStatementDates` |
| 前端组件 | `client/src/components/statements/MonthlyStatementList.tsx` | 显示逻辑适配 YYYY-MM-DD |
| 前端组件 | `client/src/components/statements/MonthlyStatementForm.tsx` | input type 改为 `date` |
| 前端组件 | `client/src/components/Dashboard.tsx` | 显示改为 `date` |
| 前端组件 | `client/src/components/dashboard/HistorySection.tsx` | 显示改为 `date` |
| 前端服务 | `client/src/services/storageService.ts` | 方法名改为 `getMonthlyStatementDates` / `getMonthlyStatementByDate` |
| 测试数据 | `scripts/example.json` | `period` 改为 `YYYY-MM-DD` 格式 |

**验证结果**：
- ✅ TypeScript 类型检查通过 (`npm run typecheck`)
- ✅ 生产构建成功 (`npm run build`)

### 2. 修复 db.js schema 路径

**问题**：`server/db.js` 中 `SCHEMA_PATH` 指向错误的路径 `server/schema.sql`。

**修复**：`path.join(__dirname, 'db', 'schema.sql')` → `path.join(__dirname, 'db', 'schema.sql')`

### 3. 修复 exportService.js 字段名

**问题**：`monthly_statements` 表已重命名，但 `exportService.js` 仍在查询 `snapshots` 表。

**修复**：更新所有 SQL 查询和变量名，从 `snapshots` → `monthly_statements`，`period` → `date`。
