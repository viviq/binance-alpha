import { pool } from './config';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('开始初始化数据库...');

    // 读取 schema.sql 文件
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 执行 SQL
    await pool.query(schema);

    logger.info('数据库初始化成功');
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
}
