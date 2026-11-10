import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';

// 从请求头取出管理令牌：支持 `Authorization: Bearer <token>` 或 `X-Admin-Token: <token>`
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  const header = req.headers['x-admin-token'];
  if (typeof header === 'string' && header.length > 0) {
    return header.trim();
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// 管理接口鉴权：未配置 ADMIN_TOKEN 时接口直接关闭
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    res.status(503).json({
      success: false,
      error: '管理接口未启用（未配置 ADMIN_TOKEN）',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const token = extractToken(req);
  if (!token || !safeEqual(token, expected)) {
    logger.warn(`管理接口鉴权失败: ${req.method} ${req.originalUrl} - ${req.ip}`);
    res.status(401).json({
      success: false,
      error: '未授权',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}
