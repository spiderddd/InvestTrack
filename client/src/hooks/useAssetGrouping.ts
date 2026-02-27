
import { useState, useMemo, useEffect } from 'react';
import { Asset, MonthlyStatement, StrategyVersion, AssetCategory, StrategyLayer, StrategyTarget, Holdings, HoldingsItem } from '@shared/types';
import { Layers, HelpCircle, TrendingUp, Briefcase, Landmark, Coins, Wallet } from 'lucide-react';
import { StorageService } from '../services/storageService';

const CATEGORIES: { value: AssetCategory; label: string; icon: any; color: string }[] = [
  { value: 'security', label: '股票/证券', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  { value: 'fund', label: '基金/ETF', icon: Briefcase, color: 'text-indigo-600 bg-indigo-50' },
  { value: 'wealth', label: '银行理财', icon: Landmark, color: 'text-cyan-600 bg-cyan-50' },
  { value: 'gold', label: '黄金/商品', icon: Coins, color: 'text-amber-600 bg-amber-50' },
  { value: 'fixed', label: '现金/存款', icon: Wallet, color: 'text-slate-600 bg-slate-50' },
  { value: 'crypto', label: '加密货币', icon: Briefcase, color: 'text-purple-600 bg-purple-50' }, 
  { value: 'other', label: '其他资产', icon: Briefcase, color: 'text-pink-600 bg-pink-50' },
];

const LAYER_COLORS = ['text-blue-600 bg-blue-50', 'text-amber-600 bg-amber-50', 'text-emerald-600 bg-emerald-50', 'text-rose-600 bg-rose-50', 'text-purple-600 bg-purple-50'];

interface AssetPerformance {
  quantity: number;
  marketValue: number;
  totalCost: number;
  unitPrice: number;
  date: string;
  isHistorical: boolean;
}

export const useAssetGrouping = (assets: Asset[], propsStatements: MonthlyStatement[], strategies: StrategyVersion[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showHeldOnly, setShowHeldOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<'category' | 'layer'>('category');
  const [selectedDate, setSelectedDate] = useState<string>('latest');

  // States to hold server-fetched data
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [viewHoldings, setViewHoldings] = useState<Holdings | null>(null);

  // 1. Fetch available dates (Lightweight)
  useEffect(() => {
    StorageService.getMonthlyStatementDates().then(dates => setAvailableDates(dates));
  }, []);

  // 2. Fetch holdings when date changes (On-Demand Calculation)
  useEffect(() => {
    const fetchHoldings = async () => {
      let targetDate = selectedDate;

      if (selectedDate === 'latest') {
        // Use today's date for real-time portfolio view with latest prices
        targetDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
      }

      const holdings = await StorageService.getHoldingsByDate(targetDate);
      setViewHoldings(holdings);
    };
    fetchHoldings();
  }, [selectedDate, propsStatements]);

  const activeStrategy = useMemo(() => {
      return strategies.find(s => s.status === 'active') || strategies[strategies.length - 1];
  }, [strategies]);

  // Optimized: Map directly from the fetched holdings
  const assetPerformanceMap = useMemo(() => {
    const map = new Map<string, AssetPerformance>();

    if (viewHoldings && viewHoldings.assets) {
        viewHoldings.assets.forEach((a: HoldingsItem) => {
             const marketValue = a.quantity * a.unitPrice;
             map.set(a.assetId, {
                    quantity: a.quantity,
                    marketValue: marketValue,
                    totalCost: a.totalCost,
                    unitPrice: a.unitPrice,
                    date: viewHoldings.date,
                    isHistorical: selectedDate !== 'latest'
                });
        });
    }
    return map;
  }, [viewHoldings, selectedDate]);

  const displaySections = useMemo(() => {
    let sections: any[] = [];

    if (groupBy === 'category') {
        sections = CATEGORIES.map(c => ({
            id: c.value,
            label: c.label,
            icon: c.icon,
            color: c.color,
            items: []
        }));
    } else {
        if (activeStrategy && activeStrategy.layers) {
            sections = activeStrategy.layers.map((l: StrategyLayer, idx) => ({
                id: l.id,
                label: l.name,
                icon: Layers,
                color: LAYER_COLORS[idx % LAYER_COLORS.length],
                items: []
            }));
        }
        sections.push({
            id: 'unassigned',
            label: '未分配 / 其他',
            icon: HelpCircle,
            color: 'text-slate-400 bg-slate-100',
            items: []
        });
    }

    const assetToSectionMap = new Map<string, string>(); 

    if (groupBy === 'layer' && activeStrategy) {
        activeStrategy.layers.forEach((l: StrategyLayer) => {
            l.items.forEach((t: StrategyTarget) => {
                assetToSectionMap.set(t.assetId, l.id);
            });
        });
    }

    assets.forEach(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (asset.ticker && asset.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return;

        if (showHeldOnly && !assetPerformanceMap.has(asset.id)) {
            return;
        }

        let sectionIndex = -1;
        
        if (groupBy === 'category') {
             sectionIndex = sections.findIndex(s => s.id === asset.type);
        } else {
             const layerId = assetToSectionMap.get(asset.id);
             if (layerId) {
                 sectionIndex = sections.findIndex(s => s.id === layerId);
             } else {
                 sectionIndex = sections.length - 1; 
             }
        }

        if (sectionIndex !== -1) {
            sections[sectionIndex].items.push(asset);
        }
    });

    sections.forEach(sec => {
        sec.items.sort((a: Asset, b: Asset) => {
            const valA = assetPerformanceMap.get(a.id)?.marketValue || 0;
            const valB = assetPerformanceMap.get(b.id)?.marketValue || 0;
            return valB - valA; 
        });
    });

    return sections.filter(s => s.items.length > 0);

  }, [assets, searchTerm, assetPerformanceMap, showHeldOnly, groupBy, activeStrategy]);

  return {
      searchTerm, setSearchTerm,
      showHeldOnly, setShowHeldOnly,
      groupBy, setGroupBy,
      selectedDate, setSelectedDate,
      availableDates,
      activeStrategy,
      assetPerformanceMap,
      displaySections,
      CATEGORIES
  };
}
