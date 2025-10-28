# 部署选项总览

本项目支持多种部署方式，选择最适合你的方案。

---

## 🎯 推荐方案：Vercel + Railway（方案 4）

**适合**：想要稳定部署且保留完整功能

### 优势
- ✅ 完全免费（小流量）
- ✅ 保留所有功能（WebSocket、定时任务、数据库）
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 持续部署（Git push 自动更新）

### 架构
```
用户浏览器
    ↓
前端（Vercel）
    ↓
后端（Railway）
    ↓
PostgreSQL + Redis（Railway）
```

### 快速开始
```bash
# 5 分钟快速部署
查看：QUICKSTART_VERCEL.md

# 详细部署指南
查看：VERCEL_RAILWAY_DEPLOYMENT.md

# 部署检查清单
查看：DEPLOYMENT_CHECKLIST.md
```

### 费用
- **Vercel**：免费（100GB 带宽/月）
- **Railway**：免费（$5 额度/月，约 500 小时）
- **总计**：$0/月（小流量）或 $5-10/月（中等流量）

---

## 📦 其他部署方案

### 方案 1：Docker 本地部署

**适合**：本地开发或私有服务器

```bash
# 使用 Docker Compose 一键启动
docker-compose up -d

# 查看文档
DEPLOYMENT.md
```

**优势**：
- 完全控制
- 无需云服务
- 数据私有

**劣势**：
- 需要自己维护服务器
- 无全球加速

---

### 方案 2：Render（全栈）

**适合**：不想分开部署前后端

1. 访问 https://render.com
2. 创建 Web Service（后端）
3. 创建 Static Site（前端）
4. 添加 PostgreSQL 和 Redis

**优势**：
- 一站式解决方案
- 免费额度充足

**劣势**：
- 比 Vercel 稍慢
- 免费版会休眠

---

### 方案 3：Fly.io（全栈）

**适合**：需要更多控制权

```bash
# 安装 Fly CLI
curl -L https://fly.io/install.sh | sh

# 部署
flyctl launch
```

**优势**：
- 支持多区域部署
- Docker 原生支持
- 免费额度

**劣势**：
- 配置较复杂
- 需要学习 Fly 平台

---

## 🆚 方案对比

| 方案 | 难度 | 费用 | 功能完整性 | 性能 | 推荐度 |
|------|------|------|------------|------|--------|
| **Vercel + Railway** | ⭐⭐ | 免费 - $10/月 | ✅ 100% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Docker 本地 | ⭐⭐⭐ | 服务器成本 | ✅ 100% | ⭐⭐⭐ | ⭐⭐⭐ |
| Render | ⭐⭐ | 免费 - $7/月 | ✅ 100% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Fly.io | ⭐⭐⭐⭐ | 免费 - $10/月 | ✅ 100% | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 📚 部署文档索引

### 主要文档
1. **QUICKSTART_VERCEL.md** - 5 分钟快速部署（推荐）
2. **VERCEL_RAILWAY_DEPLOYMENT.md** - 完整详细指南
3. **DEPLOYMENT_CHECKLIST.md** - 部署检查清单
4. **DEPLOYMENT.md** - Docker 本地部署

### 配置文件
- `frontend/vercel.json` - Vercel 配置
- `railway.json` - Railway 配置
- `Dockerfile` - Docker 配置
- `docker-compose.yml` - Docker Compose 配置

### 环境变量示例
- `frontend/.env.example` - 前端环境变量
- `backend/.env.example` - 后端环境变量

### 辅助脚本
- `deploy-frontend.sh` - 前端部署脚本

---

## 🚀 开始部署

### 新手推荐流程

1. **阅读快速开始**
   ```bash
   cat QUICKSTART_VERCEL.md
   ```

2. **准备 GitHub 仓库**
   ```bash
   git add .
   git commit -m "准备部署"
   git push
   ```

3. **部署后端（Railway）**
   - 访问 https://railway.app
   - 跟随 QUICKSTART_VERCEL.md 步骤

4. **部署前端（Vercel）**
   - 使用 `deploy-frontend.sh` 脚本
   - 或访问 https://vercel.com

5. **验证部署**
   - 使用 DEPLOYMENT_CHECKLIST.md 检查

---

## 🆘 需要帮助？

### 常见问题
查看各部署文档的"常见问题"章节

### 检查清单
使用 `DEPLOYMENT_CHECKLIST.md` 逐项检查

### 日志调试
- Railway: Deployments → 选择部署 → View logs
- Vercel: Deployments → 选择部署 → View logs
- 浏览器: F12 → Console

---

## 💡 建议

1. **首次部署**：使用 Vercel + Railway（最简单）
2. **本地测试**：使用 Docker Compose
3. **生产环境**：根据流量选择付费方案

---

## 🎉 开始部署

选择你的方案，跟随对应文档，5-10 分钟即可完成部署！

**推荐从这里开始** → `QUICKSTART_VERCEL.md`
