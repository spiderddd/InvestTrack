
import { StrategyVersion, StrategyTarget, StrategyLayer } from '@shared/types';

export const LAYER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

export const CATEGORY_COLORS: Record<string, string> = {
  '股票基金': '#3b82f6', 
  '商品另类': '#f59e0b', 
  '现金固收': '#64748b', 
  '其他': '#a855f7'
};

// --- Core Helpers ---

export const getStrategyForDate = (versions: StrategyVersion[], dateStr: string): StrategyVersion | null => {
    if (!versions || versions.length === 0) return null;
    const sorted = [...versions].sort((a, b) => b.startDate.localeCompare(a.startDate));
    
    // 修复：正确处理YYYY-MM格式的月末日期
    let targetDate: string;
    if (dateStr.length === 7) {
        // YYYY-MM格式，获取该月最后一天
        const [year, month] = dateStr.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        targetDate = `${dateStr}-${lastDay.toString().padStart(2, '0')}`;
    } else {
        targetDate = dateStr;
    }
    
    return sorted.find(v => v.startDate <= targetDate) || sorted[sorted.length - 1];
};

export const getAssetTargetMap = (strategy: StrategyVersion | null) => {
    const map = new Map<string, { target: StrategyTarget, layerId: string }>();
    if (!strategy) return map;
    strategy.layers.forEach((layer: StrategyLayer) => {
        layer.items.forEach((target: StrategyTarget) => {
            map.set(target.assetId, { target, layerId: layer.id });
        });
    });
    return map;
};
