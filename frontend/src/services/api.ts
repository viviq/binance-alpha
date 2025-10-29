import axios, { AxiosResponse } from 'axios';
import { CoinData, ApiResponse, PaginatedResponse, FilterOptions, StatsData } from '../types';

// 缓存管理
class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 30000) { // 默认30秒缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  clear() {
    this.cache.clear();
  }
}

// 请求去重管理
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();
  
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }
    
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

const cacheManager = new CacheManager();
const requestDeduplicator = new RequestDeduplicator();

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    console.error('API响应错误:', error);
    
    if (error.response?.status === 404) {
      throw new Error('接口不存在');
    } else if (error.response?.status === 500) {
      throw new Error('服务器内部错误');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('请求超时');
    } else if (!error.response) {
      throw new Error('网络连接失败');
    }
    
    throw error;
  }
);

// API服务类
export class ApiService {
  // 获取币对列表
  static async getCoins(filters: FilterOptions = {}): Promise<PaginatedResponse<CoinData>> {
    // 标准化缓存键：按字母顺序排序参数
    const sortedKeys = Object.keys(filters).sort();
    const cacheKey = `coins_${sortedKeys.map(k => `${k}=${filters[k as keyof FilterOptions]}`).join('&')}`;

    // 检查缓存
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      console.log('使用缓存数据:', cacheKey);
      return cached;
    }
    
    // 使用请求去重
    return requestDeduplicator.deduplicate(cacheKey, async () => {
      try {
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });

        const response = await api.get<ApiResponse<PaginatedResponse<CoinData>>>(
          `/coins?${params.toString()}`
        );

        if (!response.data.success) {
          throw new Error(response.data.error || '获取币对列表失败');
        }

        const result = response.data.data!;
        
        // 缓存结果
        cacheManager.set(cacheKey, result, 15000); // 15秒缓存
        
        return result;
      } catch (error) {
        console.error('获取币对列表失败:', error);
        throw error;
      }
    });
  }

  // 获取单个币对详情
  static async getCoinDetail(symbol: string): Promise<CoinData> {
    try {
      const response = await api.get<ApiResponse<CoinData>>(`/coins/${symbol}`);

      if (!response.data.success) {
        throw new Error(response.data.error || '获取币对详情失败');
      }

      return response.data.data!;
    } catch (error) {
      console.error('获取币对详情失败:', error);
      throw error;
    }
  }

  // 获取统计数据
  static async getStats(): Promise<StatsData> {
    const cacheKey = 'stats';
    
    // 检查缓存
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      console.log('使用缓存数据:', cacheKey);
      return cached;
    }
    
    // 使用请求去重
    return requestDeduplicator.deduplicate(cacheKey, async () => {
      try {
        const response = await api.get<ApiResponse<StatsData>>('/stats');

        if (!response.data.success) {
          throw new Error(response.data.error || '获取统计数据失败');
        }

        const result = response.data.data!;
        
        // 缓存结果
        cacheManager.set(cacheKey, result, 30000); // 30秒缓存
        
        return result;
      } catch (error) {
        console.error('获取统计数据失败:', error);
        throw error;
      }
    });
  }

  // 清除缓存的静态方法
  static clearCache() {
    cacheManager.clear();
  }

  // 获取即将上线的合约
  static async getUpcomingFutures(): Promise<any[]> {
    try {
      const response = await api.get<ApiResponse<any[]>>('/upcoming-futures');

      if (!response.data.success) {
        throw new Error(response.data.error || '获取即将上线合约失败');
      }

      return response.data.data || [];
    } catch (error) {
      console.error('获取即将上线合约失败:', error);
      return [];
    }
  }

  // 手动刷新即将上线的合约
  static async refreshUpcomingFutures(): Promise<{ count: number; data: any[] }> {
    try {
      const response = await api.post<ApiResponse<{ count: number; data: any[] }>>('/upcoming-futures/refresh');

      if (!response.data.success) {
        throw new Error(response.data.error || '刷新即将上线合约失败');
      }

      return response.data.data!;
    } catch (error) {
      console.error('刷新即将上线合约失败:', error);
      throw error;
    }
  }

  // 获取价格历史数据
  static async getPriceHistory(symbol: string, period: string = '24h'): Promise<any[]> {
    try {
      const response = await api.get<ApiResponse<any[]>>(
        `/coins/${symbol}/history?period=${period}`
      );

      if (!response.data.success) {
        throw new Error(response.data.error || '获取历史数据失败');
      }

      return response.data.data!;
    } catch (error) {
      console.error('获取历史数据失败:', error);
      throw error;
    }
  }

  // 健康检查
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get<ApiResponse<any>>('/health');
      return response.data.success;
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }
}

export default ApiService;