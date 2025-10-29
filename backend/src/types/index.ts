// 币对数据类型定义
export interface CoinData {
  symbol: string;
  name: string;
  alpha_listing_time: string;
  current_price: number | null;
  market_cap: number | null;
  circulating_supply: number;
  total_supply?: number | null;
  fdv?: number | null;
  volume_24h: number | null;
  price_change: number | null;
  futures_data?: FuturesData;
  last_updated: string;
  is_active: boolean;
  // Alpha相关字段
  alpha_id?: string;
  chain_id?: string;
  contract_address?: string;
}

// 合约数据类型
export interface FuturesData {
  is_listed: boolean;
  listing_time?: string;
  futures_price?: number | null;
  open_interest?: number | null;
  open_interest_1h?: number | null;
  oi_to_mcap_ratio?: number | null;
  open_interest_market_cap_ratio?: number | null;
  futures_volume_24h?: number | null;
  volume_24h?: number | null;
  spot_futures_spread?: number | null;
  mark_price?: number | null;
  index_price?: number | null;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 筛选条件类型
export interface FilterOptions {
  search?: string;
  listing_date_from?: string;
  listing_date_to?: string;
  market_cap_min?: number;
  market_cap_max?: number;
  price_change_min?: number;
  price_change_max?: number;
  has_futures?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'price_update' | 'new_listing' | 'error' | 'initial_data' | 'data_update' | 'new_coin' | 'new_futures' | 'pong';
  data?: any;
  timestamp: string;
}

// 统计数据类型
export interface StatsData {
  total_coins: number;
  contracts_listed: number;
  new_today: number;
  new_this_week: number;
  avg_market_cap: number;
  total_volume_24h: number;
}

// 错误码枚举
export enum ErrorCodes {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATA_SOURCE_UNAVAILABLE = 'DATA_SOURCE_UNAVAILABLE',
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}