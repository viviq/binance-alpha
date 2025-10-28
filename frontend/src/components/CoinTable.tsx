import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  IconButton,
  Tooltip,
  TableSortLabel,
  Link,
  Avatar,
  Stack,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
  ContentCopy,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { CoinData, FilterOptions } from '../types';
import { formatNumber, formatPrice, formatPercentage, formatTime } from '../utils/format';

interface CoinTableProps {
  coins: CoinData[];
  loading?: boolean;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  filters?: FilterOptions;
}

// 单独的币种行组件，使用memo优化
const CoinRow = memo(({ coin, index, formatPriceChange, renderFuturesStatus, renderContractInfo }: {
  coin: CoinData;
  index: number;
  formatPriceChange: (change: number) => JSX.Element;
  renderFuturesStatus: (coin: CoinData) => JSX.Element;
  renderContractInfo: (coin: CoinData) => JSX.Element;
}) => {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavoriteClick = () => {
    setIsFavorite(!isFavorite);
  };

  return (
    <TableRow 
      key={coin.alpha_id || `${coin.symbol}-${coin.contract_address}`} 
      hover
      sx={{
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        },
        borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
      }}
    >
      {/* 排名 */}
      <TableCell sx={{ width: 60, padding: '12px 8px' }}>
        <Typography variant="body2" color="textSecondary" fontWeight="medium">
          {index + 1}
        </Typography>
      </TableCell>

      {/* 收藏 */}
      <TableCell sx={{ width: 40, padding: '12px 4px' }}>
        <IconButton 
          size="small" 
          onClick={handleFavoriteClick}
          sx={{ color: isFavorite ? '#f0b90b' : 'rgba(0, 0, 0, 0.3)' }}
        >
          {isFavorite ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>
      </TableCell>

      {/* 币种信息 */}
      <TableCell sx={{ minWidth: 200, padding: '12px 16px' }}>
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
      </TableCell>

      {/* 价格 */}
      <TableCell align="right" sx={{ minWidth: 120, padding: '12px 16px' }}>
        <Typography 
          variant="body1" 
          fontWeight="600" 
          sx={{ 
            fontSize: '14px',
            color: coin.current_price && coin.current_price > 0 ? 'inherit' : 'rgba(0, 0, 0, 0.4)'
          }}
        >
          {formatPrice(coin.current_price)}
        </Typography>
      </TableCell>

      {/* 24h变化 */}
      <TableCell align="right" sx={{ minWidth: 100, padding: '12px 16px' }}>
        {coin.price_change && typeof coin.price_change === 'number' && coin.price_change !== 0 ? 
          formatPriceChange(coin.price_change) : 
          <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.4)', fontSize: '13px' }}>
            -
          </Typography>
        }
      </TableCell>

      {/* 24h成交量 */}
      <TableCell align="right" sx={{ minWidth: 120, padding: '12px 16px' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontSize: '13px',
            color: coin.volume_24h && coin.volume_24h > 0 ? 'inherit' : 'rgba(0, 0, 0, 0.4)'
          }}
        >
          {formatNumber(coin.volume_24h)}
        </Typography>
      </TableCell>

      {/* 市值 */}
      <TableCell align="right" sx={{ minWidth: 120, padding: '12px 16px' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontSize: '13px',
            color: coin.market_cap && coin.market_cap > 0 ? 'inherit' : 'rgba(0, 0, 0, 0.4)'
          }}
        >
          {formatNumber(coin.market_cap)}
        </Typography>
      </TableCell>

      {/* Alpha上线时间 */}
      <TableCell sx={{ minWidth: 140, padding: '12px 16px' }}>
        <Typography variant="body2" sx={{ fontSize: '12px' }}>
          {formatTime(coin.alpha_listing_time)}
        </Typography>
      </TableCell>

      {/* 合约状态 */}
      <TableCell align="center" sx={{ minWidth: 100, padding: '12px 16px' }}>
        {renderFuturesStatus(coin)}
      </TableCell>

      {/* 合约价格 */}
      <TableCell align="right" sx={{ minWidth: 120, padding: '12px 16px' }}>
        <Typography variant="body2" sx={{ fontSize: '13px' }}>
          {coin.futures_data?.futures_price ? formatPrice(coin.futures_data.futures_price) : '-'}
        </Typography>
      </TableCell>

      {/* 合约未平仓量 */}
      <TableCell align="right" sx={{ minWidth: 120, padding: '12px 16px' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontSize: '13px',
            color: coin.futures_data?.open_interest && coin.futures_data.open_interest > 0 ? 'inherit' : 'rgba(0, 0, 0, 0.4)'
          }}
        >
          {coin.futures_data?.is_listed && coin.futures_data?.open_interest ? 
            formatNumber(coin.futures_data.open_interest) : 
            '-'
          }
        </Typography>
      </TableCell>

      {/* 操作 */}
      <TableCell align="center" sx={{ width: 80, padding: '12px 8px' }}>
        <Tooltip title="查看详情">
          <IconButton size="small" sx={{ color: 'rgba(0, 0, 0, 0.5)' }}>
            <ShowChart fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

const CoinTable: React.FC<CoinTableProps> = ({ 
  coins, 
  loading = false, 
  onSort,
  filters 
}) => {
  const [orderBy, setOrderBy] = useState<string>(filters?.sort_by || 'alpha_listing_time');
  const [order, setOrder] = useState<'asc' | 'desc'>(filters?.sort_order || 'desc');

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
    if (coin.futures_data?.is_listed) {
      return (
        <Tooltip title={`合约上线时间: ${formatTime(coin.futures_data.listing_time || '')}`}>
          <Chip
            icon={<AccountBalance sx={{ fontSize: '14px !important' }} />}
            label="已上线"
            color="success"
            size="small"
            variant="outlined"
            sx={{ 
              fontSize: '11px',
              height: '24px',
              '& .MuiChip-label': { px: 1 }
            }}
          />
        </Tooltip>
      );
    } else {
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

    const handleCopyAddress = () => {
      navigator.clipboard.writeText(coin.contract_address!);
    };

    const getExplorerUrl = (chainId: string, address: string) => {
      const explorers: { [key: string]: string } = {
        '1': 'https://etherscan.io/address/',
        '56': 'https://bscscan.com/address/',
        '137': 'https://polygonscan.com/address/',
        '43114': 'https://snowtrace.io/address/',
        '250': 'https://ftmscan.com/address/',
      };
      return explorers[chainId] ? `${explorers[chainId]}${address}` : null;
    };

    const explorerUrl = coin.chain_id ? getExplorerUrl(coin.chain_id, coin.contract_address) : null;
    const shortAddress = `${coin.contract_address.slice(0, 6)}...${coin.contract_address.slice(-4)}`;

    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        {explorerUrl ? (
          <Link
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ textDecoration: 'none' }}
          >
            {shortAddress}
          </Link>
        ) : (
          <Typography variant="body2">
            {shortAddress}
          </Typography>
        )}
        <Tooltip title="复制合约地址">
          <IconButton size="small" onClick={handleCopyAddress}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }, []);

  if (loading) {
    return (
      <TableContainer component={Paper}>
        <Box p={4} textAlign="center">
          <Typography>加载中...</Typography>
        </Box>
      </TableContainer>
    );
  }

  if (coins.length === 0) {
    return (
      <TableContainer component={Paper}>
        <Box p={4} textAlign="center">
          <Typography color="textSecondary">暂无数据</Typography>
        </Box>
      </TableContainer>
    );
  }

  return (
    <TableContainer 
      component={Paper} 
      sx={{ 
        height: 'auto',
        overflow: 'auto',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(224, 224, 224, 0.5)',
      }}
    >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              width: 60,
              padding: '12px 8px'
            }}>
              #
            </TableCell>
            <TableCell sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              width: 40,
              padding: '12px 4px'
            }}>
              
            </TableCell>
            <TableCell sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 200,
              padding: '12px 16px'
            }}>
              <TableSortLabel
                active={orderBy === 'symbol'}
                direction={orderBy === 'symbol' ? order : 'asc'}
                onClick={createSortHandler('symbol')}
                sx={{ fontSize: '12px', fontWeight: 600 }}
              >
                币种
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 120,
              padding: '12px 16px'
            }}>
              <TableSortLabel
                active={orderBy === 'current_price'}
                direction={orderBy === 'current_price' ? order : 'asc'}
                onClick={createSortHandler('current_price')}
                sx={{ fontSize: '12px', fontWeight: 600 }}
              >
                价格
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 100,
              padding: '12px 16px'
            }}>
              24h %
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 120,
              padding: '12px 16px'
            }}>
              <TableSortLabel
                active={orderBy === 'volume_24h'}
                direction={orderBy === 'volume_24h' ? order : 'asc'}
                onClick={createSortHandler('volume_24h')}
                sx={{ fontSize: '12px', fontWeight: 600 }}
              >
                24h成交量
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 120,
              padding: '12px 16px'
            }}>
              <TableSortLabel
                active={orderBy === 'market_cap'}
                direction={orderBy === 'market_cap' ? order : 'asc'}
                onClick={createSortHandler('market_cap')}
                sx={{ fontSize: '12px', fontWeight: 600 }}
              >
                市值
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 140,
              padding: '12px 16px'
            }}>
              <TableSortLabel
                active={orderBy === 'alpha_listing_time'}
                direction={orderBy === 'alpha_listing_time' ? order : 'asc'}
                onClick={createSortHandler('alpha_listing_time')}
                sx={{ fontSize: '12px', fontWeight: 600 }}
              >
                Alpha上线
              </TableSortLabel>
            </TableCell>
            <TableCell align="center" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 100,
              padding: '12px 16px'
            }}>
              合约状态
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 120,
              padding: '12px 16px'
            }}>
              合约价格
            </TableCell>
            <TableCell align="right" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              minWidth: 120,
              padding: '12px 16px'
            }}>
              合约未平仓量
            </TableCell>
            <TableCell align="center" sx={{ 
              backgroundColor: '#fafafa', 
              fontWeight: 600, 
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
              width: 80,
              padding: '12px 8px'
            }}>
              操作
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {coins.map((coin, index) => (
            <CoinRow 
              key={coin.alpha_id || `${coin.symbol}-${coin.contract_address}`}
              coin={coin}
              index={index}
              formatPriceChange={formatPriceChange}
              renderFuturesStatus={renderFuturesStatus}
              renderContractInfo={renderContractInfo}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default memo(CoinTable);