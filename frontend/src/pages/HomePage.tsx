import React, { useCallback } from 'react';
import {
  Container,
  Alert,
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
    </Container>
  );
};

export default HomePage;
