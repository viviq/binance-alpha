import React from 'react';

// 币对数据接口
export interface CoinData {
  symbol: string;
  name: string;
  alpha_listing_time: string;
  current_price: number;
  price_change: number;
  volume_24h: number;
  market_cap: number;
  futures_data?: FuturesData;
  last_updated: string;
  // ALPHA币种相关字段
  alpha_id?: string;
  chain_id?: string;
  contract_address?: string;
}

// 合约数据接口
export interface FuturesData {
  is_listed: boolean;
  listing_time?: string;
  base_asset: string;
  quote_asset: string;
  price_precision: number;
  quantity_precision: number;
  // 新增合约相关字段
  futures_price?: number;           // 合约价格
  open_interest?: number;           // 未平仓量
  open_interest_1h?: number;        // 1小时未平仓量
  open_interest_market_cap_ratio?: number; // 未平仓/市值比率
  volume_24h?: number;              // 24小时合约成交量
  funding_rate?: number;
  mark_price?: number;
  index_price?: number;
}

// API响应接口
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// 分页响应接口
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 筛选选项接口
export interface FilterOptions {
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  has_futures?: boolean;
  market_cap_min?: number;
  market_cap_max?: number;
  price_change_min?: number;
  price_change_max?: number;
  period?: 'today' | 'week' | 'month';
  page?: number;
  limit?: number;
}

// 统计数据接口
export interface StatsData {
  total_coins: number;
  contracts_listed: number;
  new_today: number;
  new_this_week: number;
  avg_market_cap: number;
  total_volume_24h: number;
}

// WebSocket消息接口
export interface WebSocketMessage {
  type: 'initial_data' | 'data_update' | 'new_coin' | 'new_futures' | 'error' | 'pong';
  data?: any;
  timestamp: string;
}

// 应用状态接口
export interface AppState {
  coins: CoinData[];
  stats: StatsData | null;
  filters: FilterOptions;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

// 表格列配置接口
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: CoinData) => React.ReactNode;
}

// 通知类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}