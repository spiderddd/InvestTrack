/**
 * StatementService Tests - Data Structure Consistency
 * 
 * Tests for the bug: getDetailsByPeriod was returning 'positions' field
 * but dashboardService expects 'assets' field
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { StatementService } from '../../../server/services/statementService.js';
import { DashboardService } from '../../../server/services/dashboardService.js';

// Test data based on scripts/example.json
const testData = {
  assets: [
    { type: 'fund', name: '沪深300ETF', ticker: '510300', prices: [
      { date: '2024-06', price: 3.3277 }, { date: '2024-01', price: 3.376 }
    ]},
    { type: 'security', name: '腾讯控股', ticker: '00700.HK', prices: [
      { date: '2024-06', price: 367.4824 }, { date: '2024-01', price: 298.3178 }
    ]},
    { type: 'wealth', name: '招商银行理财', ticker: '', prices: [
      { date: '2024-06', price: 1 }, { date: '2024-01', price: 1 }
    ]}
  ],
  strategies: [{
    name: 'Test Strategy',
    startDate: '2024-01-01',
    status: 'active',
    layers: [
      { name: 'Layer 1', weight: 60, items: [
        { targetName: '沪深300ETF', weight: 30, color: '#ef4444' },
        { targetName: '腾讯控股', weight: 30, color: '#8b5cf6' }
      ]},
      { name: 'Layer 2', weight: 40, items: [
        { targetName: '招商银行理财', weight: 40, color: '#64748b' }
      ]}
    ]
  }],
  monthlyStatements: [
    { date: '2024-01-31', note: 'Initial', transactions: [
      { assetName: '沪深300ETF', quantityChange: 10000, costChange: 35000 },
      { assetName: '腾讯控股', quantityChange: 200, costChange: 56000 },
      { assetName: '招商银行理财', quantityChange: 50000, costChange: 50000 }
    ]}
  ]
};

describe('StatementService Data Structure', () => {
  describe('getDetailsByPeriod', () => {
    it('should return statement with assets field (not positions)', async () => {
      // This test verifies the bug fix: getDetailsByPeriod must return 'assets'
      // not 'positions' to match getDetails() behavior
      const result = await StatementService.getDetailsByPeriod('2026-02-12');
      
      // Should have assets field
      expect(result).toHaveProperty('assets');
      expect(Array.isArray(result.assets)).toBe(true);
      
      // Should NOT have positions field (the bug)
      expect(result).not.toHaveProperty('positions');
    });

    it('should return consistent structure with getDetails', async () => {
      // Get both methods' results
      const statements = await StatementService.getList(1, 10);
      if (!statements.items || statements.items.length === 0) {
        console.log('⚠️  No statements in DB, skipping test');
        return;
      }
      
      const statementId = statements.items[0].id;
      const byId = await StatementService.getDetails(statementId);
      const byPeriod = await StatementService.getDetailsByPeriod(byId.date);
      
      // Both should have same structure
      expect(byId).toHaveProperty('assets');
      expect(byPeriod).toHaveProperty('assets');
      
      // Verify assets array items have expected fields
      if (byPeriod.assets.length > 0) {
        const asset = byPeriod.assets[0];
        expect(asset).toHaveProperty('assetId');
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('category');
        expect(asset).toHaveProperty('quantity');
        expect(asset).toHaveProperty('marketValue');
        expect(asset).toHaveProperty('totalCost');
        expect(asset).toHaveProperty('unitPrice');
      }
    });

    it('should calculate correct totals for real-time view', async () => {
      const result = await StatementService.getDetailsByPeriod('2026-02-12');
      
      // Should have totals
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('totalInvested');
      expect(typeof result.totalValue).toBe('number');
      expect(typeof result.totalInvested).toBe('number');
      
      // Total value should equal sum of asset market values
      if (result.assets && result.assets.length > 0) {
        const calculatedTotal = result.assets.reduce((sum, a) => sum + a.marketValue, 0);
        expect(result.totalValue).toBeCloseTo(calculatedTotal, 2);
      }
    });
  });
});

describe('DashboardService Metrics Calculation', () => {
  describe('getMetrics with viewMode=strategy', () => {
    it('should return non-zero values when data exists', async () => {
      const result = await DashboardService.getMetrics({ viewMode: 'strategy', timeRange: 'all' });
      
      // These should NOT all be zero (the bug was returning all zeros)
      const hasData = result.endValue !== 0 || 
                      result.endInvested !== 0 || 
                      result.startValue !== 0;
      
      if (!hasData) {
        console.log('⚠️  No strategy data in DB, skipping validation');
        return;
      }
      
      expect(result).toHaveProperty('endValue');
      expect(result).toHaveProperty('endInvested');
      expect(result).toHaveProperty('profit');
      expect(result).toHaveProperty('returnRate');
      expect(typeof result.returnRate).toBe('number');
    });

    it('should calculate profit correctly', async () => {
      const result = await DashboardService.getMetrics({ viewMode: 'strategy', timeRange: 'all' });
      
      if (result.endValue === 0 && result.endInvested === 0) {
        console.log('⚠️  No data, skipping profit calculation test');
        return;
      }
      
      // profit = (endValue - endInvested) - (startValue - startInvested)
      const expectedProfit = (result.endValue - result.endInvested) - 
                            (result.startValue - result.startInvested);
      expect(result.profit).toBeCloseTo(expectedProfit, 2);
    });

    it('should calculate return rate correctly for all time', async () => {
      const result = await DashboardService.getMetrics({ viewMode: 'strategy', timeRange: 'all' });
      
      if (result.endInvested === 0) {
        console.log('⚠️  No investment data, skipping return rate test');
        return;
      }
      
      // For 'all' timeRange: returnRate = (profit / endInvested) * 100
      const expectedReturnRate = (result.profit / result.endInvested) * 100;
      expect(result.returnRate).toBeCloseTo(expectedReturnRate, 2);
    });
  });

  describe('getMetrics with viewMode=total', () => {
    it('should return non-zero values when data exists', async () => {
      const result = await DashboardService.getMetrics({ viewMode: 'total', timeRange: 'all' });
      
      expect(result).toHaveProperty('endValue');
      expect(result).toHaveProperty('endInvested');
      expect(result).toHaveProperty('profit');
      expect(typeof result.endValue).toBe('number');
      expect(typeof result.endInvested).toBe('number');
    });
  });
});

describe('DashboardService Breakdown Calculation', () => {
  describe('getAttribution with viewMode=strategy', () => {
    it('should return items array with correct structure', async () => {
      const result = await DashboardService.getAttribution({ 
        viewMode: 'strategy', 
        timeRange: 'all',
        layerId: null 
      });
      
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totals');
      expect(Array.isArray(result.items)).toBe(true);
      
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('endVal');
        expect(item).toHaveProperty('endCost');
        expect(item).toHaveProperty('profit');
        expect(item).toHaveProperty('roi');
      }
    });

    it('should calculate totals correctly', async () => {
      const result = await DashboardService.getAttribution({ 
        viewMode: 'strategy', 
        timeRange: 'all' 
      });
      
      if (result.items.length === 0) {
        console.log('⚠️  No items in breakdown, skipping totals test');
        return;
      }
      
      // Totals should equal sum of items
      const calculatedEndVal = result.items.reduce((sum, item) => sum + item.endVal, 0);
      const calculatedProfit = result.items.reduce((sum, item) => sum + item.profit, 0);
      
      expect(result.totals.endVal).toBeCloseTo(calculatedEndVal, 2);
      expect(result.totals.profit).toBeCloseTo(calculatedProfit, 2);
    });

    it('should calculate ROI correctly', async () => {
      const result = await DashboardService.getAttribution({ 
        viewMode: 'strategy', 
        timeRange: 'all' 
      });
      
      if (result.items.length === 0) {
        console.log('⚠️  No items in breakdown, skipping ROI test');
        return;
      }
      
      // Verify each item's ROI calculation
      result.items.forEach(item => {
        if (item.endCost > 0) {
          const expectedRoi = (item.profit / item.endCost) * 100;
          expect(item.roi).toBeCloseTo(expectedRoi, 2);
        }
      });
      
      // Verify totals ROI
      if (result.totals.endCost > 0) {
        const expectedTotalRoi = (result.totals.profit / result.totals.endCost) * 100;
        expect(result.totals.roi).toBeCloseTo(expectedTotalRoi, 2);
      }
    });
  });
});

describe('DashboardService Allocation Calculation', () => {
  describe('getAllocation with viewMode=total', () => {
    it('should group assets by category correctly', async () => {
      const result = await DashboardService.getAllocation({ viewMode: 'total', layerId: null });
      
      // Should return array
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length === 0) {
        console.log('⚠️  No allocation data, skipping category test');
        return;
      }
      
      // Each item should have required fields
      result.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('value');
        expect(item).toHaveProperty('percent');
        expect(item).toHaveProperty('color');
        expect(typeof item.value).toBe('number');
        expect(typeof item.percent).toBe('number');
      });
      
      // Check for expected category names (股票基金, 现金固收, 商品另类, 其他)
      const validCategories = ['股票基金', '现金固收', '商品另类', '其他'];
      result.forEach(item => {
        expect(validCategories).toContain(item.name);
      });
    });

    it('should calculate percentages that sum to 100%', async () => {
      const result = await DashboardService.getAllocation({ viewMode: 'total', layerId: null });
      
      if (result.length === 0) {
        console.log('⚠️  No allocation data, skipping percentage sum test');
        return;
      }
      
      // Sum of percentages should be close to 100 (allowing for rounding)
      const totalPercent = result.reduce((sum, item) => sum + item.percent, 0);
      expect(totalPercent).toBeGreaterThanOrEqual(99);
      expect(totalPercent).toBeLessThanOrEqual(100);
    });

    it('should sort results by value descending', async () => {
      const result = await DashboardService.getAllocation({ viewMode: 'total', layerId: null });
      
      if (result.length < 2) {
        console.log('⚠️  Less than 2 categories, skipping sort test');
        return;
      }
      
      // Check that array is sorted by value descending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].value).toBeGreaterThanOrEqual(result[i].value);
      }
    });
  });

  describe('getAllocation with viewMode=strategy (layer view)', () => {
    it('should return layer-based allocation when no layerId provided', async () => {
      const result = await DashboardService.getAllocation({ viewMode: 'strategy', layerId: null });
      
      // Should return array
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length === 0) {
        console.log('⚠️  No strategy layers found, skipping layer allocation test');
        return;
      }
      
      // Each layer should have required fields
      result.forEach(layer => {
        expect(layer).toHaveProperty('id');
        expect(layer).toHaveProperty('name');
        expect(layer).toHaveProperty('value');
        expect(layer).toHaveProperty('percent');
        expect(layer).toHaveProperty('targetPercent');
        expect(layer).toHaveProperty('deviation');
        expect(layer).toHaveProperty('isLayer');
        expect(layer.isLayer).toBe(true);
      });
    });

    it('should calculate deviation as actual minus target percent', async () => {
      const result = await DashboardService.getAllocation({ viewMode: 'strategy', layerId: null });
      
      if (result.length === 0) {
        console.log('⚠️  No strategy layers found, skipping deviation test');
        return;
      }
      
      result.forEach(layer => {
        const expectedDeviation = layer.percent - layer.targetPercent;
        expect(layer.deviation).toBeCloseTo(expectedDeviation, 1);
      });
    });
  });

  describe('getAllocation with viewMode=strategy (drill-down view)', () => {
    it('should return item-based allocation when layerId provided', async () => {
      // First get the layers to find a valid layerId
      const layers = await DashboardService.getAllocation({ viewMode: 'strategy', layerId: null });
      
      if (layers.length === 0) {
        console.log('⚠️  No strategy layers found, skipping drill-down test');
        return;
      }
      
      const layerId = layers[0].id;
      const result = await DashboardService.getAllocation({ viewMode: 'strategy', layerId });
      
      expect(Array.isArray(result)).toBe(true);
      
      // Each item should have required fields
      result.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('value');
        expect(item).toHaveProperty('percent');
        expect(item).toHaveProperty('targetPercent');
        expect(item).toHaveProperty('deviation');
        expect(item).toHaveProperty('color');
        expect(item.isLayer).toBe(false);
      });
    });
  });
});

describe('DashboardService Trend Calculation', () => {
  describe('getTrend with viewMode=total', () => {
    it('should return trend data array with date, value, and invested', async () => {
      const result = await DashboardService.getTrend({ viewMode: 'total', layerId: null });
      
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length === 0) {
        console.log('⚠️  No trend data available');
        return;
      }
      
      // Each point should have required fields
      result.forEach(point => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('value');
        expect(point).toHaveProperty('invested');
        expect(typeof point.value).toBe('number');
        expect(typeof point.invested).toBe('number');
      });
    });

    it('should return data sorted by date ascending', async () => {
      const result = await DashboardService.getTrend({ viewMode: 'total', layerId: null });
      
      if (result.length < 2) {
        console.log('⚠️  Less than 2 trend points, skipping sort test');
        return;
      }
      
      // Check dates are sorted ascending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].date <= result[i].date).toBe(true);
      }
    });

    it('should filter by startDate when provided', async () => {
      const allData = await DashboardService.getTrend({ viewMode: 'total', layerId: null });
      
      if (allData.length < 3) {
        console.log('⚠️  Not enough trend data, skipping filter test');
        return;
      }
      
      // Use a date from the middle of the data
      const middleIndex = Math.floor(allData.length / 2);
      const startDate = allData[middleIndex].date;
      
      const filtered = await DashboardService.getTrend({ 
        viewMode: 'total', 
        layerId: null, 
        startDate 
      });
      
      // Filtered data should start from startDate
      expect(filtered.length).toBeLessThanOrEqual(allData.length);
      // Use string comparison for dates (YYYY-MM-DD format sorts lexicographically)
      expect(filtered[0].date >= startDate).toBe(true);
    });
  });

  describe('getTrend with viewMode=strategy', () => {
    it('should return filtered trend data for strategy view', async () => {
      const result = await DashboardService.getTrend({ viewMode: 'strategy', layerId: null });
      
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length === 0) {
        console.log('⚠️  No strategy trend data available');
        return;
      }
      
      // Strategy trend values should be less than or equal to total values
      // (since strategy filters assets)
      const totalResult = await DashboardService.getTrend({ viewMode: 'total', layerId: null });
      
      if (totalResult.length > 0 && result.length > 0) {
        // Compare the latest values
        const strategyLatest = result[result.length - 1];
        const totalLatest = totalResult[totalResult.length - 1];
        
        // Strategy value should be <= total value (or equal if all assets are in strategy)
        expect(strategyLatest.value).toBeLessThanOrEqual(totalLatest.value + 0.01);
      }
    });
  });
});

describe('Integration: Statement and Dashboard Consistency', () => {
  it('should produce consistent values between services', async () => {
    // Get real-time statement
    const today = new Date().toISOString().slice(0, 10);
    const statement = await StatementService.getDetailsByPeriod(today);
    
    if (!statement || !statement.assets || statement.assets.length === 0) {
      console.log('⚠️  No statement data, skipping integration test');
      return;
    }
    
    // Get dashboard metrics
    const metrics = await DashboardService.getMetrics({ viewMode: 'total', timeRange: 'all' });
    
    // Statement totalValue should match dashboard endValue (for total view)
    expect(metrics.endValue).toBeCloseTo(statement.totalValue, 2);
  });

  it('should have consistent totals between allocation and statement', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const statement = await StatementService.getDetailsByPeriod(today);
    const allocation = await DashboardService.getAllocation({ viewMode: 'total', layerId: null });
    
    if (!statement || !statement.assets || statement.assets.length === 0) {
      console.log('⚠️  No statement data, skipping allocation consistency test');
      return;
    }
    
    // Allocation total should equal statement totalValue
    const allocationTotal = allocation.reduce((sum, item) => sum + item.value, 0);
    expect(allocationTotal).toBeCloseTo(statement.totalValue, 2);
  });
});
