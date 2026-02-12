# InvestTrack 单元测试

本项目使用 [Vitest](https://vitest.dev/) 作为测试框架。

## 快速开始

### 运行所有测试
```bash
npm test
```

### 运行特定测试文件
```bash
npm test -- tests/unit/health-check.test.js
```

### 运行测试（单轮，不 watch）
```bash
npm test -- --run
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

## 项目结构

```
tests/
├── fixtures/           # 测试数据
│   ├── assets.js       # 资产测试数据
│   ├── strategies.js   # 策略测试数据
│   ├── statements.js   # 月报测试数据
│   ├── transactions.js # 交易测试数据
│   └── prices.js       # 价格测试数据
├── setup/              # 测试配置
│   ├── global-setup.js # 全局 setup
│   └── setup.js        # 每个测试文件的 setup
├── unit/               # 单元测试
│   ├── server/         # 后端测试
│   │   └── statement-dashboard.test.js  # 数据结构和Dashboard计算测试
│   ├── client/         # 前端测试
│   └── health-check.test.js  # 健康检查
└── integration/        # 集成测试（待扩展）
```

## 编写测试

### 基本测试结构

```javascript
import { describe, it, expect } from 'vitest';

describe('模块名称', () => {
  describe('函数名称', () => {
    it('应该做某事', () => {
      // 准备
      const input = ...;
      
      // 执行
      const result = functionToTest(input);
      
      // 断言
      expect(result).toBe(expected);
    });
  });
});
```

### 使用 Fixtures

```javascript
import { testAssets, getAssetById } from '../fixtures/index.js';

it('应该正确获取资产', () => {
  const asset = getAssetById('asset-stock-1');
  expect(asset).toBeDefined();
  expect(asset.category).toBe('security');
});
```

### 异步测试

```javascript
it('应该异步获取数据', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});
```

### Mock 外部依赖

```javascript
import { vi } from 'vitest';

// Mock 模块
vi.mock('undici', () => ({
  fetch: vi.fn()
}));

// 在测试中使用
fetch.mockResolvedValue({ json: () => ({ data: 'test' }) });
```

## 测试准则

### 命名规范
- 测试文件: `*.test.js` 或 `*.test.ts`
- 测试套件: `describe('模块名称', ...)`
- 测试用例: `it('应该...', ...)` 或 `it('should...', ...)`

### 断言最佳实践
- 使用 `toBe()` 比较原始值
- 使用 `toEqual()` 比较对象
- 使用 `toBeCloseTo()` 比较浮点数
- 使用 `toHaveLength()` 检查数组长度
- 使用 `toContain()` 检查数组元素

### 边界条件测试
- 空输入 (null, undefined, [])
- 零值处理
- 负数处理
- 极大/极小数值
- 日期边界

## 关键测试案例

### 1. 数据结构一致性测试 (`statement-dashboard.test.js`)

这个测试文件验证了**本次Bug修复**：`getDetailsByPeriod` 返回的数据结构必须与 `getDetails` 一致。

**Bug描述**: `getDetailsByPeriod` 返回 `positions` 字段，但 `dashboardService` 期望 `assets` 字段，导致 Dashboard API 返回全零。

**测试覆盖**:
- ✅ `getDetailsByPeriod` 必须返回 `assets` 字段（而非 `positions`）
- ✅ 数据结构一致性验证
- ✅ 总和计算正确性
- ✅ Dashboard Metrics 计算（收益、收益率）
- ✅ Dashboard Breakdown 计算（分层归因、ROI）
- ✅ 服务间数据一致性

运行测试：
```bash
npm test -- tests/unit/server/statement-dashboard.test.js --run
```

## 覆盖率目标

| 模块 | 目标 | 状态 |
|------|------|------|
| dashboardService.js | 90%+ | 🟡 部分覆盖 |
| statementService.js | 85%+ | 🟡 部分覆盖 |
| calculators.ts | 95%+ | 🟡 待实施 |
| 整体 | 80%+ | 🟡 进行中 |

## 故障排除

### 测试找不到模块
确保使用正确的相对路径：
```javascript
// 正确
import { testAssets } from '../fixtures/index.js';

// 错误 - 动态 import 路径解析可能有问题
const { testAssets } = await import('../../fixtures/index.js');
```

### ESM 模块问题
项目使用 ESM (`"type": "module"`)，所有测试文件必须使用 `.js` 或 `.ts` 扩展名。

### 数据库测试
需要在测试中使用内存 SQLite，参考后续数据库测试示例。

## 相关文档

- [Vitest 文档](https://vitest.dev/)
- [API 参考](https://vitest.dev/api/)
- [项目测试计划](../tmp_doc/UNIT_TEST_PLAN.md)
