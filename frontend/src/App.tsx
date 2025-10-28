import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Snackbar,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  Refresh,
  WifiOff,
  Wifi,
  NotificationsActive,
  Home,
  TrendingUp,
} from '@mui/icons-material';
import HomePage from './pages/HomePage';
import FuturesPage from './pages/FuturesPage';
import { useAppStore } from './store/useAppStore';
import { ApiService } from './services/api';
import { wsService } from './services/websocket';

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

// 导航标签组件
const NavigationTabs: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Tabs
      value={currentPath}
      textColor="inherit"
      indicatorColor="primary"
      sx={{ ml: 3 }}
    >
      <Tab
        label="首页"
        icon={<Home />}
        iconPosition="start"
        value="/"
        component={RouterLink}
        to="/"
        sx={{ minHeight: 64 }}
      />
      <Tab
        label="合约追踪"
        icon={<TrendingUp />}
        iconPosition="start"
        value="/futures"
        component={RouterLink}
        to="/futures"
        sx={{ minHeight: 64 }}
      />
    </Tabs>
  );
};

const App: React.FC = () => {
  const {
    connected,
    setCoins,
    setStats,
    setLoading,
    setError,
    setConnected,
    addNotification,
    addNewCoin,
    updateCoin,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<string | null>(null);

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
        ApiService.getCoins({}),
        ApiService.getStats(),
      ]);
      setCoins(coinsData.items || coinsData);
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载数据失败，请稍后重试');
    }
  }, [setCoins, setStats, setError]);

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

  const handleCloseSnackbar = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  // 初始化数据
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // 监听WebSocket事件
  useEffect(() => {
    setupWebSocketListeners();
    return () => {
      wsService.disconnect();
    };
  }, [setupWebSocketListeners]);

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          {/* 顶部导航栏 */}
          <AppBar position="static" elevation={1}>
            <Toolbar>
              <Typography variant="h6" component="div">
                币安Alpha监控系统
              </Typography>

              {/* 导航标签 */}
              <NavigationTabs />

              {/* 右侧工具栏 */}
              <Box sx={{ flexGrow: 1 }} />

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

          {/* 路由内容 */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/futures" element={<FuturesPage />} />
          </Routes>

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
      </Router>
    </ThemeProvider>
  );
};

export default App;