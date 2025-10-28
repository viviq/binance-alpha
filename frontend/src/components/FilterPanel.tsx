import React, { memo } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Clear,
  Search,
  Sort,
} from '@mui/icons-material';
import { FilterOptions } from '../types';

interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onReset: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = memo(({
  filters,
  onFiltersChange,
  onReset,
}) => {

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: event.target.value,
    });
  };

  const handleSortChange = (field: string, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  const handleFuturesFilterChange = () => {
    const newValue = filters.has_futures === true ? undefined : true;
    onFiltersChange({
      ...filters,
      has_futures: newValue,
    });
  };

  const quickFilters = [
    { label: '今日新币', onClick: () => onFiltersChange({ ...filters, period: 'today' }) },
    { label: '已上合约', onClick: () => onFiltersChange({ ...filters, has_futures: true }) },
    { label: '涨幅>10%', onClick: () => onFiltersChange({ ...filters, price_change_min: 10 }) },
  ];

  return (
    <Box
      sx={{
        mb: 1,
        p: 1.5,
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        border: '1px solid rgba(224, 224, 224, 0.3)',
      }}
    >
      {/* 主要筛选行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        {/* 搜索框 */}
        <TextField
          size="small"
          placeholder="搜索币对..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          sx={{
            minWidth: 180,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#ffffff',
              height: 32,
              fontSize: '13px',
            },
          }}
          InputProps={{
            startAdornment: <Search sx={{ mr: 0.5, color: 'rgba(0, 0, 0, 0.4)', fontSize: 16 }} />,
          }}
        />

        {/* 排序 */}
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ fontSize: '13px' }}>排序</InputLabel>
          <Select
            value={filters.sort_by || 'alpha_listing_time'}
            label="排序"
            onChange={(e) => handleSortChange('sort_by', e.target.value)}
            sx={{ backgroundColor: '#ffffff', height: 32, fontSize: '13px' }}
          >
            <MenuItem value="alpha_listing_time" sx={{ fontSize: '13px' }}>上线时间</MenuItem>
            <MenuItem value="current_price" sx={{ fontSize: '13px' }}>价格</MenuItem>
            <MenuItem value="market_cap" sx={{ fontSize: '13px' }}>市值</MenuItem>
            <MenuItem value="volume_24h" sx={{ fontSize: '13px' }}>成交量</MenuItem>
            <MenuItem value="price_change_24h" sx={{ fontSize: '13px' }}>涨跌幅</MenuItem>
          </Select>
        </FormControl>

        {/* 排序方向 */}
        <Tooltip title={filters.sort_order === 'asc' ? '升序' : '降序'}>
          <IconButton
            size="small"
            onClick={() => handleSortChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')}
            sx={{
              width: 32,
              height: 32,
              backgroundColor: '#ffffff',
              border: '1px solid rgba(224, 224, 224, 0.5)',
              '&:hover': { backgroundColor: '#f5f5f5' }
            }}
          >
            <Sort sx={{
              fontSize: 16,
              transform: filters.sort_order === 'asc' ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s'
            }} />
          </IconButton>
        </Tooltip>

        {/* 合约筛选 */}
        <Chip
          label="已上合约"
          onClick={handleFuturesFilterChange}
          variant={filters.has_futures === true ? 'filled' : 'outlined'}
          size="small"
          sx={{
            backgroundColor: filters.has_futures === true ? '#e3f2fd' : '#ffffff',
            borderColor: filters.has_futures === true ? '#1976d2' : 'rgba(224, 224, 224, 0.5)',
            '&:hover': {
              backgroundColor: filters.has_futures === true ? '#bbdefb' : '#f5f5f5',
            },
            height: 26,
            fontSize: '12px',
            '& .MuiChip-label': { px: 1, py: 0 },
          }}
        />

        {/* 重置按钮 */}
        <Tooltip title="重置筛选">
          <IconButton
            size="small"
            onClick={onReset}
            sx={{
              width: 32,
              height: 32,
              backgroundColor: '#ffffff',
              border: '1px solid rgba(224, 224, 224, 0.5)',
              '&:hover': { backgroundColor: '#f5f5f5' }
            }}
          >
            <Clear sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 快速筛选 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {quickFilters.map((filter, index) => (
          <Chip
            key={index}
            label={filter.label}
            onClick={filter.onClick}
            size="small"
            sx={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(224, 224, 224, 0.5)',
              '&:hover': {
                backgroundColor: '#e3f2fd',
                borderColor: '#1976d2',
              },
              fontSize: '11px',
              height: 22,
              '& .MuiChip-label': { px: 1, py: 0 },
            }}
          />
        ))}
      </Box>
    </Box>
  );
});

export default FilterPanel;