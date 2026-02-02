# InvestTrack - 个人投资策略追踪系统 (NAS Edition)

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
</p>

**InvestTrack** 是一个基于"策略驱动"和"月度快照"方法论的个人资产管理工具。

与传统的记账软件不同，它不关注每一笔琐碎的交易流水，而是关注**每个月月底的资产状态**以及**实际持仓与目标策略的偏差**。

专为部署在家庭 NAS（群晖、威联通等）或个人服务器设计，数据完全本地存储于 SQLite，安全可控，隐私无忧。

---

## ✨ 核心功能

### 📊 仪表盘 (Dashboard)
- 可视化展示资产分布饼图、历史净值曲线、累计投入与盈亏
- **策略偏离度分析**: 自动计算当前持仓与目标策略的偏差
- **区间分析**: 支持查看"今年以来(YTD)"或"近一年"的区间盈利

### ⚖️ 策略管理 (Strategy IPS)
- 创建多版本投资组合策略（如：2024 稳健版、2025 成长版）
- 支持 **Markdown 格式** 编写投资策略说明书 (IPS)
- 策略版本切换与历史回溯

### 🗃️ 资产库管理 (Asset Library)
- 统一管理所有投资标的：股票、基金、债券、黄金、加密货币、定存等
- **分组视图**: 按"资产类别"或"策略层级"分组查看
- **时光机模式**: 回溯查看历史上任意月份的持仓详情

### 📸 月度快照 (Snapshots)
- **核心逻辑**: 每月只需记录一次资产状态，告别繁琐的逐笔记账
- **统一流水制**: 无论是买卖股票还是存取款，均通过"变动量"和"净投入"记录，准确计算成本
- **投资笔记**: 支持 Markdown 格式记录每月投资复盘与思考

---

## 🚀 快速开始

### 方法一：Docker 部署（推荐）

```bash
# 1. 构建镜像
docker build -t invest-track .

# 2. 运行容器
docker run -d \
  --name invest-track \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  invest-track
```

访问 `http://localhost:3001` 即可使用。

> **数据持久化**: 数据库文件保存在宿主机的 `data/` 目录，删除容器不会丢失数据。

### 方法二：NAS 部署（群晖/威联通）

1. 上传项目代码到 NAS
2. 在 Docker 管理器中构建镜像或导入
3. 映射容器路径 `/app/data` 到 NAS 本地文件夹
4. 启动容器并访问

### 方法三：本地开发

```bash
# 安装依赖
npm install

# 终端 1: 启动后端 (http://localhost:3001)
npm start

# 终端 2: 启动前端开发服务器 (http://localhost:5173)
npm run dev
```

---

## 📖 核心设计理念

### 月度快照 (Monthly Snapshot)

InvestTrack 采用**月度快照**方法论，核心思想是：

> **只需记录每个月底的资产状态**，而非每一笔交易。

- **省时**: 每月花费 5-10 分钟记录，而非每天记账
- **清晰**: 关注资产分布和策略偏离，而非琐碎流水
- **复盘**: 每月的投资笔记帮助回顾决策质量

### 统一流水制 (Unified Flow)

为了准确计算"成本"与"盈亏"，系统采用统一的流水记录逻辑：

| 资产类型 | 变动量 (Quantity) | 流水 (Cost) | 说明 |
| :--- | :--- | :--- | :--- |
| **波动资产**<br>(股票/基金) | 份额变化<br>(买入+/卖出-) | 资金进出<br>(投入+/收回-) | 用于计算持仓成本 |
| **稳健资产**<br>(存款/理财) | 金额变化<br>(存入+/取出-) | 本金变化<br>(投入+/取出-) | 差额即为利息收益 |

**计算公式**:
- 期末持有量 = 期初持有 + 本期变动
- 期末总成本 = 期初成本 + 本期流水

---

## 📂 项目架构

```text
InvestTrack/
├── client/                    # 前端 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── dashboard/     # 仪表盘相关
│   │   │   └── snapshots/     # 记账相关
│   │   ├── contexts/          # React Context
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── services/          # API 调用封装
│   │   └── utils/             # 工具函数
│   └── index.html
├── server/                    # 后端 (Express + SQLite)
│   ├── routes/                # API 路由
│   ├── services/              # 业务逻辑
│   ├── validations/           # 数据校验
│   └── index.js
├── shared/                    # 前后端共享
│   └── types.ts               # TypeScript 类型定义
├── scripts/                   # 数据脚本
│   ├── seed_data.js           # 生成测试数据
│   └── import_data.js         # 导入历史数据
├── data/                      # 数据存储目录 (SQLite)
├── Dockerfile                 # Docker 构建
└── vite.config.ts             # Vite 配置
```

### 架构特点

- **前后端分离**: `client/` 纯前端，`server/` 纯后端，边界清晰
- **共享契约**: `shared/types.ts` 统一定义 API 类型，避免前后端不一致
- **单仓库**: 简化部署和版本管理，适合个人项目
- **本地优先**: SQLite 数据库存储，无需复杂的数据库配置

---

## 🛠️ 数据维护

### 生成测试数据

首次使用想快速体验？生成一套模拟数据：

```bash
# 确保后端已启动 (localhost:3001)
npm run seed
# 或
node scripts/seed_data.js
```

会生成：7个资产、1套策略、6个月的账本数据。

### 导出备份数据

通过 API 导出完整数据为 JSON 文件：

```bash
# 导出完整备份（包含所有市价和交易记录）
curl http://localhost:3001/api/export/backup > backup_$(date +%Y-%m-%d).json

# 导出的 JSON 格式可直接用于恢复
```

**备份文件格式：**
```json
{
  "_meta": { "version": "1.0", "exportedAt": "...", "type": "invest_track_backup" },
  "assets": [{ "type", "name", "ticker", "note" }],
  "strategies": [{ "name", "description", "startDate", "status", "layers": [{ "name", "weight", "description", "items": [{ "assetId", "targetName", "weight", "color", "note" }] }] }],
  "snapshots": {
    "snapshots": [{ "date", "note" }],
    "prices": [{ "assetId", "date", "price" }],
    "transactions": [{ "assetId", "date", "type", "quantityChange", "costChange", "note" }]
  }
}
```

### 恢复/导入数据

使用 `seed_data.js` 脚本从备份文件恢复数据：

```bash
# 从备份文件恢复数据（数据库完全清空后重新导入）
node scripts/seed_data.js backup_2024-06-01.json
```

**支持两种模式：**
| 模式 | 命令 | 说明 |
| :--- | :--- | :--- |
| **模拟数据** | `node scripts/seed_data.js` | 使用内置的7资产+6月账本数据 |
| **备份恢复** | `node scripts/seed_data.js xxx.json` | 从指定JSON文件导入数据 |

### 数据库手动备份

直接备份 `data/` 目录下的 `invest_track_v2.db` 文件即可。

---

## 📝 技术栈

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
- **Backend**: Node.js (Express), SQLite3 (WAL mode), Zod (校验)
- **DevOps**: Docker, Git

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

---

<p align="center">
  Made with ❤️ for personal finance management
</p>
