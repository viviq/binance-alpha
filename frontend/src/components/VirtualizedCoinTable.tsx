import React, { useMemo, useCallback, memo, useState, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import {
  Paper,
  Chip,
  Typography,
  Box,
  IconButton,
  Tooltip,
  TableSortLabel,
  Avatar,
  Stack,
  Link,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Star,
  StarBorder,
  ContentCopy,
} from '@mui/icons-material';
import { CoinData, FilterOptions } from '../types';
import { formatNumber, formatPrice, formatPercentage, formatTime } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

interface VirtualizedCoinTableProps {
  coins: CoinData[];
  loading?: boolean;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  filters?: FilterOptions;
}

// 单行高度
const ROW_HEIGHT = 72;

// 虚拟化行组件
const VirtualizedRow = memo(({ index, style, data }: {
  index: number;
  style: React.CSSProperties;
  data: {
    coins: CoinData[];
    formatPriceChange: (change: number) => JSX.Element;
    renderFuturesStatus: (coin: CoinData) => JSX.Element;
    renderContractInfo: (coin: CoinData) => JSX.Element;
    toggleFavorite: (symbol: string) => void;
    isFavorite: (symbol: string) => boolean;
  };
}) => {
  const { coins, formatPriceChange, renderFuturesStatus, toggleFavorite, isFavorite } = data;
  const coin = coins[index];

  const handleFavoriteClick = useCallback(() => {
    toggleFavorite(coin.symbol);
  }, [coin.symbol, toggleFavorite]);

  if (!coin) return null;

  return (
    <div style={style}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: ROW_HEIGHT,
          borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          },
          px: 2,
        }}
      >
        {/* 排名 */}
        <Box sx={{ width: 60, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary" fontWeight="medium">
            {index + 1}
          </Typography>
        </Box>

        {/* 收藏 */}
        <Box sx={{ width: 40, textAlign: 'center' }}>
          <IconButton
            size="small"
            onClick={handleFavoriteClick}
            sx={{ color: isFavorite(coin.symbol) ? '#f0b90b' : 'rgba(0, 0, 0, 0.3)' }}
          >
            {isFavorite(coin.symbol) ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
          </IconButton>
        </Box>

        {/* 币种信息 */}
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar
              sx={{ 
                width: 32, 
                height: 32, 
                backgroundColor: '#f0b90b',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {coin.symbol.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight="600" sx={{ fontSize: '14px' }}>
                {coin.symbol}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontSize: '12px' }}>
                {coin.name}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* 价格 */}
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="body1" fontWeight="600" sx={{ fontSize: '14px' }}>
            {coin.current_price && coin.current_price > 0 ? (
              formatPrice(coin.current_price)
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
          </Typography>
        </Box>

        {/* 24h变化 */}
        <Box sx={{ minWidth: 100, textAlign: 'right' }}>
          {coin.price_change !== undefined && coin.price_change !== null && typeof coin.price_change === 'number' && coin.price_change !== 0 ? (
            formatPriceChange(coin.price_change)
          ) : (
            <Typography variant="body2" sx={{ color: '#999' }}>-</Typography>
          )}
        </Box>

        {/* 24h成交量 */}
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontSize: '13px' }}>
            {coin.volume_24h && coin.volume_24h > 0 ? (
              formatNumber(coin.volume_24h)
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
          </Typography>
        </Box>

        {/* 流通市值 */}
        <Box sx={{ minWidth: 110, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontSize: '13px' }}>
            {coin.market_cap && coin.market_cap > 0 ? (
              formatNumber(coin.market_cap)
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
          </Typography>
        </Box>

        {/* 完全稀释市值(FDV) */}
        <Box sx={{ minWidth: 110, textAlign: 'right' }}>
          <Tooltip title="基于流通市值估算，假设总供应量约为流通量的2倍">
            <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary' }}>
              {coin.market_cap && coin.market_cap > 0 ? (
                <>~{formatNumber(coin.market_cap * 2)}</>
              ) : (
                <span style={{ color: '#999' }}>-</span>
              )}
            </Typography>
          </Tooltip>
        </Box>

        {/* Alpha上线时间 */}
        <Box sx={{ minWidth: 140, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '12px' }}>
            {formatTime(coin.alpha_listing_time)}
          </Typography>
        </Box>

        {/* 合约上线时间 */}
        <Box sx={{ minWidth: 140, textAlign: 'center' }}>
          {renderFuturesStatus(coin)}
        </Box>

        {/* 合约价格 */}
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontSize: '13px' }}>
            {coin.futures_data?.futures_price ? (
              formatPrice(coin.futures_data.futures_price)
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
          </Typography>
        </Box>

        {/* 合约未平仓量 */}
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontSize: '13px',
              color: coin.futures_data?.open_interest && coin.futures_data.open_interest > 0 ? 'inherit' : '#999'
            }}
          >
            {coin.futures_data?.is_listed && coin.futures_data?.open_interest ? 
              formatNumber(coin.futures_data.open_interest) : 
              '-'
            }
          </Typography>
        </Box>

        {/* 操作 */}
        <Box sx={{ width: 80, textAlign: 'center' }}>
          <Tooltip title="查看图表">
            <IconButton size="small" sx={{ color: 'primary.main' }}>
              <ShowChart fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </div>
  );
});

const VirtualizedCoinTable: React.FC<VirtualizedCoinTableProps> = ({
  coins,
  loading = false,
  onSort,
  filters
}) => {
  const { toggleFavorite, isFavorite } = useAppStore();
  const [orderBy, setOrderBy] = useState<string>(filters?.sort_by || 'alpha_listing_time');
  const [order, setOrder] = useState<'asc' | 'desc'>(filters?.sort_order || 'desc');

  // 动态计算表格高度
  const [tableHeight, setTableHeight] = useState(600);

  useEffect(() => {
    const calculateHeight = () => {
      // 计算可用高度：视口高度 - 头部导航 - 统计卡片 - 筛选面板 - 边距
      const viewportHeight = window.innerHeight;
      const reservedHeight = 64 + 90 + 75 + 50; // AppBar + StatsCards + FilterPanel + margins (压缩后)
      const calculatedHeight = Math.max(500, viewportHeight - reservedHeight);
      setTableHeight(calculatedHeight);
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const handleSort = useCallback((property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setOrder(newOrder);
    setOrderBy(property);
    onSort?.(property, newOrder);
  }, [orderBy, order, onSort]);

  const createSortHandler = useCallback((property: string) => () => {
    handleSort(property);
  }, [handleSort]);

  const formatPriceChange = useCallback((change: number) => {
    const isPositive = change >= 0;
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="flex-end"
        sx={{
          backgroundColor: isPositive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
          borderRadius: '4px',
          padding: '4px 8px',
          minWidth: '80px',
        }}
      >
        {isPositive ? (
          <TrendingUp sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
        ) : (
          <TrendingDown sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} />
        )}
        <Typography
          variant="body2"
          color={isPositive ? 'success.main' : 'error.main'}
          fontWeight="600"
          sx={{ fontSize: '13px' }}
        >
          {formatPercentage(change)}
        </Typography>
      </Box>
    );
  }, []);

  const renderFuturesStatus = useCallback((coin: CoinData) => {
    if (coin.futures_data?.is_listed && coin.futures_data.listing_time) {
      // 已上线：显示具体上线时间
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: '#16a34a' }}>
            {formatTime(coin.futures_data.listing_time)}
          </Typography>
        </Box>
      );
    } else {
      // 未上线
      return (
        <Chip
          label="未上线"
          color="default"
          size="small"
          variant="outlined"
          sx={{
            fontSize: '11px',
            height: '24px',
            '& .MuiChip-label': { px: 1 }
          }}
        />
      );
    }
  }, []);

  const renderContractInfo = useCallback((coin: CoinData) => {
    if (!coin.contract_address) {
      return (
        <Typography variant="body2" color="textSecondary">
          无合约地址
        </Typography>
      );
    }

    const shortAddress = `${coin.contract_address.slice(0, 6)}...${coin.contract_address.slice(-4)}`;
    
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Link
          href={`https://bscscan.com/address/${coin.contract_address}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            textDecoration: 'none',
            color: 'primary.main',
            fontSize: '12px',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          {shortAddress}
        </Link>
        <Tooltip title="复制合约地址">
          <IconButton 
            size="small" 
            onClick={() => navigator.clipboard.writeText(coin.contract_address || '')}
            sx={{ p: 0.5 }}
          >
            <ContentCopy sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }, []);

  // 准备虚拟化数据
  const itemData = useMemo(() => ({
    coins,
    formatPriceChange,
    renderFuturesStatus,
    renderContractInfo,
    toggleFavorite,
    isFavorite,
  }), [coins, formatPriceChange, renderFuturesStatus, renderContractInfo, toggleFavorite, isFavorite]);

  return (
    <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
      {/* 表头 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        height: 56,
        backgroundColor: '#fafafa',
        borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
        px: 2,
      }}>
        <Box sx={{ width: 60, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
            排名
          </Typography>
        </Box>
        <Box sx={{ width: 40 }}></Box>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <TableSortLabel
            active={orderBy === 'symbol'}
            direction={orderBy === 'symbol' ? order : 'asc'}
            onClick={createSortHandler('symbol')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            币种
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <TableSortLabel
            active={orderBy === 'current_price'}
            direction={orderBy === 'current_price' ? order : 'asc'}
            onClick={createSortHandler('current_price')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            价格
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 100, textAlign: 'right' }}>
          <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
            24h变化
          </Typography>
        </Box>
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <TableSortLabel
            active={orderBy === 'volume_24h'}
            direction={orderBy === 'volume_24h' ? order : 'asc'}
            onClick={createSortHandler('volume_24h')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            24h成交量
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 110, textAlign: 'right' }}>
          <TableSortLabel
            active={orderBy === 'market_cap'}
            direction={orderBy === 'market_cap' ? order : 'asc'}
            onClick={createSortHandler('market_cap')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            流通市值
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 110, textAlign: 'right' }}>
          <Tooltip title="完全稀释市值，基于估算">
            <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
              FDV估算
            </Typography>
          </Tooltip>
        </Box>
        <Box sx={{ minWidth: 140, textAlign: 'center' }}>
          <TableSortLabel
            active={orderBy === 'alpha_listing_time'}
            direction={orderBy === 'alpha_listing_time' ? order : 'asc'}
            onClick={createSortHandler('alpha_listing_time')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            Alpha上线
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 140, textAlign: 'center' }}>
          <TableSortLabel
            active={orderBy === 'futures_listing_time'}
            direction={orderBy === 'futures_listing_time' ? order : 'desc'}
            onClick={createSortHandler('futures_listing_time')}
            sx={{ fontSize: '12px', fontWeight: 600 }}
          >
            合约上线时间
          </TableSortLabel>
        </Box>
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
            合约价格
          </Typography>
        </Box>
        <Box sx={{ minWidth: 120, textAlign: 'right' }}>
          <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
            合约未平仓量
          </Typography>
        </Box>
        <Box sx={{ width: 80, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="600" sx={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
            操作
          </Typography>
        </Box>
      </Box>

      {/* 虚拟化列表 */}
      <FixedSizeList
        height={tableHeight}
        itemCount={coins.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
        width="100%"
      >
        {VirtualizedRow}
      </FixedSizeList>
    </Paper>
  );
};

export default memo(VirtualizedCoinTable);