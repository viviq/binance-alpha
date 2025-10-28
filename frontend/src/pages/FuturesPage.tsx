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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Schedule,
  OpenInNew,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CoinData } from '../types';
import { useAppStore } from '../store/useAppStore';

const FuturesPage: React.FC = () => {
  const { coins, loading, error } = useAppStore();
  const [futuresCoins, setFuturesCoins] = useState<CoinData[]>([]);

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

      {/* 合约列表 */}
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
              <TableCell align="right" width="120">市值</TableCell>
              <TableCell align="right" width="120">未平仓量</TableCell>
              <TableCell align="right" width="120">24h成交量</TableCell>
              <TableCell width="100">链接</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {futuresCoins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
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
      </Box>
    </Container>
  );
};

export default FuturesPage;
