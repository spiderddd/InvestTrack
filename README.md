
# InvestTrack - 个人投资策略追踪系统 (NAS Edition)

**InvestTrack** 是一个基于“策略驱动”和“月度快照”方法论的个人资产管理工具。

与传统的记账软件不同，它不关注每一笔琐碎的交易流水，而是关注**每个月月底的资产状态**以及**实际持仓与目标策略的偏差**。

本项目采用 **React + Node.js (Express) + SQLite** 全栈架构，专为部署在家庭 NAS（如群晖、威联通）或个人服务器设计，数据存储于本地 SQLite 数据库中，安全可控，隐私无忧。

---

## ✨ 核心功能

1.  **📊 仪表盘 (Dashboard)**
    *   可视化展示资产分布、历史净值曲线、累计投入与盈亏。
    *   自动计算当前持仓与目标策略的偏离度。
    *   **区间分析**: 支持查看“今年以来(YTD)”或“近一年”的**区间盈利**，而非仅仅是历史总盈利。

2.  **⚖️ 策略管理 (Strategy IPS)**
    *   定义您的投资“宪法”。
    *   创建不同版本的投资组合策略（如：2024 激进版）。
    *   支持 Markdown 编写投资策略说明书 (IPS)，记录策略变更思路。

3.  **🗃️ 资产库管理 (Asset Library)**
    *   统一管理所有投资标的（股票、基金、黄金、加密货币、定存等）。
    *   **分组视图**: 支持按“资产类别”或“策略层级”分组查看。
    *   **时光机模式**: 回溯查看历史上某个月底的具体持仓列表。

4.  **📸 月度快照 (Snapshots)**
    *   **核心逻辑**: 每月只需记录一次资产状态。
    *   **统一流水制**: 无论是买卖股票还是存取款，均通过“变动量”和“净投入”来记录，准确计算成本。
    *   **投资笔记**: 支持 Markdown 格式记录每月的投资思考与复盘，支持折叠查看。

---

## 🐳 Docker 部署指南 (推荐)

该镜像采用多阶段构建 (Multi-stage Build)，同时包含了前端静态资源和后端 API 服务，镜像体积小巧。

### 1. 构建镜像

由于 Dockerfile 命名为 `Dockerfile.md`，构建时需指定文件名：

```bash
docker build -f Dockerfile.md -t invest-track .
```

### 2. 运行容器

运行以下命令启动服务，并将数据持久化保存到宿主机的 `./data` 文件夹中。

```bash
docker run -d \
  --name invest-track \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  invest-track
```

*   **访问地址**: 打开浏览器访问 `http://localhost:3001`
*   **数据持久化**: 所有的数据库文件 (`invest_track_v2.db`) 将会保存在宿主机的 `data/` 目录中，删除容器不会丢失数据。

### 3. NAS 部署 (群晖/威联通)

1.  **文件准备**: 将项目代码上传到 NAS。
2.  **构建**: 使用上述命令构建镜像，或者在 NAS 的 Docker 管理器中指定 Dockerfile 路径。
3.  **挂载**: 务必将容器内的 `/app/data` 路径映射到 NAS 的本地文件夹，以确保数据库文件安全。

---

## 🛠️ 数据维护 (Data Maintenance)

项目根目录下提供了两个实用脚本，用于数据初始化和迁移。

### 1. 生成测试数据 (Seeding)
如果您是第一次使用，想快速体验系统功能，可以生成一套包含策略、资产和半年历史账本的模拟数据。

```bash
# 确保 Server 正在运行 (localhost:3001)
node seed_data.js
```

### 2. 导入旧版/备份数据 (Import)
如果您有符合格式的 JSON 数据备份（`data_export.json`），可以使用此脚本将其恢复到 SQLite 数据库中。

```bash
# 1. 将备份文件重命名为 data_export.json 放在根目录
# 2. 运行导入脚本 (会清空现有数据库，请谨慎操作)
node import_data.js
```

---

## 📖 核心设计理念

InvestTrack 采用 **“月度快照 (Monthly Snapshot)”** 与 **“策略驱动 (Strategy Driven)”** 的核心方法论。

### 统一流水制 (Unified Flow)
为了准确计算所有资产的“成本”与“盈亏”，本系统摒弃了单纯修改总数的快照逻辑，转而采用统一的流水记录。

| 资产类型 | 本月变动 (Quantity Change) | 本月流水 (Cost Change) | 逻辑说明 |
| :--- | :--- | :--- | :--- |
| **波动资产**<br>(股票/基金) | **份额变化**<br>(买入为正，卖出为负) | **资金进出**<br>(买入投入本金，卖出收回本金) | 计算持仓成本 |
| **稳健资产**<br>(存款/理财) | **金额变化**<br>(总金额的增减) | **本金进出**<br>(存入为正，取出为负) | 差额即为利息收益 |

*   **期末持有量** = `期初持有` + `本期变动`
*   **期末总成本** = `期初成本` + `本期流水`

---

## 📂 目录结构

```text
.
├── components/        # React 前端组件
│   ├── dashboard/     # 仪表盘相关组件
│   ├── snapshots/     # 记账表单与列表
│   └── ...
├── server/            # Node.js 后端服务
│   ├── routes/        # API 路由 (Restful)
│   ├── services/      # 业务逻辑层
│   └── db.js          # SQLite 数据库连接与初始化
├── contexts/          # React Context (全局状态)
├── hooks/             # 自定义 React Hooks
├── services/          # 前端 API 调用封装
├── Dockerfile.md      # Docker 构建文件
├── seed_data.js       # 测试数据生成脚本
├── import_data.js     # 数据导入脚本
└── server.js          # 后端入口文件
```

---

## 🚀 本地开发指南

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发环境
你需要同时启动后端服务和前端构建工具。

**终端 1 (后端):**
```bash
node server.js
```
*   服务启动在 `http://localhost:3001`，会自动在 `data/` 目录创建数据库。

**终端 2 (前端):**
```bash
npm run dev
```
*   Vite 开发服务器启动，自动代理 API 请求到后端。

---

## 🛠 技术栈

*   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
*   **Backend**: Node.js (Express), SQLite3 (with WAL mode)
*   **Runtime**: Node.js v20+ / Docker (Alpine)
