import * as fs from 'fs/promises';
import * as path from 'path';
import { CoinData } from '../types';

export class FileStorage {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'daily'), { recursive: true });
    } catch (error) {
      console.error('创建数据目录失败:', error);
    }
  }

  // 原子写入JSON文件
  async saveData(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    const tempPath = filePath + '.tmp';

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw error;
    }
  }

  // 读取JSON文件
  async loadData<T>(filename: string): Promise<T | null> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // 文件不存在
      }
      throw error;
    }
  }

  // 保存币对基础信息
  async saveCoins(coins: CoinData[]): Promise<void> {
    const data = {
      coins,
      last_updated: new Date().toISOString(),
      total: coins.length
    };
    await this.saveData('coins.json', data);
  }

  // 保存每日价格数据
  async saveDailyPriceData(date: string, priceData: Record<string, any>): Promise<void> {
    const data = {
      date,
      data: priceData,
      timestamp: new Date().toISOString()
    };
    await this.saveData(`daily/price_${date}.json`, data);
  }

  // 保存合约数据
  async saveFuturesData(date: string, futuresData: Record<string, any>): Promise<void> {
    const data = {
      date,
      data: futuresData,
      timestamp: new Date().toISOString()
    };
    await this.saveData(`daily/futures_${date}.json`, data);
  }

  // 获取币对列表
  async getCoins(): Promise<CoinData[]> {
    const data = await this.loadData<{ coins: CoinData[] }>('coins.json');
    return data?.coins || [];
  }

  // 获取指定日期的价格数据
  async getDailyPriceData(date: string): Promise<Record<string, any> | null> {
    const data = await this.loadData<{ data: Record<string, any> }>(`daily/price_${date}.json`);
    return data?.data || null;
  }

  // 获取指定日期的合约数据
  async getDailyFuturesData(date: string): Promise<Record<string, any> | null> {
    const data = await this.loadData<{ data: Record<string, any> }>(`daily/futures_${date}.json`);
    return data?.data || null;
  }

  // 数据验证
  validateCoinData(data: any): data is CoinData {
    const required = ['symbol', 'name', 'current_price', 'alpha_listing_time'];
    return required.every(field => data[field] !== undefined && data[field] !== null);
  }

  // 获取数据目录大小
  async getDataSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.dataDir, { recursive: true });
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.dataDir, file.toString());
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch {}
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }
}