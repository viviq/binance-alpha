import React, { memo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
} from '@mui/icons-material';
import { StatsData } from '../types';

interface StatsCardsProps {
  stats: StatsData;
  loading?: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = memo(({ stats, loading = false }) => {
  const cards = [
    {
      title: 'Alpha币对总数',
      value: stats.total_coins,
      icon: <ShowChart />,
      color: '#1976d2',
      subtitle: '当前监控中',
    },
    {
      title: '已上合约',
      value: stats.contracts_listed,
      icon: <AccountBalance />,
      color: '#2e7d32',
      subtitle: `${((stats.contracts_listed / stats.total_coins) * 100).toFixed(1)}% 上合约率`,
    },
    {
      title: '今日新增',
      value: stats.new_today,
      icon: <TrendingUp />,
      color: '#388e3c',
      subtitle: `今日新上线币对`,
    },
    {
      title: '本周新增',
      value: stats.new_this_week,
      icon: <TrendingDown />,
      color: '#d32f2f',
      subtitle: `本周新上线币对`,
    },
  ];

  if (loading) {
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <LinearProgress />
                <Box sx={{ height: 80 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            sx={{
              height: '100%',
              background: '#ffffff',
              border: '1px solid rgba(224, 224, 224, 0.3)',
              borderRadius: '8px',
              '&:hover': {
                borderColor: card.color,
              },
            }}
          >
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '6px',
                    backgroundColor: `${card.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color,
                    fontSize: '18px',
                  }}
                >
                  {card.icon}
                </Box>

                <Box>
                  <Typography
                    variant="h5"
                    component="div"
                    sx={{
                      fontWeight: 600,
                      fontSize: '20px',
                      color: '#1e1e1e',
                      lineHeight: 1,
                    }}
                  >
                    {card.value.toLocaleString()}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(0, 0, 0, 0.6)',
                      fontSize: '11px',
                      fontWeight: 500,
                      mt: 0.3,
                    }}
                  >
                    {card.title}
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(0, 0, 0, 0.45)',
                  fontSize: '10px',
                  mt: 0.5,
                }}
              >
                {card.subtitle}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
});

export default StatsCards;