
import { StatementService } from './statementService.js';
import { StrategyService } from './strategyService.js';
import { AssetService } from './assetService.js';

// Helpers
const CATEGORY_COLORS = {
  '股票基金': '#3b82f6', 
  '商品另类': '#f59e0b', 
  '现金固收': '#64748b', 
  '其他': '#a855f7'
};

const LAYER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

const getStrategyForDate = (versions, dateStr) => {
    if (!versions || versions.length === 0) return null;
    
    // Filter out archived strategies, prefer active ones
    const activeVersions = versions.filter(v => v.status === 'active');
    const versionsToUse = activeVersions.length > 0 ? activeVersions : versions;
    
    const sorted = [...versionsToUse].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const targetDate = dateStr.length === 7 ? `${dateStr}-31` : dateStr;
    return sorted.find(v => v.startDate <= targetDate) || sorted[sorted.length - 1]; 
};

const getAssetTargetMap = (strategy) => {
    const map = new Map();
    if (!strategy || !strategy.layers) return map;
    strategy.layers.forEach(layer => {
        if(layer.items) {
            layer.items.forEach(target => {
                map.set(target.assetId, { target, layerId: layer.id });
            });
        }
    });
    return map;
};

export const DashboardService = {
    // Aggregated Endpoint to reduce network roundtrips
    getOverview: async ({ viewMode, timeRange, layerId, startDate }) => {
        // 1. Fetch Metrics
        const metrics = await DashboardService.getMetrics({ viewMode, timeRange });
        
        // 2. Fetch Allocation
        const allocation = await DashboardService.getAllocation({ viewMode, layerId });
        
        // 3. Fetch Trend
        const trend = await DashboardService.getTrend({ viewMode, layerId, startDate });

        // Note: Breakdown is usually displayed in a separate tab or below fold, 
        // and might be heavy, so we keep it optional or fetch it separately if needed.
        // For now, we return these three core components.
        return {
            metrics,
            allocation,
            trend
        };
    },

    // 1. 核心指标 (Metrics) - Uses real-time prices for current value
    getMetrics: async ({ viewMode, timeRange }) => {
        const { items: statements } = await StatementService.getList(1, 1000);
        if (statements.length === 0) return { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 };

        const sorted = statements.sort((a, b) => a.date.localeCompare(b.date));

        // Get real-time current portfolio
        const today = new Date().toISOString().slice(0, 10);
        const realTimeStatement = await StatementService.getDetailsByPeriod(today);

        let startStatementSimple = null;
        if (timeRange === 'ytd') {
            const currentYear = new Date().getFullYear();
            startStatementSimple = sorted.find(s => s.date.startsWith(currentYear.toString())) || sorted[0];
            // If the first statement of the year is the same as the end (Jan), try to find prev Dec
            if(startStatementSimple && sorted.length > 1) {
                 const idx = sorted.indexOf(startStatementSimple);
                 if(idx > 0 && sorted[idx].date === startStatementSimple.date) {
                     startStatementSimple = sorted[idx-1];
                 }
            }
        } else if (timeRange === '1y') {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const dateStr = oneYearAgo.toISOString().slice(0, 10);
            startStatementSimple = sorted.find(s => s.date >= dateStr) || sorted[0];
        }

        // For start period, use historical statement
        const startDetails = startStatementSimple ? await StatementService.getDetails(startStatementSimple.id) : null;

        const strategies = await StrategyService.getAll();

        const filterStrategyAssets = (statement, useRealTime = false) => {
            if (!statement) return { v: 0, i: 0 };

            const assets = statement.assets || [];
            let filteredAssets = assets;

            if (viewMode !== 'total') {
                const activeStrat = getStrategyForDate(strategies, useRealTime ? today : statement.date);
                const map = getAssetTargetMap(activeStrat);
                filteredAssets = assets.filter(a => map.has(a.assetId));
            }

            return {
                v: filteredAssets.reduce((sum, a) => sum + a.marketValue, 0),
                i: filteredAssets.reduce((sum, a) => sum + a.totalCost, 0)
            };
        };

        // End value uses real-time statement with latest prices
        const endM = filterStrategyAssets(realTimeStatement, true);
        // Start value uses historical statement
        const startM = filterStrategyAssets(startDetails, false);

        const profit = (endM.v - endM.i) - (startM.v - startM.i);
        // 区间收益率：全部时间用期末投入，区间用期初投入
        const returnRate = timeRange === 'all'
          ? (endM.i > 0 ? (profit / endM.i) * 100 : 0)
          : (startM.i > 0 ? (profit / startM.i) * 100 : 0);

        return {
            endValue: endM.v,
            endInvested: endM.i,
            startValue: startM.v,
            startInvested: startM.i,
            profit,
            returnRate,
            periodLabel: timeRange === 'all' ? '历史累计' : (timeRange === 'ytd' ? '今年以来' : '近一年')
        };
    },

    // 2. 资产分布 (Allocation) - Uses latest real-time prices
    getAllocation: async ({ viewMode, layerId }) => {
        const today = new Date().toISOString().slice(0, 10);

        // Get real-time portfolio with latest prices (similar to AssetManager)
        const realTimeStatement = await StatementService.getDetailsByPeriod(today);
        if (!realTimeStatement || !realTimeStatement.assets) return [];

        const assets = realTimeStatement.assets;
        const totalValue = assets.reduce((sum, a) => sum + a.marketValue, 0);
        
        // 1. Total View
        if (viewMode === 'total') {
            const grouped = assets.reduce((acc, curr) => {
                let cat = '其他';
                switch (curr.category) {
                  case 'security': case 'fund': cat = '股票基金'; break;
                  case 'fixed': case 'wealth': cat = '现金固收'; break;
                  case 'gold': case 'crypto': cat = '商品另类'; break;
                  default: cat = '其他';
                }
                acc[cat] = (acc[cat] || 0) + curr.marketValue;
                return acc;
            }, {});

            return Object.keys(grouped).map(key => ({
                name: key,
                value: grouped[key],
                percent: totalValue > 0 ? parseFloat(((grouped[key] / totalValue) * 100).toFixed(1)) : 0,
                color: CATEGORY_COLORS[key] || '#cbd5e1'
            })).sort((a, b) => b.value - a.value);
        }

        // 2. Strategy View
        const strategies = await StrategyService.getAll();
        const activeStrategy = getStrategyForDate(strategies, today);
        
        if (!activeStrategy) return [];
        const assetTargetMap = getAssetTargetMap(activeStrategy);
        const stratTotal = assets
            .filter(a => assetTargetMap.has(a.assetId))
            .reduce((sum, a) => sum + a.marketValue, 0);

        // 2a. Layer View
        if (!layerId) {
            return activeStrategy.layers.map((layer, idx) => {
                const layerActualValue = assets.reduce((sum, asset) => {
                    const mapping = assetTargetMap.get(asset.assetId);
                    if (mapping && mapping.layerId === layer.id) {
                        return sum + asset.marketValue;
                    }
                    return sum;
                }, 0);

                const actualPercent = stratTotal > 0 ? (layerActualValue / stratTotal) * 100 : 0;
                return {
                    id: layer.id,
                    name: layer.name,
                    value: layerActualValue,
                    percent: parseFloat(actualPercent.toFixed(1)),
                    targetPercent: layer.weight,
                    color: LAYER_COLORS[idx % LAYER_COLORS.length],
                    deviation: actualPercent - layer.weight,
                    isLayer: true
                };
            }).sort((a, b) => b.targetPercent - a.targetPercent);
        } else {
            // 2b. Drill Down
            const layer = activeStrategy.layers.find(l => l.id === layerId);
            if (!layer) return [];
            
            const getTargetActualValue = (target) => {
                const targetAssets = assets.filter(a => a.assetId === target.assetId);
                return targetAssets.reduce((sum, a) => sum + a.marketValue, 0);
            };

            const layerTotalValue = layer.items.reduce((sum, t) => sum + getTargetActualValue(t), 0);
            const fixedItems = layer.items.filter(t => t.weight >= 0);
            const autoItems = layer.items.filter(t => t.weight === -1);
            const usedWeight = fixedItems.reduce((sum, t) => sum + t.weight, 0);
            const remainingWeight = Math.max(0, 100 - usedWeight);
            const calculatedAutoWeight = autoItems.length > 0 ? (remainingWeight / autoItems.length) : 0;

            return layer.items.map(t => {
                const actualValue = getTargetActualValue(t);
                const actualInnerPercent = layerTotalValue > 0 ? (actualValue / layerTotalValue) * 100 : 0;
                const targetInnerPercent = t.weight === -1 ? calculatedAutoWeight : t.weight;
                return {
                    id: t.id,
                    name: t.targetName,
                    value: actualValue,
                    percent: parseFloat(actualInnerPercent.toFixed(1)),
                    targetPercent: parseFloat(targetInnerPercent.toFixed(1)),
                    color: t.color,
                    deviation: actualInnerPercent - targetInnerPercent,
                    isLayer: false
                };
            }).sort((a, b) => b.value - a.value);
        }
    },

    // 3. 历史趋势 (Trend)
    getTrend: async ({ viewMode, layerId, startDate }) => {
        // Reuse the graph logic which builds daily/monthly asset states
        const historyGraph = await StatementService.getHistoryGraph();
        const strategies = await StrategyService.getAll();
        const latestStrat = strategies[0]; // For Layer definition lookup if needed

        let result = historyGraph.map(s => {
            let val = 0;
            let inv = 0;
            
            if (viewMode === 'total') {
                val = s.totalValue;
                inv = s.totalInvested;
            } else {
                // Strategy Mode: Check strategy at that point in time
                const stratAtTime = getStrategyForDate(strategies, s.date);
                const mapAtTime = getAssetTargetMap(stratAtTime);
                
                // If filtering by Layer
                let targetAssetIds = null;
                if (layerId && latestStrat) {
                    // Method B: Filter by Strategy at Time
                     if(stratAtTime) {
                        const layerAtTime = stratAtTime.layers.find(l => l.id === layerId); 
                        if(layerAtTime && layerAtTime.items) {
                            targetAssetIds = new Set(layerAtTime.items.map(i => i.assetId));
                        }
                     }
                }

                if (s.assets) {
                    const relevantAssets = s.assets.filter(a => {
                        const inStrategy = mapAtTime.has(a.assetId);
                        const inLayer = targetAssetIds ? targetAssetIds.has(a.assetId) : true;
                        return inStrategy && inLayer;
                    });
                    val = relevantAssets.reduce((sum, a) => sum + a.marketValue, 0);
                    inv = relevantAssets.reduce((sum, a) => sum + a.totalCost, 0);
                }
            }
            
            return { date: s.date, value: val, invested: inv };
        });

        if (startDate) {
            result = result.filter(r => r.date >= startDate);
        }
        
        return result;
    },

    // 4. 收益归因 (Attribution) - Uses real-time prices for current period
    getAttribution: async ({ viewMode, timeRange, layerId }) => {
        const { items: statements } = await StatementService.getList(1, 1000);
        if (statements.length === 0) return [];

        const sorted = statements.sort((a, b) => a.date.localeCompare(b.date));

        // For real-time end value, use today's date with latest prices
        const today = new Date().toISOString().slice(0, 10);
        const realTimeStatement = await StatementService.getDetailsByPeriod(today);
        if (!realTimeStatement) return [];

        let startStatementSimple = null;
        if (timeRange === 'ytd') {
            const currentYear = new Date().getFullYear();
            startStatementSimple = sorted.find(s => s.date.startsWith(currentYear.toString())) || sorted[0];
            if(startStatementSimple && sorted.length > 1) {
                 const idx = sorted.indexOf(startStatementSimple);
                 if(idx > 0 && sorted[idx].date === startStatementSimple.date) {
                     startStatementSimple = sorted[idx-1];
                 }
            }
        } else if (timeRange === '1y') {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const dateStr = oneYearAgo.toISOString().slice(0, 10);
            startStatementSimple = sorted.find(s => s.date >= dateStr) || sorted[0];
        }

        // End statement uses real-time prices, start statement uses historical
        const endStatement = realTimeStatement;
        const startStatement = startStatementSimple ? await StatementService.getDetails(startStatementSimple.id) : { assets: [] };

        const strategies = await StrategyService.getAll();
        const activeStrategy = getStrategyForDate(strategies, today);

        const getStats = (s, assetIds) => {
            if (!s || !s.assets) return { v: 0, c: 0 };
            const relevant = s.assets.filter(a => assetIds.has(a.assetId));
            return {
                v: relevant.reduce((sum, a) => sum + a.marketValue, 0),
                c: relevant.reduce((sum, a) => sum + a.totalCost, 0)
            };
        };

        if (viewMode === 'total') {
             const categories = ['股票基金', '现金固收', '商品另类', '其他'];
             const catMap = {
                'security': '股票基金', 'fund': '股票基金',
                'fixed': '现金固收', 'wealth': '现金固收',
                'gold': '商品另类', 'crypto': '商品另类',
                'other': '其他'
            };
            
            const calcCatStats = (s) => {
                const res = {};
                categories.forEach(c => res[c] = { v: 0, c: 0 });
                if (s && s.assets) {
                    s.assets.forEach(a => {
                        const cat = catMap[a.category] || '其他';
                        if (res[cat]) {
                            res[cat].v += a.marketValue;
                            res[cat].c += a.totalCost;
                        }
                    });
                }
                return res;
            };

            const endStats = calcCatStats(endStatement);
            const startStats = calcCatStats(startStatement);
            
            return categories.map(cat => {
                const end = endStats[cat];
                const start = startStats[cat];
                return {
                    id: cat,
                    name: cat,
                    color: CATEGORY_COLORS[cat] || '#cbd5e1',
                    endVal: end.v,
                    endCost: end.c,
                    changeVal: end.v - start.v,
                    changeInput: end.c - start.c,
                    profit: (end.v - end.c) - (start.v - start.c)
                };
            }).filter(r => r.endVal > 0 || Math.abs(r.changeVal) > 0 || Math.abs(r.profit) > 0).sort((a,b) => b.endVal - a.endVal);
        } else {
             // Strategy Breakdown
             if (!activeStrategy) return [];
             
             if (layerId) {
                const layer = activeStrategy.layers.find(l => l.id === layerId);
                if (!layer) return [];
                
                return layer.items.map(item => {
                    const assetIds = new Set([item.assetId]);
                    const end = getStats(endStatement, assetIds);
                    const start = getStats(startStatement, assetIds);

                    return {
                        id: item.id,
                        name: item.targetName,
                        color: item.color,
                        endVal: end.v,
                        endCost: end.c,
                        changeVal: end.v - start.v,
                        changeInput: end.c - start.c,
                        profit: (end.v - end.c) - (start.v - start.c)
                    };
                }).sort((a,b) => b.endVal - a.endVal);
             } else {
                return activeStrategy.layers.map((layer, idx) => {
                    const assetIds = new Set(layer.items.map(i => i.assetId));
                    const end = getStats(endStatement, assetIds);
                    const start = getStats(startStatement, assetIds);
                    
                    return {
                        id: layer.id,
                        name: layer.name,
                        color: LAYER_COLORS[idx % LAYER_COLORS.length],
                        endVal: end.v,
                        endCost: end.c,
                        changeVal: end.v - start.v,
                        changeInput: end.c - start.c,
                        profit: (end.v - end.c) - (start.v - start.c)
                    };
                });
             }
        }
    }
};
