import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  WifiOff,
  Wifi,
  NotificationsActive,
} from '@mui/icons-material';
import VirtualizedCoinTable from './components/VirtualizedCoinTable';
import FilterPanel from './components/FilterPanel';
import StatsCards from './components/StatsCards';
import { useAppStore } from './store/useAppStore';
import { ApiService } from './services/api';
import { wsService } from './services/websocket';
import { FilterOptions } from './types';

// 将主题创建移到组件外部，避免每次渲染都重新创建
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#f0b90b', // 币安黄色
    },
    secondary: {
      main: '#1e1e1e',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    success: {
      main: '#16a34a', // CoinMarketCap绿色
    },
    error: {
      main: '#dc2626', // CoinMarketCap红色
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
    body1: {
      fontSize: '14px',
    },
    body2: {
      fontSize: '13px',
    },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
          padding: '12px 16px',
        },
        head: {
          backgroundColor: '#fafafa',
          fontWeight: 600,
          fontSize: '12px',
          color: 'rgba(0, 0, 0, 0.6)',
          borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1e1e1e',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

const App: React.FC = () => {
  const {
    coins,
    stats,
    filters,
    loading,
    error,
    connected,
    setCoins,
    setStats,
    setFilters,
    setLoading,
    setError,
    setConnected,
    addNotification,
    addNewCoin,
    updateCoin,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<string | null>(null);

  // 使用 ref 跟踪上次的 filters 值，防止无限循环
  const prevFiltersRef = useRef<string>();

  // 监听通知并显示
  const notifications = useAppStore(state => state.notifications);
  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length > 0) {
      const latest = unreadNotifications[0];
      setCurrentNotification(`${latest.title}: ${latest.message}`);
    }
  }, [notifications]);

  // 使用useCallback优化函数引用
  const loadData = useCallback(async () => {
    try {
      const [coinsData, statsData] = await Promise.all([
        ApiService.getCoins(filters),
        ApiService.getStats(),
      ]);
      setCoins(coinsData.items || coinsData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载数据失败，请稍后重试');
    }
  }, [filters, setCoins, setStats, setError]);

  const reloadWithFilters = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const coinsData = await ApiService.getCoins(filters);
      setCoins(coinsData.items || coinsData);
    } catch (error) {
      console.error('重新加载数据失败:', error);
      setError('重新加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [filters, connected, setLoading, setCoins, setError]);

  const setupWebSocketListeners = useCallback(() => {
    wsService.on('connected', () => {
      setConnected(true);
      // WebSocket 连接时清除缓存，确保获取最新数据
      ApiService.clearCache();
      addNotification({
        type: 'success',
        title: '连接成功',
        message: 'WebSocket连接已建立',
      });
    });

    wsService.on('disconnected', () => {
      setConnected(false);
      addNotification({
        type: 'warning',
        title: '连接断开',
        message: 'WebSocket连接已断开',
      });
    });

    wsService.on('initialData', (coinsData) => {
      setCoins(coinsData);
      console.log('收到初始数据:', coinsData.length, '个币对');
    });

    wsService.on('dataUpdate', (coinsData) => {
      setCoins(coinsData);
      console.log('数据更新:', coinsData.length, '个币对');
    });

    wsService.on('newCoin', (coinData) => {
      addNewCoin(coinData);
      addNotification({
        type: 'info',
        title: 'Alpha上线',
        message: `${coinData.symbol} 已在Alpha平台上线`,
      });
    });

    wsService.on('newFutures', (coinData) => {
      updateCoin(coinData.symbol, { futures_data: coinData.futures_data });
      addNotification({
        type: 'success',
        title: '合约上线',
        message: `${coinData.symbol} 永续合约已上线`,
      });
    });

    wsService.on('error', (error) => {
      console.error('WebSocket错误:', error);
      setError('WebSocket连接错误');
    });
  }, [setConnected, addNotification, setCoins, addNewCoin, updateCoin, setError]);

  const initializeApp = useCallback(async () => {
    setLoading(true);
    setError(null); // 清除之前的错误
    try {
      // 连接WebSocket
      await wsService.connect();

      // 获取初始数据（如果WebSocket没有发送初始数据，则通过API获取）
      try {
        await loadData();
      } catch (apiError) {
        console.warn('API加载数据失败，等待WebSocket数据:', apiError);
        // 不设置错误，因为WebSocket可能会提供数据
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
      setError('初始化失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, [loadData, setLoading, setError]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      addNotification({
        type: 'success',
        title: '刷新成功',
        message: '数据已更新',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '刷新失败',
        message: '请稍后重试',
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadData, addNotification]);

  const handleSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({ sort_by: sortBy, sort_order: sortOrder });
  }, [setFilters]);

  const handleCloseSnackbar = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, [setFilters]);

  const handleFiltersReset = useCallback(() => {
    setFilters({});
  }, [setFilters]);

  // 初始化数据
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // 监听筛选变化，自动重新加载数据
  useEffect(() => {
    const filtersString = JSON.stringify(filters);

    // 只在 filters 真正改变时才重新加载
    if (connected && prevFiltersRef.current !== filtersString) {
      prevFiltersRef.current = filtersString;
      reloadWithFilters();
    }
  }, [filters, connected, reloadWithFilters]);

  // 监听WebSocket事件
  useEffect(() => {
    setupWebSocketListeners();
    return () => {
      wsService.disconnect();
    };
  }, [setupWebSocketListeners]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ flexGrow: 1 }}>
        {/* 顶部导航栏 */}
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              币安Alpha监控系统
            </Typography>
            
            {/* 连接状态 */}
            <Tooltip title={connected ? '已连接' : '未连接'}>
              <IconButton color="inherit">
                {connected ? <Wifi /> : <WifiOff />}
              </IconButton>
            </Tooltip>

            {/* 刷新按钮 */}
            <Tooltip title="刷新数据">
              <IconButton 
                color="inherit" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <Refresh />
              </IconButton>
            </Tooltip>

            {/* 通知按钮 */}
            <Tooltip title="通知">
              <IconButton color="inherit">
                <NotificationsActive />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
          {/* 错误提示 */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {/* 统计卡片 */}
          {stats && <StatsCards stats={stats} loading={loading} />}

          {/* 筛选面板 */}
          <FilterPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleFiltersReset}
          />

          {/* 币对表格 */}
          <VirtualizedCoinTable
            coins={coins}
            loading={loading}
            onSort={handleSort}
            filters={filters}
          />
        </Container>

        {/* 通知Snackbar */}
        <Snackbar
          open={currentNotification !== null}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="info" variant="filled">
            {currentNotification}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default App;