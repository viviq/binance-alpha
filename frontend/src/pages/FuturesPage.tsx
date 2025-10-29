import React, { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Link,
  Tooltip,
  Button,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Schedule,
  OpenInNew,
  Refresh,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CoinData } from '../types';
import { useAppStore } from '../store/useAppStore';
import { ApiService } from '../services/api';

interface UpcomingFuture {
  symbol: string;
  name?: string;
  announcement_title: string;
  announcement_url: string;
  expected_listing_date?: string;
  expected_listing_time?: string;
  created_at: string;
}

const FuturesPage: React.FC = () => {
  const { coins, loading, error } = useAppStore();
  const [futuresCoins, setFuturesCoins] = useState<CoinData[]>([]);
  const [upcomingFutures, setUpcomingFutures] = useState<UpcomingFuture[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // 筛选和排序有合约的币种
  useEffect(() => {
    const filtered = coins
      .filter(coin => coin.futures_data?.is_listed && coin.futures_data?.listing_time)
      .sort((a, b) => {
        const timeA = a.futures_data?.listing_time || '';
        const timeB = b.futures_data?.listing_time || '';
        return timeB.localeCompare(timeA); // 降序排列，最新的在前
      });
    setFuturesCoins(filtered);
  }, [coins]);

  // 获取即将上线的合约
  useEffect(() => {
    const fetchUpcomingFutures = async () => {
      try {
        const data = await ApiService.getUpcomingFutures();
        setUpcomingFutures(data);
      } catch (error) {
        console.error('获取即将上线合约失败:', error);
      }
    };

    fetchUpcomingFutures();
    // 每分钟刷新一次
    const interval = setInterval(fetchUpcomingFutures, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback((dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return dateString;
    }
  }, []);

  const formatNumber = useCallback((num: number | undefined | null, decimals: number = 2) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, []);

  const formatPrice = useCallback((price: number | undefined | null) => {
    if (price === undefined || price === null) return '-';
    if (price >= 1) {
      return `$${formatNumber(price, 2)}`;
    } else if (price >= 0.01) {
      return `$${formatNumber(price, 4)}`;
    } else {
      return `$${formatNumber(price, 6)}`;
    }
  }, [formatNumber]);

  const formatLargeNumber = useCallback((num: number | undefined | null) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }, []);

  const handleRefreshUpcomingFutures = async () => {
    setRefreshing(true);
    try {
      const result = await ApiService.refreshUpcomingFutures();
      setUpcomingFutures(result.data);
      setSnackbar({
        open: true,
        message: `成功刷新 ${result.count} 条合约公告`,
        severity: 'success',
      });
    } catch (error: any) {
      console.error('刷新失败:', error);
      setSnackbar({
        open: true,
        message: error.message || '刷新失败，请稍后重试',
        severity: 'error',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.secondary';
  };

  const getBinanceUrl = (symbol: string, isFutures: boolean = false) => {
    if (isFutures) {
      return `https://www.binance.com/zh-CN/futures/${symbol}USDT`;
    }
    return `https://www.binance.com/zh-CN/trade/${symbol}_USDT`;
  };

  if (loading && futuresCoins.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          合约上线追踪
        </Typography>
        <Typography variant="body2" color="text.secondary">
          显示所有已上线永续合约的币种，按合约上线时间倒序排列
        </Typography>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 统计信息 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Typography variant="body2" color="text.secondary">
            合约总数
          </Typography>
          <Typography variant="h5">
            {futuresCoins.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Typography variant="body2" color="text.secondary">
            今日新增
          </Typography>
          <Typography variant="h5">
            {futuresCoins.filter(coin => {
              const listingTime = new Date(coin.futures_data?.listing_time || '');
              const today = new Date();
              return listingTime.toDateString() === today.toDateString();
            }).length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Typography variant="body2" color="text.secondary">
            本周新增
          </Typography>
          <Typography variant="h5">
            {futuresCoins.filter(coin => {
              const listingTime = new Date(coin.futures_data?.listing_time || '');
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return listingTime >= weekAgo;
            }).length}
          </Typography>
        </Paper>
      </Box>

      {/* 即将上线的合约 */}
      {upcomingFutures.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule />
              即将/最近上线的合约
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={refreshing ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleRefreshUpcomingFutures}
              disabled={refreshing}
            >
              {refreshing ? '刷新中...' : '手动刷新'}
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width="100">币种</TableCell>
                  <TableCell>公告标题</TableCell>
                  <TableCell width="150">预计上线时间</TableCell>
                  <TableCell width="100">查看公告</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcomingFutures.map((future) => (
                  <TableRow
                    key={future.symbol}
                    sx={{
                      backgroundColor: 'warning.50',
                      '&:hover': { backgroundColor: 'warning.100' },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold">
                        {future.symbol}
                      </Typography>
                      {future.name && (
                        <Typography variant="caption" color="text.secondary">
                          {future.name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {future.announcement_title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {future.expected_listing_time
                          ? formatTime(future.expected_listing_time)
                          : future.expected_listing_date
                          ? new Date(future.expected_listing_date).toLocaleDateString('zh-CN')
                          : '待确认'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={future.announcement_url}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        <Chip
                          label="查看"
                          size="small"
                          icon={<OpenInNew fontSize="small" />}
                          clickable
                          color="warning"
                          sx={{ height: 24, fontSize: '0.75rem' }}
                        />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 已上线合约列表 */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        已上线的合约
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="80">排名</TableCell>
              <TableCell width="120">币种</TableCell>
              <TableCell width="180">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Schedule fontSize="small" />
                  合约上线时间
                </Box>
              </TableCell>
              <TableCell align="right" width="120">现货价格</TableCell>
              <TableCell align="right" width="120">合约价格</TableCell>
              <TableCell align="right" width="100">24h涨跌</TableCell>
              <TableCell align="right" width="110">流通市值</TableCell>
              <TableCell align="right" width="110">
                <Tooltip title="完全稀释估值 (FDV)">
                  <span>FDV</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right" width="120">未平仓量</TableCell>
              <TableCell align="right" width="120">24h成交量</TableCell>
              <TableCell width="100">链接</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {futuresCoins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    暂无合约数据
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              futuresCoins.map((coin, index) => (
                <TableRow
                  key={coin.symbol}
                  hover
                  sx={{
                    '&:hover': { backgroundColor: 'action.hover' },
                    // 今日上线的高亮显示
                    ...(new Date(coin.futures_data?.listing_time || '').toDateString() === new Date().toDateString() && {
                      backgroundColor: 'success.50',
                    }),
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      #{index + 1}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {coin.symbol}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {coin.name}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Tooltip title="合约上线时间">
                      <Box>
                        <Typography variant="body2">
                          {formatTime(coin.futures_data?.listing_time || '')}
                        </Typography>
                        {new Date(coin.futures_data?.listing_time || '').toDateString() === new Date().toDateString() && (
                          <Chip
                            label="今日上线"
                            size="small"
                            color="success"
                            sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatPrice(coin.current_price)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatPrice(coin.futures_data?.futures_price)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      {coin.price_change > 0 ? (
                        <TrendingUp fontSize="small" sx={{ color: 'success.main' }} />
                      ) : (
                        <TrendingDown fontSize="small" sx={{ color: 'error.main' }} />
                      )}
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        sx={{ color: getPriceChangeColor(coin.price_change) }}
                      >
                        {coin.price_change > 0 ? '+' : ''}{coin.price_change.toFixed(2)}%
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatLargeNumber(coin.market_cap)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="完全稀释估值 (FDV) = 总供应量 × 当前价格">
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {coin.fdv && coin.fdv > 0 ? (
                          formatLargeNumber(coin.fdv)
                        ) : (
                          '-'
                        )}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatLargeNumber(coin.futures_data?.open_interest)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatLargeNumber(coin.volume_24h)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Link
                        href={getBinanceUrl(coin.symbol, false)}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        <Chip
                          label="现货"
                          size="small"
                          icon={<OpenInNew fontSize="small" />}
                          clickable
                          sx={{ height: 24, fontSize: '0.75rem' }}
                        />
                      </Link>
                      <Link
                        href={getBinanceUrl(coin.symbol, true)}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center' }}
                      >
                        <Chip
                          label="合约"
                          size="small"
                          icon={<OpenInNew fontSize="small" />}
                          clickable
                          color="primary"
                          sx={{ height: 24, fontSize: '0.75rem' }}
                        />
                      </Link>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 底部说明 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          * 数据更新频率：每分钟
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * 绿色背景表示今日新上线的合约
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * 价格数据优先级：现货价格 &gt; 合约价格 &gt; 链上价格，确保数据准确性
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * FDV为完全稀释估值，计算公式：总供应量 × 当前价格
        </Typography>
      </Box>

      {/* 提示信息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default FuturesPage;
