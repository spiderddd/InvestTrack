# InvestTrack 后端API文档

> 生成时间: 2026-02-12  
> 基于样例数据: 7个资产, 1个策略, 6个月度报表 (2024-01 至 2024-06)

## 目录

1. [API概览](#api概览)
2. [Assets API](#1-assets-api)
3. [Strategies API](#2-strategies-api)
4. [Statements API](#3-statements-api)
5. [Dashboard API](#4-dashboard-api)
6. [Export API](#5-export-api)
7. [Prices API](#6-prices-api)

---

## API概览

### 基础路径
```
http://localhost:3001/api
```

### 响应格式
所有API返回统一格式:
```typescript
{
  success: boolean;      // 请求是否成功
  data: any;            // 响应数据
  message: string;      // 提示信息
}
```

---

## 1. Assets API

资产管理接口，用于维护投资标的的基本信息。

### 1.1 获取所有资产

**请求**
```
GET /api/assets
GET /api/assets?fields=id,name,type,ticker
GET /api/assets?format=simple
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 资产唯一ID |
| type | string | 资产类型: security/fund/wealth/gold/fixed/crypto/other |
| name | string | 资产名称 |
| ticker | string | 股票/基金代码 |
| note | string | 备注 |
| createdAt | number | 创建时间戳 |

**预期返回值** (基于样例数据)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "type": "fund",
      "name": "沪深300ETF",
      "ticker": "510300",
      "note": "A股核心宽基",
      "createdAt": 1706745600000
    },
    {
      "id": "uuid-2", 
      "type": "fund",
      "name": "纳指100ETF",
      "ticker": "513100",
      "note": "美股科技成长",
      "createdAt": 1706745600001
    },
    {
      "id": "uuid-3",
      "type": "security",
      "name": "腾讯控股",
      "ticker": "00700.HK",
      "note": "港股互联网龙头",
      "createdAt": 1706745600002
    },
    {
      "id": "uuid-4",
      "type": "wealth",
      "name": "招商银行理财",
      "ticker": "",
      "note": "R2稳健型",
      "createdAt": 1706745600003
    },
    {
      "id": "uuid-5",
      "type": "gold",
      "name": "实物黄金",
      "ticker": "",
      "note": "避险资产",
      "createdAt": 1706745600004
    },
    {
      "id": "uuid-6",
      "type": "crypto",
      "name": "Bitcoin",
      "ticker": "BTC",
      "note": "数字黄金",
      "createdAt": 1706745600005
    },
    {
      "id": "uuid-7",
      "type": "fixed",
      "name": "备用金(余额宝)",
      "ticker": "",
      "note": "流动资金",
      "createdAt": 1706745600006
    }
  ],
  "message": "Assets retrieved successfully"
}
```

### 1.2 创建资产

**请求**
```
POST /api/assets
Content-Type: application/json

{
  "name": "贵州茅台",
  "type": "security",
  "ticker": "600519",
  "note": "白酒龙头"
}
```

**请求参数**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 资产名称 |
| type | string | 是 | 资产类型 |
| ticker | string | 否 | 代码 |
| note | string | 否 | 备注 |

**预期返回值**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "贵州茅台",
    "type": "security",
    "ticker": "600519",
    "note": "白酒龙头",
    "createdAt": 1739356800000
  },
  "message": "Asset created successfully"
}
```

### 1.3 更新资产

**请求**
```
PUT /api/assets/{id}
Content-Type: application/json

{
  "name": "贵州茅台",
  "type": "security",
  "ticker": "600519",
  "note": "白酒龙头-更新"
}
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "success": true,
    "id": "uuid-1"
  },
  "message": "Asset updated successfully"
}
```

### 1.4 删除资产

**请求**
```
DELETE /api/assets/{id}
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "success": true
  },
  "message": "Asset deleted successfully"
}
```

### 1.5 更新资产价格

**请求**
```
POST /api/assets/{id}/price
Content-Type: application/json

{
  "price": 350.00,
  "date": "2026-02-12"  // 可选，默认今天
}
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "success": true
  },
  "message": "Price updated successfully"
}
```

### 1.6 批量获取资产价格

**请求**
```
POST /api/assets/prices
Content-Type: application/json

{
  "assetIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**预期返回值** (使用2024-06价格)
```json
{
  "success": true,
  "data": {
    "uuid-1": { "price": 3.3277, "date": "2024-06-30" },
    "uuid-2": { "price": 1.16, "date": "2024-06-30" },
    "uuid-3": { "price": 367.4824, "date": "2024-06-30" }
  },
  "message": "Prices retrieved successfully"
}
```

### 1.7 获取资产历史

**请求**
```
GET /api/assets/{id}/history
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | 日期 YYYY-MM-DD |
| unitPrice | number | 当日价格 |
| quantity | number | 累计持仓 |
| marketValue | number | 市值 |
| totalCost | number | 累计成本 |
| addedQuantity | number | 当月新增数量 |
| addedPrincipal | number | 当月新增成本 |
| note | string | 交易备注 |

**预期返回值** (以腾讯控股为例)
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-31",
      "unitPrice": 298.3178,
      "quantity": 200,
      "marketValue": 59663.56,
      "totalCost": 56000,
      "addedQuantity": 200,
      "addedPrincipal": 56000,
      "note": "初始建仓"
    },
    {
      "date": "2024-05-31",
      "unitPrice": 354.3937,
      "quantity": 205.6434,
      "marketValue": 72879.02,
      "totalCost": 58000,
      "addedQuantity": 5.6434,
      "addedPrincipal": 2000,
      "note": "看好后世加仓"
    }
  ],
  "message": "Asset history retrieved successfully"
}
```

---

## 2. Strategies API

策略管理接口，采用三层架构：StrategyVersion > StrategyLayer > StrategyTarget。

### 2.1 获取所有策略

**请求**
```
GET /api/strategies
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 策略ID |
| name | string | 策略名称 |
| description | string | 策略描述(Markdown) |
| startDate | string | 生效日期 YYYY-MM-DD |
| status | string | active/archived |
| layers | array | 策略分层 |
| layers[].name | string | 层级名称 |
| layers[].weight | number | 层级权重(0-100) |
| layers[].items | array | 资产配置 |
| layers[].items[].targetName | string | 标的名称 |
| layers[].items[].weight | number | 标的权重(0-100) |
| layers[].items[].color | string | 显示颜色 |

**预期返回值** (基于样例数据)
```json
{
  "success": true,
  "data": [
    {
      "id": "strategy-uuid-1",
      "name": "2024 全球配置策略 (模拟)",
      "description": "# 核心思想\n\n本策略采用 **核心-卫星** 架构...",
      "startDate": "2024-01-01",
      "status": "active",
      "archivedAt": null,
      "updatedAt": 1706745600000,
      "layers": [
        {
          "id": "layer-1",
          "name": "第一层：稳健底仓",
          "weight": 40,
          "description": "提供安全垫，随时可用的流动性",
          "items": [
            {
              "id": "target-1",
              "assetId": "uuid-4",
              "targetName": "招商银行理财",
              "weight": 20,
              "color": "#64748b",
              "note": "长期理财"
            },
            {
              "id": "target-2",
              "assetId": "uuid-7",
              "targetName": "备用金(余额宝)",
              "weight": 10,
              "color": "#94a3b8",
              "note": "随时取用"
            },
            {
              "id": "target-3",
              "assetId": "uuid-5",
              "targetName": "实物黄金",
              "weight": 10,
              "color": "#f59e0b",
              "note": "抗通胀"
            }
          ]
        },
        {
          "id": "layer-2",
          "name": "第二层：进取成长",
          "weight": 60,
          "description": "主要收益来源",
          "items": [
            {
              "id": "target-4",
              "assetId": "uuid-1",
              "targetName": "沪深300ETF",
              "weight": 20,
              "color": "#ef4444",
              "note": "做多中国"
            },
            {
              "id": "target-5",
              "assetId": "uuid-2",
              "targetName": "纳指100ETF",
              "weight": 20,
              "color": "#3b82f6",
              "note": "AI 浪潮"
            },
            {
              "id": "target-6",
              "assetId": "uuid-3",
              "targetName": "腾讯控股",
              "weight": 10,
              "color": "#8b5cf6",
              "note": "低估值反弹"
            },
            {
              "id": "target-7",
              "assetId": "uuid-6",
              "targetName": "Bitcoin",
              "weight": 10,
              "color": "#f97316",
              "note": "非对称收益"
            }
          ]
        }
      ]
    }
  ],
  "message": "Strategies retrieved successfully"
}
```

### 2.2 创建策略

**请求**
```
POST /api/strategies
Content-Type: application/json

{
  "name": "2025 策略",
  "description": "新策略",
  "startDate": "2025-01-01",
  "layers": [...]
}
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "success": true,
    "id": "new-strategy-uuid"
  },
  "message": "Strategy created successfully"
}
```

### 2.3 更新完整策略

**请求**
```
PUT /api/strategies/{id}
Content-Type: application/json

{
  "name": "2024 全球配置策略",
  "description": "更新描述",
  "startDate": "2024-01-01",
  "status": "active",
  "layers": [...]
}
```

### 2.4 更新策略版本元数据

**请求**
```
PUT /api/strategies/{id}/version
Content-Type: application/json

{
  "name": "新名称",
  "status": "archived"
}
```

### 2.5 更新策略分层

**请求**
```
PUT /api/strategies/{id}/layers
Content-Type: application/json

[
  { "name": "稳健层", "weight": 50 },
  { "name": "成长层", "weight": 50 }
]
```

### 2.6 更新策略标的

**请求**
```
PUT /api/strategies/{id}/targets
Content-Type: application/json

[
  {
    "layerId": "layer-1",
    "items": [
      { "assetId": "uuid-4", "targetName": "理财", "weight": 50, "color": "#64748b" }
    ]
  }
]
```

### 2.7 删除策略

**请求**
```
DELETE /api/strategies/{id}
```

---

## 3. Statements API

月度报表接口，记录每月投资调整。

### 3.1 获取报表列表

**请求**
```
GET /api/statements?page=1&limit=20
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| items | array | 报表列表 |
| items[].id | string | 报表ID |
| items[].date | string | 日期 YYYY-MM-DD |
| items[].note | string | 月度笔记 |
| items[].totalInvested | number | 当月投入 |
| total | number | 总数 |
| page | number | 当前页 |
| limit | number | 每页数量 |

**预期返回值** (基于样例数据)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "stmt-6",
        "date": "2024-06-30",
        "note": "# 2024-06 投资笔记\n\n半年总结...",
        "totalInvested": 4000
      },
      {
        "id": "stmt-5",
        "date": "2024-05-31",
        "note": "# 2024-05 投资笔记\n\n发奖金了...",
        "totalInvested": 13000
      },
      {
        "id": "stmt-4",
        "date": "2024-04-30",
        "note": "# 2024-04 投资笔记\n\n黄金涨疯了...",
        "totalInvested": 2000
      },
      {
        "id": "stmt-3",
        "date": "2024-03-31",
        "note": "# 2024-03 投资笔记\n\nA股这就3000点保卫战了...",
        "totalInvested": 0
      },
      {
        "id": "stmt-2",
        "date": "2024-02-29",
        "note": "# 2024-02 投资笔记\n\n美股持续新高...",
        "totalInvested": 2000
      },
      {
        "id": "stmt-1",
        "date": "2024-01-31",
        "note": "# 2024-01 投资笔记\n\n建仓完成...",
        "totalInvested": 234000
      }
    ],
    "total": 6,
    "page": 1,
    "limit": 20
  },
  "message": "Statements retrieved successfully"
}
```

### 3.2 获取所有报表日期

**请求**
```
GET /api/statements/dates
```

**预期返回值**
```json
{
  "success": true,
  "data": ["2024-06-30", "2024-05-31", "2024-04-30", "2024-03-31", "2024-02-29", "2024-01-31"],
  "message": "Statement dates retrieved successfully"
}
```

### 3.3 获取历史图表数据

**请求**
```
GET /api/statements/history
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | 报表日期 |
| totalValue | number | 总资产市值 |
| totalInvested | number | 累计投入 |
| assets | array | 各资产详情 |

**预期返回值** (关键时间点)
```json
{
  "success": true,
  "data": [
    {
      "id": "stmt-1",
      "date": "2024-01-31",
      "totalValue": 225000.00,
      "totalInvested": 234000,
      "assets": [
        { "assetId": "uuid-1", "quantity": 10000, "unitPrice": 3.376, "marketValue": 33760, "totalCost": 35000 },
        { "assetId": "uuid-2", "quantity": 20000, "unitPrice": 1.1534, "marketValue": 23068, "totalCost": 24000 },
        { "assetId": "uuid-3", "quantity": 200, "unitPrice": 298.3178, "marketValue": 59663.56, "totalCost": 56000 },
        { "assetId": "uuid-4", "quantity": 50000, "unitPrice": 1, "marketValue": 50000, "totalCost": 50000 },
        { "assetId": "uuid-5", "quantity": 50, "unitPrice": 497.5638, "marketValue": 24878.19, "totalCost": 24000 },
        { "assetId": "uuid-6", "quantity": 0.1, "unitPrice": 470997.9085, "marketValue": 47099.79, "totalCost": 45000 },
        { "assetId": "uuid-7", "quantity": 20000, "unitPrice": 1, "marketValue": 20000, "totalCost": 20000 }
      ]
    },
    {
      "id": "stmt-6",
      "date": "2024-06-30",
      "totalValue": 283215.40,
      "totalInvested": 275000,
      "assets": [
        { "assetId": "uuid-1", "quantity": 10582.6317, "unitPrice": 3.3277, "marketValue": 35217.03, "totalCost": 37000 },
        { "assetId": "uuid-2", "quantity": 21724.1379, "unitPrice": 1.16, "marketValue": 25200.00, "totalCost": 26000 },
        { "assetId": "uuid-3", "quantity": 205.6434, "unitPrice": 367.4824, "marketValue": 75572.75, "totalCost": 58000 },
        { "assetId": "uuid-4", "quantity": 55000, "unitPrice": 1, "marketValue": 55000, "totalCost": 55000 },
        { "assetId": "uuid-5", "quantity": 61.9799, "unitPrice": 490.8873, "marketValue": 30425.13, "totalCost": 30000 },
        { "assetId": "uuid-6", "quantity": 0.1079, "unitPrice": 572585.2491, "marketValue": 61782.00, "totalCost": 51000 },
        { "assetId": "uuid-7", "quantity": 20060, "unitPrice": 1, "marketValue": 20060, "totalCost": 20000 }
      ]
    }
  ],
  "message": "Statement history retrieved successfully"
}
```

### 3.4 获取前一报表

**请求**
```
GET /api/statements/previous/{date}
```

**预期返回值** (GET /api/statements/previous/2024-03-31)
```json
{
  "success": true,
  "data": {
    "id": "stmt-2",
    "date": "2024-02-29",
    "note": "# 2024-02 投资笔记...",
    "totalValue": 226500.00,
    "totalInvested": 236000
    // ... 完整报表详情
  },
  "message": "Previous statement retrieved"
}
```

### 3.5 获取报表详情（按ID）

**请求**
```
GET /api/statements/{id}
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 报表ID |
| date | string | 日期 |
| note | string | 笔记 |
| totalValue | number | 总资产市值 |
| totalInvested | number | 累计投入 |
| assets | array | 持仓资产列表 |
| assets[].name | string | 资产名称 |
| assets[].category | string | 资产类型 |
| assets[].quantity | number | 持仓数量 |
| assets[].unitPrice | number | 单价 |
| assets[].marketValue | number | 市值 |
| assets[].totalCost | number | 成本 |
| assets[].addedQuantity | number | 当月变动数量 |
| assets[].addedPrincipal | number | 当月变动成本 |

### 3.6 获取报表详情（按日期）

**请求**
```
GET /api/statements/details-by-date?date=2024-06-30
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "id": "stmt-6",
    "date": "2024-06-30",
    "note": "# 2024-06 投资笔记...",
    "totalValue": 283215.40,
    "totalInvested": 275000,
    "assets": [
      {
        "id": "pos-uuid-1",
        "assetId": "uuid-3",
        "name": "腾讯控股",
        "category": "security",
        "unitPrice": 367.4824,
        "quantity": 205.6434,
        "marketValue": 75572.75,
        "totalCost": 58000,
        "addedQuantity": 0,
        "addedPrincipal": 0,
        "note": ""
      }
      // ... 其他6个资产
    ]
  },
  "message": "Statement details retrieved"
}
```

### 3.7 创建或更新报表

**请求**
```
POST /api/statements
Content-Type: application/json

{
  "date": "2024-07-31",
  "note": "7月投资笔记",
  "assets": [
    {
      "assetId": "uuid-1",
      "unitPrice": 3.5,
      "addedQuantity": 100,
      "addedPrincipal": 350
    }
  ]
}
```

### 3.8 重新计算缓存

**请求**
```
POST /api/statements/recalculate
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "success": true,
    "count": 0,
    "message": "Cache cleared"
  },
  "message": "Cache recalculated successfully"
}
```

---

## 4. Dashboard API

仪表盘数据接口，提供可视化图表所需数据。

### 4.1 获取完整概览

**请求**
```
GET /api/dashboard/overview?viewMode=strategy&timeRange=all
GET /api/dashboard/overview?viewMode=total&timeRange=ytd
GET /api/dashboard/overview?viewMode=strategy&layerId={layerId}
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| viewMode | string | strategy/total |
| timeRange | string | all/ytd/1y |
| layerId | string | 筛选特定层级 |
| startDate | string | 自定义开始日期 YYYY-MM |

**预期返回值** (基于2024-06数据)
```json
{
  "success": true,
  "data": {
    "metrics": {
      "endValue": 283215.40,
      "endInvested": 275000,
      "startValue": 0,
      "startInvested": 0,
      "profit": 8215.40,
      "returnRate": 2.99,
      "periodLabel": "历史累计"
    },
    "allocation": [
      {
        "id": "layer-2",
        "name": "第二层：进取成长",
        "value": 197769.78,
        "percent": 69.8,
        "targetPercent": 60,
        "color": "#f59e0b",
        "deviation": 9.8,
        "isLayer": true
      },
      {
        "id": "layer-1",
        "name": "第一层：稳健底仓",
        "value": 85485.13,
        "percent": 30.2,
        "targetPercent": 40,
        "color": "#3b82f6",
        "deviation": -9.8,
        "isLayer": true
      }
    ],
    "trend": [
      { "date": "2024-01-31", "value": 225000.00, "invested": 234000 },
      { "date": "2024-02-29", "value": 226500.00, "invested": 236000 },
      { "date": "2024-03-31", "value": 228000.00, "invested": 236000 },
      { "date": "2024-04-30", "value": 230000.00, "invested": 238000 },
      { "date": "2024-05-31", "value": 270000.00, "invested": 251000 },
      { "date": "2024-06-30", "value": 283215.40, "invested": 275000 }
    ]
  },
  "message": "Dashboard overview retrieved successfully"
}
```

### 4.2 获取关键指标

**请求**
```
GET /api/dashboard/metrics?viewMode=strategy&timeRange=all
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "endValue": 283215.40,
    "endInvested": 275000,
    "startValue": 0,
    "startInvested": 0,
    "profit": 8215.40,
    "returnRate": 2.99,
    "periodLabel": "历史累计"
  },
  "message": "Dashboard metrics retrieved successfully"
}
```

### 4.3 获取资产配置

**请求**
```
GET /api/dashboard/allocation?viewMode=total
GET /api/dashboard/allocation?viewMode=strategy
GET /api/dashboard/allocation?viewMode=strategy&layerId=layer-1
```

**viewMode=total 预期返回值**
```json
{
  "success": true,
  "data": [
    {
      "name": "股票基金",
      "value": 136989.78,
      "percent": 48.4,
      "color": "#3b82f6"
    },
    {
      "name": "现金固收",
      "value": 75060.00,
      "percent": 26.5,
      "color": "#64748b"
    },
    {
      "name": "商品另类",
      "value": 92165.62,
      "percent": 32.5,
      "color": "#f59e0b"
    }
  ],
  "message": "Allocation data retrieved successfully"
}
```

**viewMode=strategy 预期返回值**
```json
{
  "success": true,
  "data": [
    {
      "id": "layer-2",
      "name": "第二层：进取成长",
      "value": 197769.78,
      "percent": 69.8,
      "targetPercent": 60,
      "color": "#f59e0b",
      "deviation": 9.8,
      "isLayer": true
    },
    {
      "id": "layer-1",
      "name": "第一层：稳健底仓",
      "value": 85445.62,
      "percent": 30.2,
      "targetPercent": 40,
      "color": "#3b82f6",
      "deviation": -9.8,
      "isLayer": true
    }
  ],
  "message": "Allocation data retrieved successfully"
}
```

### 4.4 获取趋势数据

**请求**
```
GET /api/dashboard/trend?viewMode=strategy&startDate=2024-01
```

**预期返回值**
```json
{
  "success": true,
  "data": [
    { "date": "2024-01-31", "value": 225000.00, "invested": 234000 },
    { "date": "2024-02-29", "value": 226500.00, "invested": 236000 },
    { "date": "2024-03-31", "value": 228000.00, "invested": 236000 },
    { "date": "2024-04-30", "value": 230000.00, "invested": 238000 },
    { "date": "2024-05-31", "value": 270000.00, "invested": 251000 },
    { "date": "2024-06-30", "value": 283215.40, "invested": 275000 }
  ],
  "message": "Trend data retrieved successfully"
}
```

### 4.5 获取收益归因

**请求**
```
GET /api/dashboard/breakdown?viewMode=strategy&timeRange=all
```

**响应参数**
| 字段 | 类型 | 说明 |
|------|------|------|
| items | array | 分项数据 |
| items[].name | string | 名称 |
| items[].endVal | number | 期末市值 |
| items[].endCost | number | 期末成本 |
| items[].changeVal | number | 市值变动 |
| items[].changeInput | number | 投入变动 |
| items[].profit | number | 利润 |
| items[].roi | number | 收益率(%) |
| totals | object | 汇总数据 |

**预期返回值**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "layer-2",
        "name": "第二层：进取成长",
        "color": "#f59e0b",
        "endVal": 197769.78,
        "endCost": 172000,
        "changeVal": 197769.78,
        "changeInput": 172000,
        "profit": 25769.78,
        "roi": 14.98
      },
      {
        "id": "layer-1",
        "name": "第一层：稳健底仓",
        "color": "#3b82f6",
        "endVal": 85445.62,
        "endCost": 103000,
        "changeVal": 85445.62,
        "changeInput": 103000,
        "profit": -17554.38,
        "roi": -17.04
      }
    ],
    "totals": {
      "endVal": 283215.40,
      "endCost": 275000,
      "changeVal": 283215.40,
      "changeInput": 275000,
      "profit": 8215.40,
      "roi": 2.99
    }
  },
  "message": "Breakdown data retrieved successfully"
}
```

---

## 5. Export API

数据导出导入接口。

### 5.1 导出备份

**请求**
```
GET /api/export/backup
```

**响应**
- Content-Type: application/json
- Content-Disposition: attachment; filename="invest_track_backup_2026-02-12.json"

**返回文件格式** (同example.json)
```json
{
  "_meta": {
    "version": "2.0",
    "exportedAt": "2026-02-12T00:00:00.000Z",
    "type": "invest_track_backup"
  },
  "assets": [...],
  "strategies": [...],
  "monthlyStatements": [...]
}
```

### 5.2 导入备份

**请求**
```
POST /api/export/restore
Content-Type: application/json

{
  "_meta": { "version": "2.0", ... },
  "assets": [...],
  "strategies": [...],
  "monthlyStatements": [...]
}
```

**预期返回值**
```json
{
  "success": true,
  "imported": {
    "assets": 7,
    "strategies": 1,
    "statements": 6
  }
}
```

---

## 6. Prices API

价格同步接口。

### 6.1 获取金价

**请求**
```
GET /api/prices/gold
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "price": 490.8873,
    "date": "2024-06-30",
    "source": "manual"
  },
  "message": "Gold price retrieved"
}
```

### 6.2 同步金价

**请求**
```
POST /api/prices/sync
```

### 6.3 同步股价

**请求**
```
POST /api/prices/sync/stocks
```

### 6.4 同步所有价格

**请求**
```
POST /api/prices/sync/all
```

### 6.5 获取同步状态

**请求**
```
GET /api/prices/status
```

**预期返回值**
```json
{
  "success": true,
  "data": {
    "gold": {
      "price": 490.8873,
      "date": "2024-06-30",
      "source": "manual"
    },
    "today": "2026-02-12"
  },
  "message": "Price sync status"
}
```

---

## 附录A: 数据汇总

### 样例数据统计

| 项目 | 数量 |
|------|------|
| 资产总数 | 7 |
| 策略数量 | 1 |
| 月度报表 | 6个月 (2024-01 至 2024-06) |
| 交易记录 | 17笔 |

### 最终持仓状态 (2024-06)

| 资产 | 持仓数量 | 总成本 | 市值 | 盈亏 | 收益率 |
|------|----------|--------|------|------|--------|
| 备用金(余额宝) | 20,060 | 20,000 | 20,060 | +60 | 0.30% |
| Bitcoin | 0.1079 | 49,000 | 61,782 | +12,782 | 26.09% |
| 实物黄金 | 61.9056 | 30,000 | 30,386 | +386 | 1.29% |
| 招商银行理财 | 55,000 | 55,000 | 55,000 | 0 | 0.00% |
| 腾讯控股 | 205.6434 | 58,000 | 75,573 | +17,573 | 30.30% |
| 纳指100ETF | 21,724.1379 | 26,000 | 25,200 | -800 | -3.08% |
| 沪深300ETF | 10,582.6317 | 37,000 | 35,217 | -1,783 | -4.82% |
| **合计** | - | **275,000** | **283,218** | **+8,218** | **2.99%** |

### 策略配置

**2024 全球配置策略 (模拟)**
- 第一层：稳健底仓 (40%)
  - 招商银行理财: 20%
  - 备用金(余额宝): 10%
  - 实物黄金: 10%
- 第二层：进取成长 (60%)
  - 沪深300ETF: 20%
  - 纳指100ETF: 20%
  - 腾讯控股: 10%
  - Bitcoin: 10%

---

## 附录B: 类型定义

详见 `shared/types.ts`

```typescript
// 主要类型
interface Asset {
  id: string;
  type: AssetCategory;
  name: string;
  ticker?: string;
  note?: string;
}

interface StrategyVersion {
  id: string;
  name: string;
  description: string;
  startDate: string;
  status: 'active' | 'archived';
  layers: StrategyLayer[];
}

interface Position {
  id: string;
  assetId: string;
  name: string;
  category: AssetCategory;
  unitPrice: number;
  quantity: number;
  marketValue: number;
  totalCost: number;
  addedQuantity: number;
  addedPrincipal: number;
  note?: string;
}

interface MonthlyStatement {
  id: string;
  date: string;
  note?: string;
}
```

---

*文档生成时间: 2026-02-12*  
*数据基准: example.json (2024-06-30)*
