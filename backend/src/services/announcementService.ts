import axios from 'axios';
import { logger } from '../utils/logger';

export interface BinanceAnnouncement {
  id: number;
  code: string;
  title: string;
  releaseDate?: number;
}

export interface ParsedFuturesAnnouncement {
  symbol: string;
  name?: string;
  announcementId: string;
  announcementTitle: string;
  announcementUrl: string;
  expectedListingDate?: Date;
}

export class AnnouncementService {
  private readonly API_BASE = 'https://www.binance.com/bapi/composite/v1/public/cms/article';
  private readonly ANNOUNCEMENT_BASE = 'https://www.binance.com/en/support/announcement';

  /**
   * 获取币安公告列表
   */
  async getAnnouncements(catalogId: number = 48, pageSize: number = 50): Promise<BinanceAnnouncement[]> {
    try {
      const response = await axios.get(`${this.API_BASE}/catalog/list/query`, {
        params: {
          catalogId,
          pageNo: 1,
          pageSize,
        },
        headers: {
          'Accept-Encoding': 'identity',
        },
      });

      if (response.data?.code === '000000' && response.data?.data?.articles) {
        return response.data.data.articles;
      }

      return [];
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error('获取币安公告失败:', error.message);
      }
      return [];
    }
  }

  /**
   * 解析合约上线公告
   * 匹配格式：
   * - "XXX (SYMBOL) Will Be Available on ... Binance Futures (YYYY-MM-DD)"
   * - "Binance Futures Will Launch USDⓈ-Margined SYMBOLUSDT Perpetual Contract"
   * - "Binance Futures Will Launch ... SYMBOL ..."
   */
  parseFuturesAnnouncement(announcement: BinanceAnnouncement): ParsedFuturesAnnouncement | null {
    const { title, code, id } = announcement;

    // 只处理包含 "Binance Futures" 且包含 "Launch" 或 "Available" 的公告
    if (!title.includes('Binance Futures')) {
      return null;
    }

    if (!title.includes('Launch') && !title.includes('Available') && !title.includes('Will List')) {
      return null;
    }

    let symbol: string | null = null;
    let name: string | undefined = undefined;

    // 尝试多种格式提取符号

    // 格式1: "Binance Futures Will Launch USDⓈ-Margined SYMBOLUSDT Perpetual Contract"
    const newFormatMatch = title.match(/USDⓈ-Margined\s+([A-Z0-9]+USDT)\s+Perpetual/i);
    if (newFormatMatch) {
      symbol = newFormatMatch[1];
      // 去掉 USDT 后缀作为币种符号
      const baseSymbol = symbol.replace(/USDT$/i, '');
      symbol = baseSymbol; // 存储不带USDT的符号
    }

    // 格式2: 括号中的内容 "(SYMBOL)"
    if (!symbol) {
      const symbolMatch = title.match(/\(([A-Z0-9]+)\)/);
      if (symbolMatch) {
        symbol = symbolMatch[1];
        // 提取币种名称（括号前的单词）
        const nameMatch = title.match(/([A-Za-z0-9\s\u4e00-\u9fa5]+)\s*\([A-Z0-9]+\)/);
        name = nameMatch ? nameMatch[1].trim() : undefined;
      }
    }

    // 格式3: "SYMBOLUSDT" 出现在标题中
    if (!symbol) {
      const directMatch = title.match(/\b([A-Z0-9]{2,10})USDT\b/);
      if (directMatch) {
        symbol = directMatch[1];
      }
    }

    // 如果没有匹配到符号，返回null
    if (!symbol) {
      return null;
    }

    // 提取日期和时间
    // 格式1: (YYYY-MM-DD HH:MM) - 带时间
    // 格式2: (YYYY-MM-DD) - 只有日期
    let expectedListingDate: Date | undefined;

    // 先尝试匹配带时间的格式
    const dateTimeMatch = title.match(/\((\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\)/);
    if (dateTimeMatch) {
      const [, year, month, day, hour, minute] = dateTimeMatch;
      // 币安使用东八区时间 (UTC+8)，转换为UTC时间存储
      const chinaTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
      expectedListingDate = chinaTime;
    } else {
      // 尝试只匹配日期
      const dateMatch = title.match(/\((\d{4})-(\d{2})-(\d{2})\)/g);
      if (dateMatch && dateMatch.length > 0) {
        // 取最后一个日期（通常是上线日期）
        const lastDate = dateMatch[dateMatch.length - 1].replace(/[()]/g, '');
        // 重要：将日期解析为东八区时间，而不是UTC时间
        // 这样可以避免显示时出现8小时偏差
        expectedListingDate = new Date(`${lastDate}T00:00:00+08:00`);
      }
    }

    const announcementUrl = `${this.ANNOUNCEMENT_BASE}/${code}`;

    return {
      symbol,
      name,
      announcementId: String(id),
      announcementTitle: title,
      announcementUrl,
      expectedListingDate,
    };
  }

  /**
   * 获取即将上线的合约列表
   */
  async getUpcomingFutures(): Promise<ParsedFuturesAnnouncement[]> {
    try {
      const announcements = await this.getAnnouncements(48, 50);
      const upcomingFutures: ParsedFuturesAnnouncement[] = [];

      for (const announcement of announcements) {
        const parsed = this.parseFuturesAnnouncement(announcement);
        if (parsed) {
          // 只保留未来的或最近7天内的公告
          if (parsed.expectedListingDate) {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            if (parsed.expectedListingDate >= sevenDaysAgo) {
              upcomingFutures.push(parsed);
            }
          } else {
            // 如果没有日期，保留最近的公告
            upcomingFutures.push(parsed);
          }
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.info(`解析到 ${upcomingFutures.length} 个即将上线的合约`);
      }

      return upcomingFutures;
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error('获取即将上线合约失败:', error.message);
      }
      return [];
    }
  }
}

export const announcementService = new AnnouncementService();
