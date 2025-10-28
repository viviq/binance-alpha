import React from 'react';
import {
  Box,
  Pagination as MuiPagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 2,
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      {/* 显示信息 */}
      <Typography variant="body2" color="text.secondary">
        显示 {startItem}-{endItem} 条，共 {totalItems} 条
      </Typography>

      {/* 分页控件 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* 每页显示数量 */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>每页显示</InputLabel>
          <Select
            value={pageSize}
            label="每页显示"
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <MenuItem value={20}>20条</MenuItem>
            <MenuItem value={50}>50条</MenuItem>
            <MenuItem value={100}>100条</MenuItem>
          </Select>
        </FormControl>

        {/* 分页器 */}
        <MuiPagination
          count={totalPages}
          page={currentPage}
          onChange={(event, page) => onPageChange(page)}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    </Box>
  );
};

export default Pagination;