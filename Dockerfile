# 后端 Dockerfile（用于 Railway 部署）
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制根目录的 package.json
COPY package*.json ./

# 复制后端代码
COPY backend ./backend

# 安装依赖（包括根目录和后端）
RUN npm install
RUN cd backend && npm install

# 编译 TypeScript
RUN cd backend && npm run build

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 启动后端服务
CMD ["node", "backend/dist/index.js"]
