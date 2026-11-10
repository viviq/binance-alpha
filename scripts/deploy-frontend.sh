#!/bin/bash

# 前端部署脚本 - Vercel

echo "🚀 开始部署前端到 Vercel..."
echo ""

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "正在安装 Vercel CLI..."
    npm install -g vercel
fi

# 检查环境变量
echo "📋 请输入后端 URL（例如：https://your-backend.railway.app）"
read -p "后端 URL: " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ 后端 URL 不能为空"
    exit 1
fi

# 进入前端目录
cd frontend || exit 1

# 创建 .env.production 文件
echo "📝 创建环境变量文件..."
cat > .env.production << EOF
REACT_APP_API_URL=${BACKEND_URL}/api
REACT_APP_WS_URL=${BACKEND_URL/http/ws}/ws
EOF

echo "✅ 环境变量已配置："
cat .env.production
echo ""

# 部署到 Vercel
echo "🚀 开始部署..."
vercel --prod

echo ""
echo "✅ 部署完成！"
echo ""
echo "📌 下一步："
echo "1. 复制 Vercel 提供的部署 URL"
echo "2. 在 Railway 后端配置 CORS_ORIGINS 环境变量"
echo "3. 添加你的 Vercel URL 到 CORS_ORIGINS"
echo ""
