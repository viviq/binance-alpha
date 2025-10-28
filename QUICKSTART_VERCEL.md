# 快速部署指南 - 5 分钟上线

## 🚀 最快速度部署到云端

### 前置条件
- GitHub 账号
- 项目已推送到 GitHub

---

## 步骤 1：部署后端（Railway）⏱️ 2 分钟

1. **访问** https://railway.app/new
2. **登录** GitHub 账号
3. **选择** "Deploy from GitHub repo" → 选择你的仓库
4. **添加数据库**：
   - 点击 "+ New" → "Database" → "PostgreSQL"
   - 点击 "+ New" → "Database" → "Redis"
5. **配置环境变量**（点击后端服务 → Variables）：
   ```bash
   NODE_ENV=production
   CORS_ORIGINS=http://localhost:3000
   ```
6. **生成域名**：Settings → Networking → Generate Domain
7. **记下后端 URL**：例如 `https://xxx.up.railway.app`

---

## 步骤 2：部署前端（Vercel）⏱️ 2 分钟

### 方法 A：命令行（推荐）

```bash
cd frontend
npm install -g vercel
vercel login
vercel
```

添加环境变量（Vercel 会提示）：
```bash
REACT_APP_API_URL=https://你的Railway域名/api
REACT_APP_WS_URL=wss://你的Railway域名/ws
```

### 方法 B：网页部署

1. **访问** https://vercel.com/new
2. **导入** GitHub 仓库
3. **配置**：
   - Root Directory: `frontend`
   - Framework: Create React App
4. **添加环境变量**：
   ```
   REACT_APP_API_URL=https://你的Railway域名/api
   REACT_APP_WS_URL=wss://你的Railway域名/ws
   ```
5. **点击** Deploy

---

## 步骤 3：更新 CORS ⏱️ 1 分钟

前端部署完成后：

1. **复制** Vercel 域名（例如 `https://xxx.vercel.app`）
2. **回到 Railway** 后端 → Variables
3. **更新** `CORS_ORIGINS`：
   ```
   CORS_ORIGINS=https://你的Vercel域名
   ```
4. **保存**（自动重新部署）

---

## ✅ 完成！

访问你的 Vercel 域名，应该能看到完整的监控系统了！

---

## 🔍 验证

- **后端健康检查**：`https://你的Railway域名/api/health`
- **前端**：`https://你的Vercel域名`
- **控制台**：应该看到 "WebSocket连接已建立"

---

## ❓ 问题排查

**前端连接不上后端？**
→ 检查环境变量是否正确，重新部署前端

**WebSocket 无法连接？**
→ 确保使用 `wss://` 协议

**详细文档**：查看 `VERCEL_RAILWAY_DEPLOYMENT.md`
