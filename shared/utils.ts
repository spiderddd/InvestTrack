/**
 * Shared utility functions for strategy calculations
 * Used by both frontend and backend
 */

import { StrategyVersion, StrategyLayer, StrategyTarget } from './types';

/**
 * Get the appropriate strategy version for a given date
 * Returns the latest version that started on or before the target date
 * 
 * @param versions - Array of strategy versions
 * @param dateStr - Date string in YYYY-MM-DD or YYYY-MM format
 * @returns The matching StrategyVersion or null
 */
export const getStrategyForDate = (versions: StrategyVersion[], dateStr: string): StrategyVersion | null => {
  if (!versions || versions.length === 0) return null;

  // Filter out archived strategies, prefer active ones
  const activeVersions = versions.filter(v => v.status === 'active');
  const versionsToUse = activeVersions.length > 0 ? activeVersions : versions;

  const sorted = [...versionsToUse].sort((a, b) => b.startDate.localeCompare(a.startDate));

  let targetDate: string;
  if (dateStr.length === 7) {
    // YYYY-MM format - use last day of month
    const [y, m] = dateStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    targetDate = `${dateStr}-${lastDay.toString().padStart(2, '0')}`;
  } else {
    targetDate = dateStr;
  }

  return sorted.find(v => v.startDate <= targetDate) || sorted[sorted.length - 1];
};

/**
 * Create a mapping from assetId to strategy target and layer information
 * 
 * @param strategy - The strategy version
 * @returns Map with assetId as key and { target, layerId } as value
 */
export const getAssetTargetMap = (strategy: StrategyVersion | null): Map<string, { target: StrategyTarget; layerId: string }> => {
  const map = new Map<string, { target: StrategyTarget; layerId: string }>();

  if (!strategy || !strategy.layers) return map;

  strategy.layers.forEach(layer => {
    if (layer.items) {
      layer.items.forEach(target => {
        map.set(target.assetId, { target, layerId: layer.id });
      });
    }
  });

  return map;
};

/**
 * Calculate auto weight for strategy targets within a layer
 * Auto targets have weight === -1 and share remaining weight equally
 * 
 * @param layer - The strategy layer
 * @returns Object with fixedWeightSum, autoItemCount, and calculatedAutoWeight
 */
export const calculateAutoWeights = (layer: StrategyLayer): {
  fixedWeightSum: number;
  autoItemCount: number;
  calculatedAutoWeight: number;
} => {
  if (!layer.items || layer.items.length === 0) {
    return { fixedWeightSum: 0, autoItemCount: 0, calculatedAutoWeight: 0 };
  }

  const fixedItems = layer.items.filter(t => t.weight >= 0);
  const autoItems = layer.items.filter(t => t.weight === -1);

  const fixedWeightSum = fixedItems.reduce((sum, t) => sum + t.weight, 0);
  const remainingWeight = Math.max(0, 100 - fixedWeightSum);
  const calculatedAutoWeight = autoItems.length > 0 ? (remainingWeight / autoItems.length) : 0;

  return {
    fixedWeightSum,
    autoItemCount: autoItems.length,
    calculatedAutoWeight
  };
};

/**
 * Get the effective target weight for a strategy target
 * Returns the configured weight or calculated auto weight
 * 
 * @param target - The strategy target
 * @param calculatedAutoWeight - The auto-calculated weight (for auto targets)
 * @returns The effective weight
 */
export const getEffectiveTargetWeight = (target: StrategyTarget, calculatedAutoWeight: number): number => {
  return target.weight === -1 ? calculatedAutoWeight : target.weight;
};
