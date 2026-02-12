/**
 * Shared Utils Tests
 * 
 * Tests for shared utility functions:
 * - getStrategyForDate
 * - getAssetTargetMap
 * - calculateAutoWeights
 * - getEffectiveTargetWeight
 */

import { describe, it, expect } from 'vitest';
import {
  getStrategyForDate,
  getAssetTargetMap,
  calculateAutoWeights,
  getEffectiveTargetWeight
} from '../../../shared/utils';
import { StrategyVersion, StrategyLayer, StrategyTarget } from '../../../shared/types';

describe('getStrategyForDate', () => {
  const mockStrategies: StrategyVersion[] = [
    {
      id: 'v1',
      name: 'Strategy 1',
      description: 'First version',
      startDate: '2024-01-01',
      status: 'archived',
      layers: []
    },
    {
      id: 'v2',
      name: 'Strategy 2',
      description: 'Second version',
      startDate: '2024-03-15',
      status: 'active',
      layers: []
    },
    {
      id: 'v3',
      name: 'Strategy 3',
      description: 'Third version',
      startDate: '2024-06-01',
      status: 'active',
      layers: []
    }
  ];

  it('should return null for empty versions array', () => {
    const result = getStrategyForDate([], '2024-03-15');
    expect(result).toBeNull();
  });

  it('should return null for null versions', () => {
    const result = getStrategyForDate(null as any, '2024-03-15');
    expect(result).toBeNull();
  });

  it('should return the correct version for a given date (YYYY-MM-DD)', () => {
    // Date between v2 and v3 start dates
    const result = getStrategyForDate(mockStrategies, '2024-04-01');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
  });

  it('should return the correct version for YYYY-MM format', () => {
    // April 2024 - should use March 15 version
    const result = getStrategyForDate(mockStrategies, '2024-04');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
  });

  it('should return the latest version when date is after all start dates', () => {
    const result = getStrategyForDate(mockStrategies, '2024-12-31');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v3');
  });

  it('should return the earliest version when date is before all start dates', () => {
    // When date is before all versions, it falls back to the last in sorted list
    // Since we prefer active versions, and v1 is archived, only v2 and v3 are considered
    // Sorted active: v3 (06-01), v2 (03-15), last is v2
    const result = getStrategyForDate(mockStrategies, '2023-01-01');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
  });

  it('should prefer active versions over archived', () => {
    // On March 15, v2 starts (active), v1 ended (archived)
    // Since we filter to active versions only, v2 is selected
    const result = getStrategyForDate(mockStrategies, '2024-03-15');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
    
    // Same for March 20
    const result2 = getStrategyForDate(mockStrategies, '2024-03-20');
    expect(result2?.id).toBe('v2');
  });

  it('should return archived version when no active versions available', () => {
    const archivedOnly = mockStrategies.filter(s => s.status === 'archived');
    const result = getStrategyForDate(archivedOnly, '2024-02-01');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v1');
  });

  it('should handle exact start date match', () => {
    const result = getStrategyForDate(mockStrategies, '2024-03-15');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
  });

  it('should handle end of month correctly', () => {
    // 2024-02 has 29 days (leap year) -> target date is 2024-02-29
    // v1 is archived, so only v2 (03-15) and v3 (06-01) are considered
    // Both start after Feb 29, so find returns undefined and falls back to last sorted (v2)
    const result = getStrategyForDate(mockStrategies, '2024-02');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('v2');
  });
});

describe('getAssetTargetMap', () => {
  const mockStrategy: StrategyVersion = {
    id: 's1',
    name: 'Test Strategy',
    description: 'Test',
    startDate: '2024-01-01',
    status: 'active',
    layers: [
      {
        id: 'layer1',
        name: 'Core',
        weight: 60,
        items: [
          { id: 't1', assetId: 'asset-1', targetName: 'Asset 1', weight: 40, color: '#ff0000' },
          { id: 't2', assetId: 'asset-2', targetName: 'Asset 2', weight: 60, color: '#00ff00' }
        ]
      },
      {
        id: 'layer2',
        name: 'Growth',
        weight: 40,
        items: [
          { id: 't3', assetId: 'asset-3', targetName: 'Asset 3', weight: 100, color: '#0000ff' }
        ]
      }
    ]
  };

  it('should return empty map for null strategy', () => {
    const result = getAssetTargetMap(null);
    expect(result.size).toBe(0);
  });

  it('should return empty map for strategy without layers', () => {
    const strategyWithoutLayers = { ...mockStrategy, layers: [] };
    const result = getAssetTargetMap(strategyWithoutLayers);
    expect(result.size).toBe(0);
  });

  it('should create correct mapping for all assets', () => {
    const result = getAssetTargetMap(mockStrategy);
    
    expect(result.size).toBe(3);
    
    // Check asset-1
    expect(result.has('asset-1')).toBe(true);
    const mapping1 = result.get('asset-1');
    expect(mapping1?.target.id).toBe('t1');
    expect(mapping1?.layerId).toBe('layer1');
    
    // Check asset-2
    expect(result.has('asset-2')).toBe(true);
    const mapping2 = result.get('asset-2');
    expect(mapping2?.target.id).toBe('t2');
    expect(mapping2?.layerId).toBe('layer1');
    
    // Check asset-3
    expect(result.has('asset-3')).toBe(true);
    const mapping3 = result.get('asset-3');
    expect(mapping3?.target.id).toBe('t3');
    expect(mapping3?.layerId).toBe('layer2');
  });

  it('should handle layers without items', () => {
    const strategyWithEmptyLayer: StrategyVersion = {
      ...mockStrategy,
      layers: [
        ...mockStrategy.layers,
        { id: 'layer3', name: 'Empty', weight: 0, items: [] }
      ]
    };
    
    const result = getAssetTargetMap(strategyWithEmptyLayer);
    expect(result.size).toBe(3); // Still 3, empty layer adds nothing
  });

  it('should handle strategy with null layers', () => {
    const strategyWithNullLayers = { ...mockStrategy, layers: null as any };
    const result = getAssetTargetMap(strategyWithNullLayers);
    expect(result.size).toBe(0);
  });
});

describe('calculateAutoWeights', () => {
  const createMockLayer = (items: Partial<StrategyTarget>[]): StrategyLayer => ({
    id: 'layer1',
    name: 'Test Layer',
    weight: 100,
    items: items.map((item, idx) => ({
      id: `t${idx}`,
      assetId: `asset-${idx}`,
      targetName: `Asset ${idx}`,
      weight: item.weight ?? 0,
      color: '#000000',
      ...item
    })) as StrategyTarget[]
  });

  it('should return zeros for empty layer', () => {
    const layer = createMockLayer([]);
    const result = calculateAutoWeights(layer);
    
    expect(result.fixedWeightSum).toBe(0);
    expect(result.autoItemCount).toBe(0);
    expect(result.calculatedAutoWeight).toBe(0);
  });

  it('should handle all fixed weights', () => {
    const layer = createMockLayer([
      { weight: 30 },
      { weight: 40 },
      { weight: 30 }
    ]);
    const result = calculateAutoWeights(layer);
    
    expect(result.fixedWeightSum).toBe(100);
    expect(result.autoItemCount).toBe(0);
    expect(result.calculatedAutoWeight).toBe(0);
  });

  it('should calculate auto weights for all auto items', () => {
    const layer = createMockLayer([
      { weight: -1 },
      { weight: -1 },
      { weight: -1 },
      { weight: -1 }
    ]);
    const result = calculateAutoWeights(layer);
    
    expect(result.fixedWeightSum).toBe(0);
    expect(result.autoItemCount).toBe(4);
    expect(result.calculatedAutoWeight).toBe(25); // 100 / 4
  });

  it('should handle mixed fixed and auto weights', () => {
    const layer = createMockLayer([
      { weight: 30 },
      { weight: 40 },
      { weight: -1 },
      { weight: -1 }
    ]);
    const result = calculateAutoWeights(layer);
    
    expect(result.fixedWeightSum).toBe(70);
    expect(result.autoItemCount).toBe(2);
    expect(result.calculatedAutoWeight).toBe(15); // (100 - 70) / 2
  });

  it('should protect against negative remaining weight', () => {
    const layer = createMockLayer([
      { weight: 60 },
      { weight: 50 }, // Total fixed = 110%
      { weight: -1 }
    ]);
    const result = calculateAutoWeights(layer);
    
    expect(result.fixedWeightSum).toBe(110);
    expect(result.autoItemCount).toBe(1);
    expect(result.calculatedAutoWeight).toBe(0); // Math.max(0, 100 - 110) / 1
  });

  it('should handle single auto item', () => {
    const layer = createMockLayer([
      { weight: -1 }
    ]);
    const result = calculateAutoWeights(layer);
    
    expect(result.calculatedAutoWeight).toBe(100);
  });
});

describe('getEffectiveTargetWeight', () => {
  const createMockTarget = (weight: number): StrategyTarget => ({
    id: 't1',
    assetId: 'asset-1',
    targetName: 'Asset 1',
    weight,
    color: '#ff0000'
  });

  it('should return fixed weight for non-auto target', () => {
    const target = createMockTarget(30);
    const result = getEffectiveTargetWeight(target, 25);
    
    expect(result).toBe(30);
  });

  it('should return calculated auto weight for auto target (weight === -1)', () => {
    const target = createMockTarget(-1);
    const result = getEffectiveTargetWeight(target, 25);
    
    expect(result).toBe(25);
  });

  it('should return zero weight for zero fixed target', () => {
    const target = createMockTarget(0);
    const result = getEffectiveTargetWeight(target, 50);
    
    expect(result).toBe(0);
  });

  it('should handle zero auto weight', () => {
    const target = createMockTarget(-1);
    const result = getEffectiveTargetWeight(target, 0);
    
    expect(result).toBe(0);
  });
});

describe('Integration: Strategy Selection and Asset Mapping', () => {
  const complexStrategy: StrategyVersion = {
    id: 'complex',
    name: 'Complex Strategy',
    description: 'Test integration',
    startDate: '2024-01-01',
    status: 'active',
    layers: [
      {
        id: 'core',
        name: 'Core',
        weight: 60,
        items: [
          { id: 't1', assetId: 'stock-1', targetName: 'Stock 1', weight: 50, color: '#ff0000' },
          { id: 't2', assetId: 'fund-1', targetName: 'Fund 1', weight: -1, color: '#00ff00' }
        ]
      },
      {
        id: 'satellite',
        name: 'Satellite',
        weight: 40,
        items: [
          { id: 't3', assetId: 'gold-1', targetName: 'Gold', weight: -1, color: '#0000ff' }
        ]
      }
    ]
  };

  it('should correctly map assets and calculate auto weights', () => {
    // Get strategy for current date
    const strategy = getStrategyForDate([complexStrategy], '2024-06-01');
    expect(strategy).not.toBeNull();
    expect(strategy?.id).toBe('complex');

    // Get asset target map
    const assetMap = getAssetTargetMap(strategy);
    expect(assetMap.size).toBe(3);

    // Check auto weight calculation for Core layer
    const coreLayer = strategy?.layers.find(l => l.id === 'core');
    expect(coreLayer).toBeDefined();
    
    if (coreLayer) {
      const autoWeights = calculateAutoWeights(coreLayer);
      expect(autoWeights.fixedWeightSum).toBe(50);
      expect(autoWeights.autoItemCount).toBe(1);
      expect(autoWeights.calculatedAutoWeight).toBe(50);

      // Check effective weight for auto target
      const fundTarget = coreLayer.items.find(t => t.assetId === 'fund-1');
      expect(fundTarget).toBeDefined();
      
      if (fundTarget) {
        const effectiveWeight = getEffectiveTargetWeight(fundTarget, autoWeights.calculatedAutoWeight);
        expect(effectiveWeight).toBe(50);
      }
    }

    // Check Satellite layer (100% auto)
    const satelliteLayer = strategy?.layers.find(l => l.id === 'satellite');
    expect(satelliteLayer).toBeDefined();
    
    if (satelliteLayer) {
      const autoWeights = calculateAutoWeights(satelliteLayer);
      expect(autoWeights.calculatedAutoWeight).toBe(100);
    }
  });
});
