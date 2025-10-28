import { create } from 'zustand';
import { CoinData, StatsData, FilterOptions, Notification } from '../types';

interface AppState {
  // 数据状态
  coins: CoinData[];
  stats: StatsData | null;
  loading: boolean;
  error: string | null;

  // 连接状态
  connected: boolean;

  // 筛选和分页
  filters: FilterOptions;
  totalPages: number;
  currentPage: number;

  // 通知
  notifications: Notification[];

  // 收藏
  favorites: Set<string>;

  // Actions
  setCoins: (coins: CoinData[]) => void;
  setStats: (stats: StatsData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setFilters: (filters: FilterOptions) => void;
  setPagination: (totalPages: number, currentPage: number) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  updateCoin: (symbol: string, updates: Partial<CoinData>) => void;
  addNewCoin: (coin: CoinData) => void;
  toggleFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
  reset: () => void;
}

const initialState = {
  coins: [],
  stats: null,
  loading: false,
  error: null,
  connected: false,
  filters: {
    page: 1,
    limit: 50,
    sort_by: 'alpha_listing_time',
    sort_order: 'desc' as const,
  },
  totalPages: 0,
  currentPage: 1,
  notifications: [],
  favorites: new Set<string>(),
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setCoins: (coins) => set({ coins }),

  setStats: (stats) => set({ stats }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setConnected: (connected) => set({ connected }),

  setFilters: (filters) => set({ 
    filters: { ...get().filters, ...filters },
    currentPage: filters.page || get().currentPage
  }),

  setPagination: (totalPages, currentPage) => set({ totalPages, currentPage }),

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      read: false,
    };
    
    set(state => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100) // 最多保留100条通知
    }));
  },

  markNotificationAsRead: (id) => set(state => ({
    notifications: state.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    )
  })),

  clearNotifications: () => set({ notifications: [] }),

  updateCoin: (symbol, updates) => set(state => ({
    coins: state.coins.map(coin => 
      coin.symbol === symbol ? { ...coin, ...updates } : coin
    )
  })),

  addNewCoin: (coin) => set(state => {
    // 检查是否已存在
    const exists = state.coins.some(c => c.symbol === coin.symbol);
    if (exists) {
      return {
        coins: state.coins.map(c => c.symbol === coin.symbol ? coin : c)
      };
    } else {
      return {
        coins: [coin, ...state.coins]
      };
    }
  }),

  toggleFavorite: (symbol) => set(state => {
    const newFavorites = new Set(state.favorites);
    if (newFavorites.has(symbol)) {
      newFavorites.delete(symbol);
    } else {
      newFavorites.add(symbol);
    }
    return { favorites: newFavorites };
  }),

  isFavorite: (symbol) => get().favorites.has(symbol),

  reset: () => set(initialState),
}));

// 选择器函数
export const useCoins = () => useAppStore(state => state.coins);
export const useStats = () => useAppStore(state => state.stats);
export const useLoading = () => useAppStore(state => state.loading);
export const useError = () => useAppStore(state => state.error);
export const useConnected = () => useAppStore(state => state.connected);
export const useFilters = () => useAppStore(state => state.filters);
export const usePagination = () => useAppStore(state => ({ 
  totalPages: state.totalPages, 
  currentPage: state.currentPage 
}));
export const useNotifications = () => useAppStore(state => state.notifications);
export const useUnreadNotifications = () => useAppStore(state => 
  state.notifications.filter(n => !n.read)
);