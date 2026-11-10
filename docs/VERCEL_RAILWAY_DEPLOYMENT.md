# Vercel + Railway 部署指南

本指南将帮助你将币安 Alpha 监控系统部署到云端：
- **前端** → Vercel（免费，全球 CDN）
- **后端 + 数据库** → Railway（免费额度：500 小时/月）

---

## 📋 部署前准备

### 1. 注册账号
- **Vercel**: https://vercel.com/signup
  - 使用 GitHub 账号登录即可

- **Railway**: https://railway.app/
  - 使用 GitHub 账号登录
  - 免费额度：$5/月 或 500 小时

### 2. 安装命令行工具（可选）
```bash
# Vercel CLI
npm install -g vercel

# Railway CLI
npm install -g @railway/cli
```

---

## 🚀 部署步骤

## 第一部分：部署后端到 Railway

### 步骤 1：创建 Railway 项目

1. 访问 https://railway.app/new
2. 选择 **"Deploy from GitHub repo"**
3. 如果是第一次使用，授权 Railway 访问你的 GitHub
4. 选择你的项目仓库（需要先推送到 GitHub）

**或者使用空白项目：**
1. 选择 **"Empty Project"**
2. 点击 **"+ New"** → **"GitHub Repo"**
3. 连接你的仓库

### 步骤 2：添加 PostgreSQL 数据库

1. 在 Railway 项目面板中，点击 **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway 会自动创建数据库并生成连接信息
3. 数据库会自动提供 `DATABASE_URL` 环境变量

### 步骤 3：添加 Redis

1. 在 Railway 项目面板中，点击 **"+ New"** → **"Database"** → **"Redis"**
2. Railway 会自动创建 Redis 实例
3. Redis 会自动提供 `REDIS_URL` 环境变量

### 步骤 4：配置后端服务

1. 点击你的后端服务（GitHub repo）
2. 进入 **"Settings"** → **"Environment"**
3. 添加以下环境变量：

```bash
# 基本配置
NODE_ENV=production
PORT=3001

# CORS 配置（重要！部署前端后需要更新）
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app

# 数据库配置（Railway 自动提供，无需手动添加）
# DATABASE_URL=自动生成
# REDIS_URL=自动生成

# 日志级别
LOG_LEVEL=info
```

**注意**：`CORS_ORIGINS` 需要在部署前端后更新为实际的 Vercel 域名！

### 步骤 5：配置构建和启动命令

在 Railway 项目的 **"Settings"** 中：

**Build Command:**
```bash
cd backend && npm install && npm run build
```

**Start Command:**
```bash
cd backend && npm start
```

或者使用根目录的 `railway.json` 配置（已创建）。

### 步骤 6：初始化数据库

后端服务启动后，数据库表会自动创建。检查日志确认：

1. 点击 **"Deployments"** 查看部署状态
2. 点击最新的部署，查看日志
3. 确认看到 "PostgreSQL数据库连接成功" 和 "Redis连接成功"

### 步骤 7：获取后端 URL

1. 在 Railway 服务页面，点击 **"Settings"** → **"Networking"**
2. 点击 **"Generate Domain"** 生成公共域名
3. 记下这个域名，例如：`your-backend.up.railway.app`
4. 确保端口已暴露（PORT=3001）

---

## 第二部分：部署前端到 Vercel

### 步骤 1：准备前端环境变量

在 `frontend` 目录创建 `.env.production` 文件：

```bash
# 替换为你的 Railway 后端域名
REACT_APP_API_URL=https://your-backend.up.railway.app/api
REACT_APP_WS_URL=wss://your-backend.up.railway.app/ws
```

### 步骤 2：使用 Vercel CLI 部署（推荐）

```bash
# 进入前端目录
cd frontend

# 登录 Vercel
vercel login

# 部署
vercel

# 按照提示操作：
# - Set up and deploy? Yes
# - Which scope? 选择你的账号
# - Link to existing project? No
# - Project name? binance-alpha-frontend
# - In which directory is your code located? ./
# - Want to override the settings? No

# 部署到生产环境
vercel --prod
```

### 步骤 3：或使用 Vercel 网页部署

1. 访问 https://vercel.com/new
2. 选择 **"Import Git Repository"**
3. 连接你的 GitHub 仓库
4. 配置项目：
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. 添加环境变量（重要！）：
   - 点击 **"Environment Variables"**
   - 添加：
     ```
     REACT_APP_API_URL = https://your-backend.up.railway.app/api
     REACT_APP_WS_URL = wss://your-backend.up.railway.app/ws
     ```

6. 点击 **"Deploy"**

### 步骤 4：更新后端 CORS 配置

前端部署完成后，你会获得一个 Vercel 域名，例如：`your-app.vercel.app`

**返回 Railway 后端配置：**

1. 进入 Railway 后端服务
2. 打开 **"Variables"**
3. 更新 `CORS_ORIGINS` 环境变量：
   ```
   CORS_ORIGINS=https://your-app.vercel.app
   ```
4. 保存后，Railway 会自动重新部署后端

---

## ✅ 验证部署

### 1. 检查后端

访问后端健康检查接口：
```
https://your-backend.up.railway.app/api/health
```

应该返回：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "uptime": 123.45
  }
}
```

### 2. 检查前端

访问你的 Vercel 域名：
```
https://your-app.vercel.app
```

应该能看到币安 Alpha 监控界面，并且能加载数据。

### 3. 检查 WebSocket

打开浏览器开发者工具（F12），切换到 **Console** 标签，应该看到：
```
WebSocket连接已建立
```

---

## 🔧 常见问题

### 1. 前端无法连接后端

**症状**：前端显示 "网络连接失败"

**解决方案**：
- 检查 Vercel 环境变量是否正确设置
- 确认后端 CORS 配置包含前端域名
- 重新部署前端：`vercel --prod`

### 2. WebSocket 连接失败

**症状**：实时数据不更新

**解决方案**：
- 确认 `REACT_APP_WS_URL` 使用 `wss://` 协议
- 检查后端日志，确认 WebSocket 服务器已启动
- 确认 Railway 允许 WebSocket 连接（默认支持）

### 3. 数据库连接失败

**症状**：后端日志显示 "PostgreSQL连接失败"

**解决方案**：
- 确认 PostgreSQL 服务已启动
- 检查 Railway 是否自动提供了 `DATABASE_URL`
- 查看 Railway 数据库服务的健康状态

### 4. Railway 免费额度用完

**症状**：服务停止运行

**解决方案**：
- Railway 免费计划：$5/月 或 500 小时
- 升级到 Hobby 计划：$5/月起
- 优化后端减少运行时间（降低采集频率）

### 5. CORS 错误

**症状**：浏览器控制台显示 CORS 错误

**解决方案**：
```bash
# 在 Railway 后端环境变量中添加：
CORS_ORIGINS=https://your-frontend.vercel.app,https://your-frontend-git-main.vercel.app
```

注意：Vercel 的预览部署会有不同的域名，可以添加多个。

---

## 🎯 性能优化建议

### 1. 调整数据采集频率

编辑 `backend/src/app.ts`，修改定时任务：

```typescript
// 从每 1 分钟改为每 5 分钟
cron.schedule('*/5 * * * *', async () => {
  // ...
});
```

### 2. 配置 Vercel 缓存

前端已配置缓存策略，API 请求会自动缓存 15-30 秒。

### 3. 启用生产环境优化

确保后端的 `NODE_ENV=production`，这会：
- 关闭详细日志
- 启用 gzip 压缩
- 优化数据库连接池

---

## 📊 监控和日志

### Railway 日志

1. 进入 Railway 项目
2. 点击后端服务
3. 点击 **"Deployments"** → 选择部署 → 查看日志

### Vercel 日志

1. 进入 Vercel 项目
2. 点击 **"Deployments"**
3. 点击部署记录查看构建日志

---

## 🔄 更新部署

### 更新后端

```bash
# 提交代码到 GitHub
git add .
git commit -m "更新后端"
git push

# Railway 会自动检测并重新部署
```

### 更新前端

```bash
# 方法 1：自动部署（推荐）
git add .
git commit -m "更新前端"
git push
# Vercel 会自动检测并重新部署

# 方法 2：手动部署
cd frontend
vercel --prod
```

---

## 💰 费用估算

### Vercel（前端）
- ✅ **免费计划**：
  - 100 GB 带宽/月
  - 无限部署
  - 自动 HTTPS
  - 全球 CDN

### Railway（后端 + 数据库）
- ✅ **免费计划**：
  - $5 免费额度/月
  - 约 500 小时运行时间
  - 适合中小型项目

- 💰 **Hobby 计划**（$5/月起）：
  - 无限运行时间
  - 更高配置

**预计成本**：
- 小流量：完全免费（Vercel 免费 + Railway 免费额度）
- 中等流量：$5-10/月

---

## 🔐 安全建议

1. **保护敏感信息**
   - 不要在代码中硬编码密码
   - 使用环境变量管理配置

2. **限制 CORS**
   - 只允许你的前端域名访问
   - 不要使用 `*` 通配符

3. **启用 SSL**
   - Vercel 和 Railway 默认提供 HTTPS
   - WebSocket 使用 WSS 协议

4. **速率限制**
   - 后端已配置：100 请求/分钟/IP
   - 可根据需要调整

---

## 📚 额外资源

- [Vercel 文档](https://vercel.com/docs)
- [Railway 文档](https://docs.railway.app/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Redis 文档](https://redis.io/documentation)

---

## 🆘 获取帮助

如果遇到问题：

1. 检查 Railway 和 Vercel 的部署日志
2. 查看浏览器控制台错误信息
3. 确认所有环境变量正确设置
4. 参考本文档的"常见问题"部分

---

## ✨ 完成！

部署完成后，你将拥有：
- ✅ 全球加速的前端（Vercel CDN）
- ✅ 可靠的后端服务（Railway）
- ✅ 完整的数据库支持（PostgreSQL + Redis）
- ✅ 实时 WebSocket 连接
- ✅ 自动 HTTPS 加密
- ✅ 持续集成/部署（CI/CD）

享受你的云端币安 Alpha 监控系统吧！🎉
