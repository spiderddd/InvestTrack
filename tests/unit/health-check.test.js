/**
 * Health check test - verifies Vitest is configured correctly
 * This test should always pass
 */

import { describe, it, expect } from 'vitest';
import { 
  testAssets, 
  testStrategies, 
  testStatements, 
  testTransactions,
  getAssetById,
  getStrategyById,
  getCumulativePosition 
} from '../fixtures/index.js';

describe('Vitest Configuration', () => {
  it('should run basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });
  
  it('should handle async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
  
  it('should work with arrays and objects', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
    
    const obj = { name: 'test', value: 123 };
    expect(obj).toHaveProperty('name');
    expect(obj.name).toBe('test');
  });
  
  it('should handle floating point comparisons', () => {
    const result = 0.1 + 0.2;
    expect(result).toBeCloseTo(0.3, 5);
  });
});

describe('Fixtures Loading', () => {
  it('should import test fixtures', () => {
    expect(testAssets).toBeDefined();
    expect(testAssets.length).toBeGreaterThan(0);
    
    expect(testStrategies).toBeDefined();
    expect(testStrategies.length).toBeGreaterThan(0);
    
    expect(testStatements).toBeDefined();
    expect(testStatements.length).toBeGreaterThan(0);
  });
  
  it('should have valid asset fixtures', () => {
    const asset = testAssets[0];
    expect(asset).toHaveProperty('id');
    expect(asset).toHaveProperty('name');
    expect(asset).toHaveProperty('category');
    
    const found = getAssetById(asset.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(asset.id);
  });
  
  it('should have valid strategy fixtures', () => {
    const strategy = testStrategies[0];
    expect(strategy).toHaveProperty('id');
    expect(strategy).toHaveProperty('name');
    expect(strategy).toHaveProperty('versions');
    expect(strategy.versions.length).toBeGreaterThan(0);
    
    const found = getStrategyById(strategy.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(strategy.id);
  });
  
  it('should have valid transaction fixtures', () => {
    expect(testTransactions.length).toBeGreaterThan(0);
    
    // Test cumulative position calculation
    const position = getCumulativePosition('asset-stock-1', '2024-06-30');
    expect(position).toHaveProperty('quantity');
    expect(position).toHaveProperty('cost');
    expect(typeof position.quantity).toBe('number');
    expect(typeof position.cost).toBe('number');
  });
});
