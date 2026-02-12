# InvestTrack API 集成测试

> 完整的 API 测试指南，包含数据导入、测试执行和验证流程

## 目录

- [快速开始](#快速开始)
- [测试架构](#测试架构)
- [测试流程](#测试流程)
- [测试脚本](#测试脚本)
- [预期数据](#预期数据)
- [故障排除](#故障排除)

---

## 快速开始

### 1. 环境准备

确保后端服务已启动：

```bash
# 方式1: 直接启动后端
npm start

# 方式2: 开发模式（同时启动前端）
npm run dev
```

服务应该在 `http://localhost:3001` 运行。

### 2. 快速验证

运行快速验证脚本检查基本状态：

```bash
node tests/scripts/quick-verify.js
```

### 3. 运行完整测试

```bash
# 完整测试（自动导入数据 + 运行测试）
node tests/scripts/run-api-tests.js

# 或使用 vitest 直接运行
npm test -- tests/integration/example-data-api.test.js --run
```

---

## 测试架构

### 目录结构

```
tests/
├── integration/           # 集成测试
│   └── example-data-api.test.js    # API 集成测试主文件
├── fixtures/              # 测试数据
│   ├── example-data.js    # 基于 example.json 的预期数据
│   ├── assets.js          # 资产测试数据
│   ├── strategies.js      # 策略测试数据
│   └── statements.js      # 月报测试数据
├── scripts/               # 测试脚本
│   ├── run-api-tests.js   # 自动化测试脚本
│   ├── fix-bitcoin-price.js        # 修复 Bitcoin 价格
│   └── quick-verify.js    # 快速验证
└── README.md              # 测试文档
```

### 测试覆盖

| 模块 | 测试内容 | 状态 |
|------|----------|------|
| 数据导入 | example.json 导入验证 | ✅ |
| Assets API | 资产列表、历史数据 | ✅ |
| Strategies API | 策略列表、分层结构 | ✅ |
| Statements API | 月报列表、历史图表 | ✅ |
| Dashboard API | 指标、配置、趋势、概览 | ✅ |
| 数据准确性 | 持仓、市值、收益率计算 | ✅ |
| 边界条件 | 错误处理、分页 | ✅ |

---

## 测试流程

### 阶段 1: 数据导入

#### 1.1 手动导入

```bash
# 使用 seed_data.js
node scripts/seed_data.js

# 或使用 API
node tests/scripts/run-api-tests.js --import-only
```

#### 1.2 导入验证

导入完成后，验证数据完整性：

```bash
curl -s http://localhost:3001/api/assets | jq '.data | length'
# 应该返回: 7

curl -s http://localhost:3001/api/strategies | jq '.data | length'
# 应该返回: 1

curl -s http://localhost:3001/api/statements | jq '.data.total'
# 应该返回: 6
```

### 阶段 2: 数据验证

#### 2.1 验证资产数据

**请求:**
```bash
curl -s http://localhost:3001/api/assets | jq '.data[] | {name, type}'
```

**预期返回:**
```json
[
  {"name": "沪深300ETF", "type": "fund"},
  {"name": "纳指100ETF", "type": "fund"},
  {"name": "腾讯控股", "type": "security"},
  {"name": "招商银行理财", "type": "wealth"},
  {"name": "实物黄金", "type": "gold"},
  {"name": "Bitcoin", "type": "crypto"},
  {"name": "备用金(余额宝)", "type": "fixed"}
]
```

#### 2.2 验证策略数据

**请求:**
```bash
curl -s http://localhost:3001/api/strategies | jq '.data[0] | {name, layerCount: (.layers | length)}'
```

**预期返回:**
```json
{
  "name": "2024 全球配置策略 (模拟)",
  "layerCount": 2
}
```

#### 2.3 验证月报数据

**请求:**
```bash
curl -s http://localhost:3001/api/statements/history | jq '.data | map({date, totalValue, totalInvested})'
```

**预期返回（节选）:**
```json
[
  {"date": "2024-01-31", "totalValue": 258469.54, "totalInvested": 254000},
  {"date": "2024-02-29", "totalValue": 265306.49, "totalInvested": 256000},
  {"date": "2024-03-31", "totalValue": 272096.05, "totalInvested": 256000},
  {"date": "2024-04-30", "totalValue": 280599.54, "totalInvested": 258000},
  {"date": "2024-05-31", "totalValue": 294792.45, "totalInvested": 271000},
  {"date": "2024-06-30", "totalValue": 303216.77, "totalInvested": 275000}
]
```

### 阶段 3: Dashboard 验证

#### 3.1 验证关键指标

**请求:**
```bash
curl -s "http://localhost:3001/api/dashboard/metrics?viewMode=total&timeRange=all" | jq '.data'
```

**预期返回:**
```json
{
  "endValue": 303216.77,
  "endInvested": 275000,
  "startValue": 0,
  "startInvested": 0,
  "profit": 28216.77,
  "returnRate": 10.26,
  "periodLabel": "历史累计"
}
```

> **注意:** 如果 `returnRate` 为负数（如 -12.2%），说明 Bitcoin 价格需要修复，参见 [故障排除](#故障排除)。

#### 3.2 验证资产配置

**请求:**
```bash
curl -s "http://localhost:3001/api/dashboard/allocation?viewMode=total" | jq '.data'
```

**预期返回:**
```json
[
  {"name": "股票基金", "value": 136989.78, "percent": 48.4, "color": "#3b82f6"},
  {"name": "现金固收", "value": 75060.00, "percent": 26.5, "color": "#64748b"},
  {"name": "商品另类", "value": 92165.62, "percent": 32.5, "color": "#f59e0b"}
]
```

#### 3.3 验证趋势数据

**请求:**
```bash
curl -s "http://localhost:3001/api/dashboard/trend?viewMode=total" | jq '.data'
```

**预期返回（6个月数据点）:**
```json
[
  {"date": "2024-01-31", "value": 258469.54, "invested": 254000},
  {"date": "2024-02-29", "value": 265306.49, "invested": 256000},
  {"date": "2024-03-31", "value": 272096.05, "invested": 256000},
  {"date": "2024-04-30", "value": 280599.54, "invested": 258000},
  {"date": "2024-05-31", "value": 294792.45, "invested": 271000},
  {"date": "2024-06-30", "value": 303216.77, "invested": 275000}
]
```

### 阶段 4: 详细持仓验证

#### 4.1 验证 2024-06-30 持仓

**请求:**
```bash
curl -s "http://localhost:3001/api/statements/details-by-date?date=2024-06-30" | jq '.data.assets | map({name, quantity, totalCost, marketValue})'
```

**预期持仓:**

| 资产 | 数量 | 成本 | 市值 | 盈亏 |
|------|------|------|------|------|
| 沪深300ETF | 10,582.63 | ¥37,000 | ¥35,217 | -4.82% |
| 纳指100ETF | 21,724.14 | ¥26,000 | ¥25,200 | -3.08% |
| 腾讯控股 | 205.64 | ¥58,000 | ¥75,570 | +30.29% |
| 招商银行理财 | 55,000 | ¥55,000 | ¥55,000 | 0% |
| 实物黄金 | 61.91 | ¥30,000 | ¥30,387 | +1.29% |
| **Bitcoin** | 0.1079 | ¥49,000 | ¥61,782 | +26.09% |
| 备用金 | 20,060 | ¥20,000 | ¥20,060 | +0.30% |
| **合计** | - | **¥275,000** | **¥303,217** | **+10.26%** |

---

## 测试脚本

### 脚本列表

| 脚本 | 用途 | 使用场景 |
|------|------|----------|
| `run-api-tests.js` | 自动化完整测试 | CI/CD、回归测试 |
| `quick-verify.js` | 快速状态检查 | 开发调试、部署验证 |
| `fix-bitcoin-price.js` | 修复 Bitcoin 价格 | 数据异常时 |

### run-api-tests.js

**功能:** 自动化测试流程

**使用方法:**

```bash
# 完整测试（导入 + 验证 + 测试）
node tests/scripts/run-api-tests.js

# 只导入数据
node tests/scripts/run-api-tests.js --import-only

# 跳过导入，直接测试
node tests/scripts/run-api-tests.js --skip-import

# 详细输出
node tests/scripts/run-api-tests.js --verbose

# 自定义 API 地址
API_BASE=http://localhost:3002/api node tests/scripts/run-api-tests.js
```

**输出示例:**

```
╔════════════════════════════════════╗
║     InvestTrack API 测试工具      ║
╚════════════════════════════════════╝

🔍 检查服务状态...
✅ 服务正在运行

📦 导入 example.json 数据...
✅ 数据导入成功
   资产: 7
   策略: 1
   月报: 6

🔍 验证关键数据...
✅ 资产数量正确 (7)
✅ Bitcoin价格已修复
✅ 收益率为正: +10.26%

🧪 运行API测试...
... (测试详细输出)

✅ 所有测试通过

╔════════════════════════════════════╗
║        🎉 所有测试通过！          ║
╚════════════════════════════════════╝
```

### quick-verify.js

**功能:** 快速状态检查

**使用方法:**

```bash
node tests/scripts/quick-verify.js
```

**输出示例:**

```
╔════════════════════════════════════╗
║     InvestTrack 快速验证工具      ║
╚════════════════════════════════════╝

1️⃣  检查服务状态...
   ✅ 服务正在运行

2️⃣  检查资产数据...
   ✅ 资产数量正确 (7)

3️⃣  检查策略数据...
   ✅ 策略数量正确 (1)

4️⃣  检查月度报表...
   ✅ 月报数量正确 (6)

5️⃣  检查关键指标...
   总市值: ¥303216.77
   总投入: ¥275000
   盈亏: ¥28216.77
   收益率: 10.26%
   ✅ 收益率为正

════════════════════════════════════════
✅ 所有检查通过！

你可以运行完整测试:
  npm test -- tests/integration/example-data-api.test.js --run
```

### fix-bitcoin-price.js

**功能:** 修复 Bitcoin 价格异常

**使用场景:** 当 Bitcoin 价格被错误设置为低值（如150）时使用

**使用方法:**

```bash
# 使用默认价格修复（572585.2491）
node tests/scripts/fix-bitcoin-price.js

# 指定价格修复
node tests/scripts/fix-bitcoin-price.js 600000
```

**何时使用:**
- Dashboard 显示收益率为负（-12.2%）
- Bitcoin 市值显示为 ¥16（过低）
- 其他资产价格正常，但总值不对

---

## 预期数据

### 资产清单

| 名称 | 类型 | 代码 | 2024-06价格 |
|------|------|------|-------------|
| 沪深300ETF | fund | 510300 | ¥3.3277 |
| 纳指100ETF | fund | 513100 | ¥1.16 |
| 腾讯控股 | security | 00700.HK | ¥367.4824 |
| 招商银行理财 | wealth | - | ¥1.00 |
| 实物黄金 | gold | - | ¥490.8873 |
| Bitcoin | crypto | BTC | ¥572,585.2491 |
| 备用金(余额宝) | fixed | - | ¥1.00 |

### 最终持仓（2024-06-30）

基于所有 transactions 累计：

```javascript
const expectedHoldings = {
  '沪深300ETF': { quantity: 10582.6317, cost: 37000 },
  '纳指100ETF': { quantity: 21724.1379, cost: 26000 },
  '腾讯控股': { quantity: 205.6434, cost: 58000 },
  '招商银行理财': { quantity: 55000, cost: 55000 },
  '实物黄金': { quantity: 61.9056, cost: 30000 },
  'Bitcoin': { quantity: 0.1079, cost: 49000 },
  '备用金(余额宝)': { quantity: 20060, cost: 20000 }
};
```

### 预期汇总

```javascript
const expectedSummary = {
  totalInvested: 275000,      // 总投入
  totalValue: 303216.77,      // 总市值
  profit: 28216.77,           // 盈亏
  returnRate: 10.26           // 收益率 %
};
```

---

## 故障排除

### 问题 1: 服务未运行

**症状:**
```
❌ 服务未运行，请先启动后端服务
   npm start
```

**解决:**
```bash
# 启动后端服务
npm start

# 或开发模式
npm run dev
```

### 问题 2: Bitcoin 价格错误

**症状:**
```
🔍 验证关键数据...
⚠️  警告: Bitcoin价格可能未修复 (市值过低)
   建议运行: node tests/scripts/fix-bitcoin-price.js

收益率: -12.20%
```

**解决:**
```bash
node tests/scripts/fix-bitcoin-price.js
```

**验证修复:**
```bash
curl -s "http://localhost:3001/api/dashboard/metrics?viewMode=total&timeRange=all" | jq '.data.returnRate'
# 应该返回: 10.26（正数）
```

### 问题 3: 数据未导入

**症状:**
```
⚠️  资产数量不符 (预期: 7, 实际: 0)
```

**解决:**
```bash
# 导入数据
node scripts/seed_data.js

# 或
node tests/scripts/run-api-tests.js --import-only
```

### 问题 4: 测试失败

**症状:**
```
❌ 测试失败 (退出码: 1)
```

**排查步骤:**

1. **检查服务状态:**
```bash
node tests/scripts/quick-verify.js
```

2. **检查具体 API:**
```bash
# 检查资产
curl -s http://localhost:3001/api/assets | jq

# 检查 Dashboard
curl -s "http://localhost:3001/api/dashboard/metrics?viewMode=total&timeRange=all" | jq
```

3. **运行单个测试:**
```bash
npm test -- tests/integration/example-data-api.test.js --run -t "应该成功导入"
```

4. **查看详细日志:**
```bash
node tests/scripts/run-api-tests.js --verbose
```

### 问题 5: ESM 模块错误

**症状:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module...
```

**解决:**
```bash
# 确保安装了所有依赖
npm install

# 确保使用正确的 Node.js 版本
node --version
# 需要 v18+
```

---

## 持续集成

### GitHub Actions 示例

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start server
        run: npm start &
        env:
          NODE_ENV: test
      
      - name: Wait for server
        run: sleep 5
      
      - name: Run API tests
        run: node tests/scripts/run-api-tests.js
```

---

## 相关文档

- [项目测试指南](../README.md) - 通用测试文档
- [API 文档](../../API_DOCUMENTATION.md) - API 详细说明
- [数据说明](../../scripts/example.json) - 样例数据源

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-02-12 | 1.0.0 | 初始版本，包含完整的 API 测试套件 |

---

**维护者:** InvestTrack Team  
**最后更新:** 2026-02-12
