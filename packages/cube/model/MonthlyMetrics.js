/**
 * Monthly Game Metrics Cube - Time-series estimated played hours
 *
 * Provides estimated played hours per game per month.
 * Use this cube when filtering by specific months or time periods.
 *
 * IMPORTANT: estimatedMonthlyHours is an ESTIMATE - Steam does not
 * provide actual "total played hours" data.
 */

cube('MonthlyGameMetrics', {
  sql: `SELECT * FROM monthly_game_metrics`,

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    gameName: {
      sql: `game_name`,
      type: 'string',
    },
    month: {
      sql: `month`,
      type: 'time',
      primaryKey: true,
    },
    year: {
      sql: `year`,
      type: 'number',
    },
    monthNum: {
      sql: `month_num`,
      type: 'number',
    },
    monthlyCcuSum: {
      sql: `monthly_ccu_sum`,
      type: 'number',
    },
    estimatedMonthlyHours: {
      sql: `estimated_monthly_hours`,
      type: 'number',
      title: 'Estimated Monthly Played Hours',
      description: 'ESTIMATE based on monthly CCU × avg playtime. Not actual Steam data.',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    sumEstimatedHours: {
      sql: `estimated_monthly_hours`,
      type: 'sum',
    },
    sumMonthlyCcu: {
      sql: `monthly_ccu_sum`,
      type: 'sum',
    },
    gameCount: {
      type: 'countDistinct',
      sql: `appid`,
    },
  },

  segments: {
    // Current month
    currentMonth: {
      sql: `${CUBE}.month = DATE_TRUNC('month', CURRENT_DATE)`,
    },
    // Last month (most recent complete month)
    lastMonth: {
      sql: `${CUBE}.month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    },
    // Last 3 months
    last3Months: {
      sql: `${CUBE}.month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')`,
    },
    // Last 6 months
    last6Months: {
      sql: `${CUBE}.month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')`,
    },
    // Last 12 months
    last12Months: {
      sql: `${CUBE}.month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')`,
    },
    // Year 2025
    year2025: {
      sql: `${CUBE}.year = 2025`,
    },
    // Year 2024
    year2024: {
      sql: `${CUBE}.year = 2024`,
    },
  },

  preAggregations: {
    // Monthly metrics by game (main cache)
    monthlyByGame: {
      dimensions: [appid, gameName, month, year, monthNum, estimatedMonthlyHours],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});
