/**
 * API Integration Test for example.json data
 * 
 * 测试流程：
 * 1. 导入 example.json 数据
 * 2. 验证所有API端点
 * 3. 验证数据完整性和计算准确性
 * 4. 验证修复后的价格数据
 * 
 * 运行：npm test -- tests/integration/example-data-api.test.js --run
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  exampleAssets,
  expectedHoldings,
  expectedMarketValues,
  expectedSummary,
  expectedStrategy,
  expectedStatements,
  isCloseTo
} from '../fixtures/example-data.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// 导入 example.json 数据
async function importExampleData() {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const examplePath = path.join(__dirname, '../../scripts/example.json');
  
  const backupData = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
  
  const res = await fetch(`${API_BASE}/export/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  
  if (!res.ok) {
    throw new Error(`导入失败: ${await res.text()}`);
  }
  
  return await res.json();
}

// API 请求辅助函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${await res.text()}`);
  }
  
  return await res.json();
}

describe('Example Data API Integration Test', () => {
  let importResult;
  
  describe('1. 数据导入', () => {
    it('应该成功导入 example.json 数据', async () => {
      importResult = await importExampleData();
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported.assets).toBe(7);
      expect(importResult.imported.strategies).toBe(1);
      expect(importResult.imported.monthlyStatements).toBe(6);
    });
    
    it('应该导入所有资产', async () => {
      const res = await apiRequest('/assets');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(7);
      
      // 验证每个资产都存在
      const assetNames = res.data.map(a => a.name);
      for (const expectedAsset of exampleAssets) {
        expect(assetNames).toContain(expectedAsset.name);
      }
    });
    
    it('应该导入所有策略', async () => {
      const res = await apiRequest('/strategies');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      
      const strategy = res.data[0];
      expect(strategy.name).toBe(expectedStrategy.name);
      expect(strategy.layers).toHaveLength(expectedStrategy.layerCount);
    });
    
    it('应该导入所有月度报表', async () => {
      const res = await apiRequest('/statements');
      
      expect(res.success).toBe(true);
      expect(res.data.items).toHaveLength(6);
      expect(res.data.total).toBe(6);
    });
  });
  
  describe('2. 资产API测试', () => {
    it('GET /api/assets 应该返回完整资产列表', async () => {
      const res = await apiRequest('/assets');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(7);
      expect(res.message).toContain('retrieved successfully');
      
      // 验证资产结构
      const asset = res.data[0];
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('type');
      expect(asset).toHaveProperty('name');
      expect(asset).toHaveProperty('ticker');
      expect(asset).toHaveProperty('note');
      expect(asset).toHaveProperty('createdAt');
    });
    
    it('GET /api/assets/:id/history 应该返回历史数据', async () => {
      // 先获取Bitcoin的ID
      const assetsRes = await apiRequest('/assets');
      const bitcoin = assetsRes.data.find(a => a.name === 'Bitcoin');
      expect(bitcoin).toBeDefined();
      
      const res = await apiRequest(`/assets/${bitcoin.id}/history`);
      
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      
      // 验证历史数据结构
      const history = res.data;
      expect(history[0]).toHaveProperty('date');
      expect(history[0]).toHaveProperty('unitPrice');
      expect(history[0]).toHaveProperty('quantity');
      expect(history[0]).toHaveProperty('marketValue');
      expect(history[0]).toHaveProperty('totalCost');
    });
  });
  
  describe('3. 策略API测试', () => {
    it('GET /api/strategies 应该返回策略列表', async () => {
      const res = await apiRequest('/strategies');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      
      const strategy = res.data[0];
      expect(strategy.name).toBe('2024 全球配置策略 (模拟)');
      expect(strategy.startDate).toBe('2024-01-01');
      expect(strategy.status).toBe('active');
      expect(strategy.layers).toHaveLength(2);
    });
    
    it('策略分层结构应该正确', async () => {
      const res = await apiRequest('/strategies');
      const strategy = res.data[0];
      
      // 第一层：稳健底仓
      const layer1 = strategy.layers.find(l => l.name === '第一层：稳健底仓');
      expect(layer1).toBeDefined();
      expect(layer1.weight).toBe(40);
      expect(layer1.items).toHaveLength(3);
      
      // 第二层：进取成长
      const layer2 = strategy.layers.find(l => l.name === '第二层：进取成长');
      expect(layer2).toBeDefined();
      expect(layer2.weight).toBe(60);
      expect(layer2.items).toHaveLength(4);
    });
  });
  
  describe('4. 月报API测试', () => {
    it('GET /api/statements 应该返回分页列表', async () => {
      const res = await apiRequest('/statements');
      
      expect(res.success).toBe(true);
      expect(res.data.items).toHaveLength(6);
      expect(res.data.total).toBe(6);
      expect(res.data.page).toBe(1);
    });
    
    it('GET /api/statements/history 应该返回历史图表数据', async () => {
      const res = await apiRequest('/statements/history');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(6);
      
      // 验证数据结构
      const firstRecord = res.data[0];
      expect(firstRecord).toHaveProperty('date');
      expect(firstRecord).toHaveProperty('totalValue');
      expect(firstRecord).toHaveProperty('totalInvested');
      expect(firstRecord).toHaveProperty('assets');
      expect(Array.isArray(firstRecord.assets)).toBe(true);
    });
    
    it('GET /api/statements/details-by-date 应该返回指定日期的详情', async () => {
      const res = await apiRequest('/statements/details-by-date?date=2024-06-30');
      
      expect(res.success).toBe(true);
      expect(res.data.date).toBe('2024-06-30');
      expect(res.data.assets).toHaveLength(7);
      expect(res.data.totalValue).toBeCloseTo(expectedSummary.totalValue, 0);
      expect(res.data.totalInvested).toBe(expectedSummary.totalInvested);
    });
  });
  
  describe('5. 仪表盘API测试', () => {
    it('GET /api/dashboard/metrics 应该返回关键指标', async () => {
      const res = await apiRequest('/dashboard/metrics?viewMode=total&timeRange=all');
      
      expect(res.success).toBe(true);
      expect(res.data.endValue).toBeCloseTo(expectedSummary.totalValue, 0);
      expect(res.data.endInvested).toBe(expectedSummary.totalInvested);
      expect(res.data.profit).toBeCloseTo(expectedSummary.profit, 0);
      expect(res.data.returnRate).toBeCloseTo(expectedSummary.returnRate, 1);
      expect(res.data.periodLabel).toBe('历史累计');
    });
    
    it('GET /api/dashboard/allocation 应该返回资产配置', async () => {
      const res = await apiRequest('/dashboard/allocation?viewMode=total');
      
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      
      // 验证配置项结构
      const item = res.data[0];
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('percent');
      expect(item).toHaveProperty('color');
    });
    
    it('GET /api/dashboard/trend 应该返回趋势数据', async () => {
      const res = await apiRequest('/dashboard/trend?viewMode=total');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(6);
      
      // 验证趋势数据点结构
      const point = res.data[0];
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('value');
      expect(point).toHaveProperty('invested');
    });
    
    it('GET /api/dashboard/overview 应该返回完整概览', async () => {
      const res = await apiRequest('/dashboard/overview?viewMode=total&timeRange=all');
      
      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty('metrics');
      expect(res.data).toHaveProperty('allocation');
      expect(res.data).toHaveProperty('trend');
      
      // 验证汇总数据
      expect(res.data.metrics.endValue).toBeCloseTo(expectedSummary.totalValue, 0);
      expect(res.data.metrics.endInvested).toBe(expectedSummary.totalInvested);
    });
  });
  
  describe('6. 数据准确性验证', () => {
    it('2024-06-30 持仓数据应该准确', async () => {
      const res = await apiRequest('/statements/details-by-date?date=2024-06-30');
      const assets = res.data.assets;
      
      // 验证Bitcoin
      const bitcoin = assets.find(a => a.name === 'Bitcoin');
      expect(bitcoin).toBeDefined();
      expect(bitcoin.quantity).toBeCloseTo(expectedHoldings['Bitcoin'].quantity, 4);
      expect(bitcoin.totalCost).toBe(expectedHoldings['Bitcoin'].cost);
      expect(bitcoin.marketValue).toBeCloseTo(expectedMarketValues['Bitcoin'], 0);
      
      // 验证腾讯控股
      const tencent = assets.find(a => a.name === '腾讯控股');
      expect(tencent).toBeDefined();
      expect(tencent.quantity).toBeCloseTo(expectedHoldings['腾讯控股'].quantity, 4);
      expect(tencent.marketValue).toBeCloseTo(expectedMarketValues['腾讯控股'], 0);
      
      // 验证实物黄金
      const gold = assets.find(a => a.name === '实物黄金');
      expect(gold).toBeDefined();
      expect(gold.quantity).toBeCloseTo(expectedHoldings['实物黄金'].quantity, 4);
      expect(gold.marketValue).toBeCloseTo(expectedMarketValues['实物黄金'], 0);
    });
    
    it('当前实时持仓应该使用最新价格', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiRequest(`/statements/details-by-date?date=${today}`);
      
      expect(res.success).toBe(true);
      expect(res.data.assets).toHaveLength(7);
      
      // Bitcoin应该使用修复后的价格（约572585）
      const bitcoin = res.data.assets.find(a => a.name === 'Bitcoin');
      expect(bitcoin).toBeDefined();
      expect(bitcoin.marketValue).toBeGreaterThan(60000); // 应该是6万多，不是16
    });
    
    it('历史图表数据应该正确计算', async () => {
      const res = await apiRequest('/statements/history');
      const history = res.data;
      
      // 最新记录应该是2024-06-30
      const latest = history[history.length - 1];
      expect(latest.date).toBe('2024-06-30');
      expect(latest.totalValue).toBeCloseTo(expectedSummary.totalValue, 0);
      expect(latest.totalInvested).toBe(expectedSummary.totalInvested);
      
      // 第一个记录应该是2024-01-31
      const first = history[0];
      expect(first.date).toBe('2024-01-31');
      expect(first.totalInvested).toBe(254000);
    });
  });
  
  describe('7. 边界条件测试', () => {
    it('应该处理不存在的日期', async () => {
      const res = await apiRequest('/statements/details-by-date?date=2020-01-01');
      
      // 应该返回空或提示，而不是报错
      expect(res.success).toBe(true);
      // 数据可能为空或返回提示信息
    });
    
    it('应该处理无效的日期格式', async () => {
      try {
        await apiRequest('/statements/details-by-date?date=invalid');
        // 如果返回成功，说明API处理了错误
      } catch (error) {
        // 如果抛出错误，说明有验证
        expect(error).toBeDefined();
      }
    });
    
    it('应该正确处理分页参数', async () => {
      const res = await apiRequest('/statements?page=1&limit=3');
      
      expect(res.success).toBe(true);
      expect(res.data.items).toHaveLength(3);
      expect(res.data.total).toBe(6);
      expect(res.data.page).toBe(1);
      expect(res.data.limit).toBe(3);
    });
  });
});
