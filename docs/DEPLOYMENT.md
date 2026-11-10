# 币安Alpha监控系统 - 部署说明

## 项目介绍
币安Alpha监控系统，用于监控币安Alpha平台币种上线及合约上线情况。

## 技术栈
- **前端**: React 18 + TypeScript + Material-UI + Zustand
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL 16
- **缓存/消息队列**: Redis 7
- **容器化**: Docker + Docker Compose

## 系统要求
- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 快速开始

### 1. 解压项目
```bash
unzip 3.zip
cd binance-alpha
```

### 2. 安装依赖

#### 后端依赖
```bash
cd backend
npm install
```

#### 前端依赖
```bash
cd ../frontend
npm install
```

### 3. 构建项目

#### 编译后端
```bash
cd backend
npm run build
```

#### 构建前端
```bash
cd ../frontend
npm run build
```

### 4. 启动服务

回到项目根目录，使用 Docker Compose 启动所有服务：

```bash
cd ..
docker-compose up -d
```

等待服务启动完成（约30秒）。

### 5. 验证服务

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:3001
- **健康检查**: http://localhost:3001/api/health

## 端口说明

- **3000**: 前端 Web 界面
- **3001**: 后端 API 服务
- **5433**: PostgreSQL 数据库（内部端口5432）
- **6380**: Redis 服务（内部端口6379）

## 数据库配置

默认配置：
- **数据库名**: binance_alpha
- **用户名**: postgres
- **密码**: postgres123
- **主机**: localhost
- **端口**: 5433

数据库 Schema 会在首次启动时自动初始化。

## 查看日志

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
docker-compose logs redis

# 实时查看日志
docker-compose logs -f backend
```

## 停止服务

```bash
docker-compose down
```

保留数据卷：
```bash
docker-compose down
```

完全清理（包括数据）：
```bash
docker-compose down -v
```

## 重新构建服务

如果修改了代码，需要重新构建：

```bash
# 重新构建所有服务
docker-compose build

# 重新构建并启动
docker-compose up -d --build

# 只重新构建特定服务
docker-compose build backend
docker-compose build frontend
```

## 数据持久化

以下数据会持久化到 Docker volumes：
- PostgreSQL 数据: `binance-alpha_postgres_data`
- Redis 数据: `binance-alpha_redis_data`
- 应用日志: `./logs`

## 架构特点

### 1. 数据库架构
- **coins**: 币对基础信息
- **price_history**: 价格历史时序数据
- **futures_data**: 合约数据
- **notifications**: 通知历史
- **collection_logs**: 数据采集日志

### 2. 实时推送
- WebSocket 连接实时推送数据更新
- Redis Pub/Sub 实现消息队列
- 支持新币种上线、合约上线实时通知

### 3. 缓存策略
- 币对列表缓存: 60秒
- 统计数据缓存: 300秒
- 使用 Redis 提升响应速度

### 4. 定时任务
- 每1分钟自动采集数据
- 自动检测新币种和新合约

## 常见问题

### 1. 端口被占用
如果端口冲突，修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "3000:80"  # 修改左侧端口号
```

### 2. 数据库连接失败
检查 PostgreSQL 容器是否健康运行：
```bash
docker ps | grep postgres
docker logs binance-alpha-postgres
```

### 3. 前端无法连接后端
确保后端服务正常运行：
```bash
curl http://localhost:3001/api/health
```

### 4. 内存不足
调整 Docker 资源限制，或减少数据采集频率。

## 开发模式

### 后端开发
```bash
cd backend
npm run dev  # 使用 nodemon 热重载
```

### 前端开发
```bash
cd frontend
npm start  # React 开发服务器
```

## 生产环境建议

1. **修改默认密码**: 修改 `docker-compose.yml` 中的数据库密码
2. **配置 HTTPS**: 使用 Nginx 反向代理并配置 SSL 证书
3. **监控告警**: 集成日志监控和告警系统
4. **定期备份**: 定期备份 PostgreSQL 数据库
5. **资源限制**: 在 `docker-compose.yml` 中设置资源限制

## 更新日志

### v2.0.0 (2025-10-27)
- ✅ 迁移到 PostgreSQL + Redis 架构
- ✅ 实现消息队列和缓存机制
- ✅ 优化 UI 显示（压缩 StatsCards 和 FilterPanel）
- ✅ 添加数据库服务层和消息队列服务
- ✅ 实时数据推送优化

### v1.0.0 (2025-10-24)
- ✅ 基础功能实现
- ✅ 文件系统存储
- ✅ WebSocket 实时推送

## 技术支持

如有问题，请查看项目文档：
- README.md: 项目基本信息
- OPTIMIZATION_RECOMMENDATIONS.md: 性能优化建议
- MARKET_CAP_FIX.md: 市值计算修复说明
- OPEN_INTEREST_FIX.md: 未平仓量修复说明
