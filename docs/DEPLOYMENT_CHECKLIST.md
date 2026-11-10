# 部署检查清单 ✅

在部署前和部署后，使用此清单确保一切配置正确。

---

## 📝 部署前检查

### 代码准备
- [ ] 代码已推送到 GitHub
- [ ] 前端代码在 `frontend/` 目录
- [ ] 后端代码在 `backend/` 目录
- [ ] 所有依赖已在 `package.json` 中声明

### 配置文件
- [ ] 已创建 `.gitignore` 文件
- [ ] 已创建 `frontend/.env.example`
- [ ] 已创建 `backend/.env.example`
- [ ] 敏感信息未提交到 Git

---

## 🚂 Railway 后端部署

### 创建服务
- [ ] 已注册 Railway 账号
- [ ] 已连接 GitHub 仓库
- [ ] 已创建 PostgreSQL 数据库
- [ ] 已创建 Redis 数据库

### 环境变量配置
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` 已设置（先设为 `http://localhost:3000`，部署前端后更新）
- [ ] `DATABASE_URL` 自动生成（确认存在）
- [ ] `REDIS_URL` 自动生成（确认存在）

### 构建和部署
- [ ] 构建命令：`cd backend && npm install && npm run build`
- [ ] 启动命令：`cd backend && npm start`
- [ ] 已生成公共域名
- [ ] 记录后端 URL：`https://______________.up.railway.app`

### 验证后端
- [ ] 访问健康检查：`https://你的域名/api/health` 返回成功
- [ ] 检查日志：确认数据库连接成功
- [ ] 检查日志：确认 Redis 连接成功
- [ ] 检查日志：确认数据采集任务启动

---

## ▲ Vercel 前端部署

### 准备前端
- [ ] 已在本地创建 `.env.production` 文件
- [ ] `REACT_APP_API_URL` 设置为 Railway 后端 URL + `/api`
- [ ] `REACT_APP_WS_URL` 设置为 Railway 后端 URL（http 改为 ws/wss）+ `/ws`

示例：
```bash
REACT_APP_API_URL=https://xxx.railway.app/api
REACT_APP_WS_URL=wss://xxx.railway.app/ws
```

### 部署配置
- [ ] 已注册 Vercel 账号
- [ ] Root Directory 设置为 `frontend`
- [ ] Framework Preset 选择 `Create React App`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `build`

### 环境变量（Vercel）
- [ ] 已添加 `REACT_APP_API_URL`
- [ ] 已添加 `REACT_APP_WS_URL`
- [ ] 环境变量应用于 Production

### 验证前端
- [ ] 访问 Vercel 域名，页面正常显示
- [ ] 记录前端 URL：`https://______________.vercel.app`

---

## 🔗 连接前后端

### 更新 Railway CORS
- [ ] 复制 Vercel 域名
- [ ] 在 Railway 后端更新 `CORS_ORIGINS` 环境变量
- [ ] 格式：`https://your-app.vercel.app`（不要末尾的斜杠）
- [ ] 保存后等待自动重新部署

### 测试连接
- [ ] 刷新 Vercel 前端页面
- [ ] 打开浏览器控制台（F12）
- [ ] 确认没有 CORS 错误
- [ ] 确认看到 "WebSocket连接已建立"
- [ ] 确认数据正常加载

---

## ✅ 功能验证

### 基本功能
- [ ] 币对列表正常显示
- [ ] 统计卡片数据正确
- [ ] 搜索功能正常
- [ ] 筛选功能正常
- [ ] 排序功能正常

### 实时功能
- [ ] WebSocket 连接成功
- [ ] 新币种上线时有通知
- [ ] 合约上线时有通知
- [ ] 数据自动更新

### 性能检查
- [ ] 首次加载时间 < 3 秒
- [ ] 页面响应流畅
- [ ] 没有明显的卡顿
- [ ] 移动端显示正常

---

## 📊 监控和日志

### Railway 日志
- [ ] 已查看部署日志，确认无错误
- [ ] 定时任务正常运行
- [ ] 数据采集成功

### Vercel 日志
- [ ] 已查看构建日志，确认无错误
- [ ] 静态资源部署成功

### 浏览器控制台
- [ ] 无 JavaScript 错误
- [ ] 无网络请求失败
- [ ] WebSocket 状态正常

---

## 🔐 安全检查

- [ ] 环境变量未硬编码在代码中
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] CORS 只允许指定的前端域名
- [ ] 数据库密码未泄露
- [ ] HTTPS/WSS 加密已启用

---

## 🎯 性能优化（可选）

- [ ] 考虑调整数据采集频率（降低成本）
- [ ] 启用 Vercel 分析（Analytics）
- [ ] 配置 Vercel 缓存策略
- [ ] 监控 Railway 使用额度

---

## 📝 文档更新

- [ ] 记录后端 URL
- [ ] 记录前端 URL
- [ ] 更新 README.md（如需要）
- [ ] 记录环境变量配置

---

## 🆘 遇到问题？

如果遇到问题，按顺序检查：

1. **检查环境变量**（最常见）
   - Railway 后端环境变量
   - Vercel 前端环境变量

2. **检查日志**
   - Railway 部署日志
   - Vercel 构建日志
   - 浏览器控制台

3. **检查 CORS**
   - 确认 Railway 的 `CORS_ORIGINS` 包含 Vercel 域名
   - 确认没有拼写错误

4. **查看文档**
   - `VERCEL_RAILWAY_DEPLOYMENT.md` - 详细部署指南
   - `QUICKSTART_VERCEL.md` - 快速开始

---

## ✨ 完成！

所有检查项都通过后，你的应用就成功部署到云端了！🎉

**后端 URL**: https://________________
**前端 URL**: https://________________

祝使用愉快！
