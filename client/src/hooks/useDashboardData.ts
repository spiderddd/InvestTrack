
import { useState, useMemo, useEffect } from 'react';
import { StrategyVersion, MonthlyStatement, Position } from '@shared/types';
import { StorageService } from '../services/storageService';

type ViewMode = 'strategy' | 'total';
type TimeRange = 'all' | 'ytd' | '1y';

export const useDashboardData = (strategies: StrategyVersion[], statements: MonthlyStatement[]) => {
  const [viewMode, setViewMode] = useState<ViewMode>('strategy');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Data States
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [endMetrics, setEndMetrics] = useState({ value: 0, invested: 0, profit: 0, returnRate: 0, periodLabel: '...' });
  const [startMetrics, setStartMetrics] = useState({ value: 0, invested: 0 }); // Legacy support
  const [allocationData, setAllocationData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [breakdownData, setBreakdownData] = useState<any[]>([]);

  // Derived State for UI Labels
  const rangeConfig = useMemo(() => {
    if (timeRange === 'all') return { startDate: null, label: '历史累计' };
    const now = new Date();
    let start = new Date();
    if (timeRange === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString().slice(0, 7), label: '今年以来' };
    } else {
      start = new Date(now);
      start.setFullYear(now.getFullYear() - 1); 
      return { startDate: start.toISOString().slice(0, 7), label: '近一年' };
    }
  }, [timeRange]);

  const activeStrategyEnd = useMemo(() => {
      // Find the active strategy or the latest one
      if (strategies.length === 0) return null;
      const active = strategies.find(s => s.status === 'active');
      if (active) return active;
      // Sort by startDate descending and return the first one
      return [...strategies].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  }, [strategies]);

  // Fetch Data Effect - Optimized to single request
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
        setLoadingDetails(true);
        try {
            // OPTIMIZATION: Fetch Overview (Metrics + Allocation + Trend) in one go
            // Breakdown is fetched separately as it can be heavy and distinct from visualization
            const [overview, breakdown] = await Promise.all([
                StorageService.getDashboardOverview(viewMode, timeRange, selectedLayerId, rangeConfig.startDate),
                StorageService.getDashboardBreakdown(viewMode, timeRange, selectedLayerId)
            ]);

            if (isMounted) {
                const { metrics, allocation, trend } = overview;

                setEndMetrics({
                    value: metrics?.endValue ?? 0,
                    invested: metrics?.endInvested ?? 0,
                    profit: metrics?.profit ?? 0,
                    returnRate: metrics?.returnRate ?? 0,
                    periodLabel: metrics?.periodLabel ?? '...'
                });
                setStartMetrics({ value: 0, invested: 0 }); 

                setAllocationData(allocation ?? []);
                setHistoryData(trend ?? []);
                // Handle new API format: { items, totals }
                setBreakdownData(breakdown?.items ?? []);
                setBreakdownTotals(breakdown?.totals ?? { endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0, roi: 0 });
            }
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            if (isMounted) setLoadingDetails(false);
        }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [viewMode, timeRange, selectedLayerId, rangeConfig.startDate]);

  // Use backend-provided totals instead of recalculating
  const [breakdownTotals, setBreakdownTotals] = useState({ endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0, roi: 0 });

  // Determine start/end statement labels for UI (approximate from props is fine for labels)
  const uiStatements = useMemo(() => {
      const sorted = [...statements].sort((a: MonthlyStatement, b: MonthlyStatement) => a.date.localeCompare(b.date));
      const end = sorted[sorted.length - 1] || null;
      let start = null;
      if (rangeConfig.startDate) {
          start = sorted.find(s => s.date >= rangeConfig.startDate!) || sorted[0];
      }
      return { start, end };
  }, [statements, rangeConfig]);

  return {
    viewMode, setViewMode,
    timeRange, setTimeRange,
    selectedLayerId, setSelectedLayerId,
    rangeConfig,
    startStatement: uiStatements.start,
    endStatement: uiStatements.end,
    loadingDetails,
    endMetrics, 
    startMetrics, // Kept for interface compatibility
    activeStrategyEnd,
    allocationData,
    historyData,
    breakdownData,
    breakdownTotals
  };
};
