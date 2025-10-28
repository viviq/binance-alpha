# 构建阶段
FROM node:14-alpine as build

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 删除package-lock.json以避免版本冲突
RUN rm -f package-lock.json

# 清理npm缓存并安装依赖
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --force

# 复制源代码
COPY . .

# 设置环境变量
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV GENERATE_SOURCEMAP=false
ENV CI=false

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到nginx目录
COPY --from=build /app/build /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]