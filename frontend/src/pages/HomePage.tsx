import React, { useCallback } from 'react';
import {
  Container,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import VirtualizedCoinTable from '../components/VirtualizedCoinTable';
import FilterPanel from '../components/FilterPanel';
import StatsCards from '../components/StatsCards';
import { useAppStore } from '../store/useAppStore';
import { FilterOptions } from '../types';

const HomePage: React.FC = () => {
  const {
    coins,
    stats,
    filters,
    loading,
    error,
    setFilters,
    setError,
  } = useAppStore();

  const handleSort = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({ sort_by: sortBy, sort_order: sortOrder });
  }, [setFilters]);

  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, [setFilters]);

  const handleFiltersReset = useCallback(() => {
    setFilters({});
  }, [setFilters]);

  return (
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

      {/* 数据说明 */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          * 数据更新频率：每分钟，确保实时性
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * 价格数据优先级：现货价格 &gt; 合约价格 &gt; 链上价格，确保准确性
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * 流通市值 = 当前价格 × 流通供应量，使用实时数据计算
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          * FDV为估算值，基于流通市值×2计算（假设总供应量约为流通量的2倍）
        </Typography>
      </Box>
    </Container>
  );
};

export default HomePage;
