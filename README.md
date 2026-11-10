# 币安Alpha监控系统

一个实时监控币安Alpha币对的全栈应用，提供现货和合约数据的实时展示和分析。

## 功能特性

- 🚀 实时数据监控：通过WebSocket实时推送币对价格变化
- 📊 数据可视化：清晰的表格展示和统计图表
- 🔍 智能筛选：支持按名称、价格变化、市值等多维度筛选
- 📱 响应式设计：适配桌面和移动设备
- 🔄 自动刷新：定时采集最新数据
- 📈 合约监控：同时监控现货和合约市场
- 🎯 Alpha发现：自动识别新上线的潜力币对

## 技术栈

### 后端
- Node.js + TypeScript
- Express.js (REST API)
- WebSocket (实时通信)
- Axios (HTTP客户端)
- Node-cron (定时任务)

### 前端
- React 18 + TypeScript
- Material-UI (组件库)
- Zustand (状态管理)
- Recharts (图表库)
- React Query (数据获取)

### 部署
- Docker + Docker Compose
- Nginx (反向代理)
- 支持SSL/HTTPS

## 快速开始

### 开发环境

1. 克隆项目
```bash
git clone <repository-url>
cd binance-alpha-monitor
```

2. 安装后端依赖
```bash
cd backend
npm install
```

3. 安装前端依赖
```bash
cd ../frontend
npm install
```

4. 启动后端服务
```bash
cd ../backend
npm run dev
```

5. 启动前端服务
```bash
cd ../frontend
npm start
```

访问 http://localhost:3000 查看应用

### 生产部署

使用Docker Compose一键部署（先复制 `.env.example` 为 `.env` 并填写 `POSTGRES_PASSWORD` 等变量）：

```bash
cp .env.example .env
docker-compose up -d
```

服务将在以下端口启动：
- 前端：http://localhost:3000
- 后端API：http://localhost:3001
- Nginx代理：http://localhost:80

## API文档

### 获取币对列表
```
GET /api/coins?search=&sort=priceChangePercent&order=desc&page=1&limit=50
```

### 获取币对详情
```
GET /api/coins/:symbol
```

### 获取统计数据
```
GET /api/stats
```

### 获取价格历史
```
GET /api/coins/:symbol/history?period=24h
```

### 健康检查
```
GET /api/health
```

## WebSocket事件

### 连接
```javascript
const ws = new WebSocket('ws://localhost:3001');
```

### 消息类型
- `initial_data`: 初始数据
- `data_update`: 数据更新
- `new_coin`: 新币对上线
- `new_futures`: 新合约上线
- `error`: 错误信息
- `pong`: 心跳响应

## 项目结构

```
binance-alpha-monitor/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── services/       # 业务服务
│   │   ├── routes/         # API路由
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 类型定义
│   ├── Dockerfile
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── services/       # API服务
│   │   ├── stores/         # 状态管理
│   │   ├── types/          # 类型定义
│   │   └── utils/          # 工具函数
│   ├── Dockerfile
│   └── package.json
├── docs/                   # 部署指南与历史修复记录
├── scripts/                # 数据校验/清理脚本、前端部署脚本
├── Dockerfile              # Railway 后端部署镜像
├── docker-compose.yml      # Docker编排
└── README.md
```

## 配置说明

### 环境变量

后端环境变量（完整示例见 `backend/.env.example`）：
- `NODE_ENV`: 运行环境 (development/production)
- `PORT`: 服务端口 (默认3001)
- `DATABASE_URL` 或 `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`: PostgreSQL 连接
- `REDIS_URL` 或 `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`: Redis 连接
- `CORS_ORIGINS`: 允许的前端域名，逗号分隔
- `ADMIN_TOKEN`: 管理接口（清理、数据库统计）令牌，不配置则这些接口关闭
- `TRUST_PROXY`: 反向代理信任设置，影响按 IP 限流

前端环境变量：
- `REACT_APP_API_URL`: 后端API地址

### 数据采集

系统每5分钟自动采集一次数据，包括：
- 币安现货市场所有交易对
- 币安合约市场信息
- 价格变化统计
- 成交量数据

## 监控指标

- 总币对数量
- 24小时涨幅超过10%的币对数量
- 新上线币对数量
- 合约可用币对数量
- 系统连接状态

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 免责声明

本项目仅用于教育和研究目的。使用本系统进行交易决策的风险由用户自行承担。作者不对任何投资损失负责。

## 联系方式

如有问题或建议，请提交 Issue 或联系项目维护者。