# WebSocket连接问题修复

## 问题描述
前端提示"初始化失败，请刷新页面重试"，原因是WebSocket连接失败。

## 问题原因
前端直接连接 `ws://localhost:3001`，但在Docker环境中：
1. 前端运行在端口3000（nginx容器）
2. 后端运行在端口3001（Node.js容器）
3. 前端应该通过nginx代理连接后端WebSocket

## 修复方案

### 1. 修改WebSocket连接地址
**文件**: `frontend/src/services/websocket.ts`

**修改前**:
```typescript
this.url = url || `ws://${window.location.hostname}:3001`;
```

**修改后**:
```typescript
// 使用当前页面的协议和主机名，通过nginx代理WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
this.url = url || `${protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/ws`;
```

### 2. Nginx配置（已正确）
**文件**: `frontend/nginx.conf`

```nginx
# WebSocket代理
location /ws {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 连接流程

```
浏览器 (ws://localhost:3000/ws)
    ↓
前端 Nginx (端口3000)
    ↓
Docker内部网络
    ↓
后端 Node.js + WebSocket (端口3001)
```

## 测试方法

1. **检查服务状态**:
```bash
docker-compose ps
```

2. **测试后端API**:
```bash
curl http://localhost:3001/api/health
```

3. **测试前端页面**:
打开浏览器访问 http://localhost:3000

4. **检查WebSocket连接**:
打开浏览器开发者工具 -> Network -> WS，查看WebSocket连接状态

## 预期结果

- ✅ 前端能成功连接WebSocket
- ✅ 实时接收数据更新
- ✅ 不再显示"初始化失败"错误

## 已完成

- ✅ 修改WebSocket连接地址
- ✅ 重新构建前端镜像
- ✅ 重启前端容器

## 注意事项

1. WebSocket通过nginx代理，支持自动重连
2. 如果仍有问题，检查浏览器控制台和网络面板
3. 确保防火墙没有阻止3000和3001端口

