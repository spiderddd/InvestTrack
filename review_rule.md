# InvestTrack 架构与代码审查报告

## 🧱 审查维度

### 1️⃣ 数据库 / 表结构设计
- **冗余字段与数据一致性风险**
  - **问题描述**: `strategy_targets` 表中存在 `target_name` 字段，而 `assets` 表中已有 `name`。
  - **产生原因**: 可能是为了减少查询时的 JOIN 操作，或者在策略快照中保留历史名称。
  - **优化建议**: 
    - 如果是为了历史快照，应明确字段定义（如 `snapshot_name`）。
    - 否则建议移除该冗余字段，完全依赖 `asset_id` 关联 `assets` 表获取名称，避免资产改名后策略显示旧名称的不一致问题。
- **命名规范不统一**
  - **问题描述**: 数据库字段使用 `snake_case` (如 `total_value`)，而前端 TypeScript 定义使用 `camelCase` (如 `totalValue`)。
  - **产生原因**: SQL 标准习惯与 JS 习惯的冲突。
  - **优化建议**: 在后端 DAO 层 (Data Access Object) 增加统一的映射层（Mapper），在数据离开数据库层的第一时间转换为 camelCase，避免在 Service 业务逻辑中混用两种命名风格。
- **快照表设计的双重职责**
  - **问题描述**: `snapshots` 表既作为“月度日志”也作为“缓存”（存储了计算后的 `total_value`）。
  - **潜在风险**: 如果手动修改了底层 `transactions` 表，`snapshots` 表的汇总数据不会自动更新，导致数据不一致。
  - **优化建议**: 明确读写分离逻辑。写入 Transaction 时必须触发 Snapshot 的重算（Recalculate）机制，或将 `total_value` 视为纯缓存字段，读取时若发现脏数据需重新聚合。

### 2️⃣ API 设计
- **前端过度承担业务逻辑 (Critical)**
  - **不合理点**: 前端 `StorageService.syncStrategies` 负责计算策略的 Diff（新增、修改、删除），并循环发送多次 HTTP 请求来同步状态。
  - **潜在风险**: 
    - **原子性丧失**: 如果网络在发送第 3 个请求时中断，策略数据将处于“部分更新”的损坏状态。
    - **性能低下**: N 次 HTTP 往返比 1 次批量请求慢得多。
  - **改进建议**: 后端提供 `POST /strategies/sync` 接口，接收完整的策略 JSON，由后端在单一数据库事务（Transaction）中完成 Diff 和批量更新操作。
- **Dashboard 接口过于细碎**
  - **不合理点**: Dashboard 需要分别调用 `overview`, `metrics`, `allocation`, `trend` 等多个接口。虽然 `useDashboardData` 尝试并发请求，但增加了网络开销和前端状态管理的复杂度。
  - **改进建议**: 提供聚合接口 (BFF 模式)，一次性返回 Dashboard 所需的核心数据结构，减少网络握手开销。

### 3️⃣ 后端业务逻辑设计
- **内存聚合计算隐患**
  - **问题类型**: 性能瓶颈。
  - **具体表现**: `SnapshotService.getHistoryGraph` 和 `AssetService.getHistory` 都是将所有历史交易 (`transactions`) 拉取到内存中，通过 JS 循环进行累加计算。
  - **优化方向**: 
    - 随着使用时间增长，交易记录数万条时，Node.js 事件循环会被阻塞。
    - 应利用 SQLite 的聚合能力（Window Functions 或 Group By），将计算下沉到数据库层面；或者引入定期生成的“中间态快照”来减少回溯计算量。
- **Service 层与 Controller 层边界模糊**
  - **具体表现**: 部分 SQL 拼接和参数组装逻辑直接暴露在 Service 中，Service 兼职了 DAO 的工作。
  - **优化方向**: 引入 Repository/DAO 层专门处理 SQL 语句，Service 层只处理纯粹的业务逻辑（如校验、计算）。

### 4️⃣ 前端逻辑与状态管理
- **大组件与状态耦合**
  - **可读性问题**: `SnapshotEntryForm.tsx` 组件过于庞大，混合了 UI 渲染、复杂的表单行状态管理（Rows state）、数据转换逻辑（prepareSubmission）以及模态框逻辑。
  - **维护风险**: 修改表单的一个输入框行为可能意外破坏数据提交格式。
  - **改善建议**: 
    - 抽离 `SnapshotEntryTable` 为纯展示组件。
    - 将行计算逻辑（如 `quantity * price`）移入自定义 Hook 或工具函数。
- **Prop Drilling (属性透传)**
  - **具体表现**: `assets`, `strategies`, `snapshots` 从 `App.tsx` 一路透传到 `Dashboard`, `AssetManager` 等子组件，甚至再透传给孙组件。
  - **改善建议**: 虽然使用了 Context，但部分组件仍依赖 Props 传递全局数据。建议更彻底地利用 `useData()` Context，让深层组件按需订阅数据，减少 Props 链路。
- **Magic Number / String**
  - **具体表现**: 代码中散落着 `'fixed'`, `'wealth'` 等字符串字面量判断逻辑。
  - **改善建议**: 建立全局统一的 `AssetTypeEnum` 和工具函数（如 `isCashAsset(type)`），集中管理业务规则。

### 5️⃣ 前后端协作问题
- **类型定义断层**
  - **现象**: 前端有完善的 TypeScript `types.ts`，但后端是纯 JavaScript。
  - **长期影响**: 后端修改了返回结构（如重命名字段），前端 TS 检查不出来，直到运行时报错。
  - **优化建议**: 
    - 长期看后端应迁移至 TypeScript。
    - 短期内，可利用 JSDoc 或共享的 JSON Schema 来约束前后端的数据契约。
- **排序逻辑分散**
  - **现象**: 策略和资产的排序逻辑有时在 SQL 中 (`ORDER BY`)，有时在前端组件中 (`.sort()`)。
  - **优化建议**: 统一排序规则。对于分页列表，必须在后端排序；对于全量小数据，约定由前端负责展示排序，后端仅保证数据完整性。

### 6️⃣ 项目整体结构与技术债
- **根目录污染**
  - **技术债类型**: 结构混乱（低）。
  - **具体表现**: 项目根目录下混合了前端源码、后端源码 (`server.js`)、构建配置、脚本 (`seed_data.js`)。
  - **是否建议处理**: 建议。
  - **优化方向**: 
    - 建立 `src/` (前端)、`server/` (后端)、`scripts/` (工具脚本) 的清晰目录结构。
    - `types.ts` 应移动到 `shared/` 或前端目录下，避免根目录文件过多。
- **缺乏错误边界与日志监控**
  - **技术债类型**: 稳定性（中）。
  - **具体表现**: 前端使用了简单的 `console.error`，后端也是直接打印错误。生产环境（Docker 容器）中难以排查问题。
  - **优化方向**: 引入简单的日志库（如 winston）和前端 ErrorBoundary 组件。

## 📌 总结输出：最值得优先处理的问题

如果不进行大规模重构，以下 **3 个点** 是性价比最高的优化方向（High Impact, Low Effort）：

1.  **🚀 修复策略同步的原子性问题**: 
    - 将 `StorageService.syncStrategies` 中的前端 Diff + 循环请求逻辑，改为后端的一个 `bulkUpdate` 接口。这是由于数据一致性风险极高，必须优先解决。
2.  **🧹 统一前后端字段命名 (Mapper)**: 
    - 在后端 API 响应前增加一个轻量级的 Mapper 函数，将数据库的 `snake_case` 转为前端期望的 `camelCase`。这能消除前端代码中大量的 `data.total_value || data.totalValue` 这种丑陋的防御性代码。
3.  **🧩 拆分 `SnapshotEntryForm`**: 
    - 该组件逻辑过于复杂，是 Bug 的高发区。将其拆分为 View (展示) 和 Logic (Hook) 分离，能显著提升可维护性。
