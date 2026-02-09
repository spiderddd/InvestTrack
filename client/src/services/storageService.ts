
import { StrategyVersion, MonthlyStatement, Asset, MonthlyStatementDetail } from '@shared/types';

const API_BASE = '/api';

// 操作锁：防止并发修改策略导致数据覆盖
let isSyncingStrategies = false;

export const generateId = (): string => {
  // Use modern crypto API for consistent ID generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const StorageService = {
  // --- Dashboard API (New Consolidated) ---
  getDashboardOverview: async (viewMode: string, timeRange: string, layerId: string | null, startDate: string | null) => {
    try {
        let url = `${API_BASE}/dashboard/overview?viewMode=${viewMode}&timeRange=${timeRange}`;
        if (layerId) url += `&layerId=${layerId}`;
        if (startDate) url += `&startDate=${startDate}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch overview');
        const data = await res.json();
        return data.data || { metrics: { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 }, allocation: [], trend: [] };
    } catch (e) { 
        console.error(e); 
        return { metrics: { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 }, allocation: [], trend: [] }; 
    }
  },

  getDashboardMetrics: async (viewMode: string, timeRange: string) => {
      try {
          const res = await fetch(`${API_BASE}/dashboard/metrics?viewMode=${viewMode}&timeRange=${timeRange}`);
          if (!res.ok) throw new Error('Failed to fetch metrics');
          const data = await res.json();
          return data.data || { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 };
      } catch (e) { console.error(e); return { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 }; }
  },

  getDashboardAllocation: async (viewMode: string, layerId: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/allocation?viewMode=${viewMode}`;
          if (layerId) url += `&layerId=${layerId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch allocation');
          const data = await res.json();
          return data.data || [];
      } catch (e) { console.error(e); return []; }
  },

  getDashboardTrend: async (viewMode: string, layerId: string | null, startDate: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/trend?viewMode=${viewMode}`;
          if (layerId) url += `&layerId=${layerId}`;
          if (startDate) url += `&startDate=${startDate}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch trend');
          const data = await res.json();
          return data.data || [];
      } catch (e) { console.error(e); return []; }
  },

  getDashboardBreakdown: async (viewMode: string, timeRange: string, layerId: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/breakdown?viewMode=${viewMode}&timeRange=${timeRange}`;
          if (layerId) url += `&layerId=${layerId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch breakdown');
          const data = await res.json();
          const result = data.data || { items: [], totals: { endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0, roi: 0 } };
          // Ensure backwards compatibility
          if (Array.isArray(result)) {
              // Old API format: calculate totals from items
              const items = result;
              const totals = items.reduce((acc, row) => ({
                  endVal: acc.endVal + (row.endVal || 0),
                  endCost: acc.endCost + (row.endCost || 0),
                  changeVal: acc.changeVal + (row.changeVal || 0),
                  changeInput: acc.changeInput + (row.changeInput || 0),
                  profit: acc.profit + (row.profit || 0)
              }), { endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0 });
              totals.roi = totals.endCost > 0 ? (totals.profit / totals.endCost) * 100 : 0;
              return { items, totals };
          }
          return result;
      } catch (e) { 
          console.error(e); 
          return { items: [], totals: { endVal: 0, endCost: 0, changeVal: 0, changeInput: 0, profit: 0, roi: 0 } }; 
      }
  },

  // --- Assets ---
  getAssets: async (): Promise<Asset[]> => {
    try {
      const res = await fetch(`${API_BASE}/assets`);
      if (!res.ok) throw new Error('Failed to fetch assets');
      const data = await res.json();
      return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  createAsset: async (asset: Partial<Asset>): Promise<Asset | null> => {
    try {
      const res = await fetch(`${API_BASE}/assets`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(asset)
      });
      return await res.json();
    } catch (e) { console.error(e); return null; }
  },

  updateAsset: async (id: string, asset: Partial<Asset>): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/assets/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(asset)
      });
      return res.ok;
    } catch (e) { console.error(e); return false; }
  },

  deleteAsset: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) { console.error(e); return false; }
  },

  getAssetHistory: async (assetId: string): Promise<any[]> => {
    try {
        const res = await fetch(`${API_BASE}/assets/${assetId}/history`);
        if (!res.ok) throw new Error('Failed to fetch asset history');
        const data = await res.json();
        return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // --- Strategies ---
  getStrategyVersions: async (): Promise<StrategyVersion[]> => {
    try {
      const res = await fetch(`${API_BASE}/strategies`);
      if (!res.ok) throw new Error('Failed to fetch strategies');
      const data = await res.json();
      return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // Update strategy version metadata only
  updateStrategyVersion: async (id: string, data: { name?: string; description?: string; startDate?: string; status?: 'active' | 'archived' }): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}/version`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (e) { console.error(e); return false; }
  },

  // Update strategy layers only
  updateStrategyLayers: async (id: string, layers: StrategyVersion['layers']): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}/layers`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(layers)
      });
      return res.ok;
    } catch (e) { console.error(e); return false; }
  },

  // Update strategy targets only (grouped by layer)
  updateStrategyTargets: async (id: string, targetsByLayer: { layerId: string; items: StrategyVersion['layers'][0]['items'] }[]): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}/targets`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(targetsByLayer)
      });
      return res.ok;
    } catch (e) { console.error(e); return false; }
  },

  // Encapsulated Business Logic: Sync Strategies (Diffing)
  // 使用分层 API 更新：version -> layers -> targets
  syncStrategies: async (currentList: StrategyVersion[], newVersions: StrategyVersion[]) => {
    if (isSyncingStrategies) {
        throw new Error('策略同步操作正在进行中，请等待完成后再试');
    }

    try {
        isSyncingStrategies = true;

        const oldIds = new Set(currentList.map(v => v.id));
        const newIds = new Set(newVersions.map(v => v.id));

        // 1. Handle Creates
        for (const v of newVersions) {
            const old = currentList.find(o => o.id === v.id);
            if (!old) {
                const res = await fetch(`${API_BASE}/strategies`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(v)
                });
                if (!res.ok) throw new Error(`创建策略失败: ${v.name}`);
            }
        }

        // 2. Handle Updates (使用分层 API)
        for (const v of newVersions) {
            const old = currentList.find(o => o.id === v.id);
            if (old && JSON.stringify(old) !== JSON.stringify(v)) {
                // Update version metadata
                if (old.name !== v.name || old.description !== v.description || old.startDate !== v.startDate || old.status !== v.status || old.archivedAt !== v.archivedAt) {
                    const versionRes = await fetch(`${API_BASE}/strategies/${v.id}/version`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            name: v.name,
                            description: v.description,
                            startDate: v.startDate,
                            status: v.status,
                            archivedAt: v.archivedAt
                        })
                    });
                    if (!versionRes.ok) throw new Error(`更新策略版本失败: ${v.name}`);
                }

                // Check layers change
                const layersChanged = JSON.stringify(old.layers.map(l => ({ id: l.id, name: l.name, weight: l.weight, description: l.description }))) !==
                                     JSON.stringify(v.layers.map(l => ({ id: l.id, name: l.name, weight: l.weight, description: l.description })));

                if (layersChanged) {
                    const layersRes = await fetch(`${API_BASE}/strategies/${v.id}/layers`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(v.layers)
                    });
                    if (!layersRes.ok) throw new Error(`更新策略层级失败: ${v.name}`);
                }

                // Check targets change
                let targetsChanged = false;
                const targetsByLayer: { layerId: string; items: StrategyVersion['layers'][0]['items'] }[] = [];
                for (const newLayer of v.layers) {
                    const oldLayer = old.layers.find(l => l.id === newLayer.id);
                    if (!oldLayer || JSON.stringify(oldLayer.items) !== JSON.stringify(newLayer.items)) {
                        targetsChanged = true;
                    }
                    targetsByLayer.push({ layerId: newLayer.id, items: newLayer.items });
                }

                if (targetsChanged) {
                    const targetsRes = await fetch(`${API_BASE}/strategies/${v.id}/targets`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(targetsByLayer)
                    });
                    if (!targetsRes.ok) throw new Error(`更新策略资产失败: ${v.name}`);
                }
            }
        }

        // 3. Handle Deletes
        for (const old of currentList) {
            if (!newIds.has(old.id)) {
                const res = await fetch(`${API_BASE}/strategies/${old.id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(`删除策略失败: ${old.name}`);
            }
        }
    } finally {
        isSyncingStrategies = false;
    }
  },
  deleteStrategyVersion: async (id: string) => {
      const res = await fetch(`${API_BASE}/strategies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除策略失败');
      return res.json();
  },

  // --- Monthly Statements ---
  
  // Gets Lightweight List (For List View) - Paginated
  getMonthlyStatements: async (page: number = 1, limit: number = 20): Promise<{ items: MonthlyStatement[], total: number }> => {
    try {
      const res = await fetch(`${API_BASE}/statements?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch statements');
      const data = await res.json();
      return data.data || { items: [], total: 0 };
    } catch (e) { console.error(e); return { items: [], total: 0 }; }
  },

  // Gets Lightweight Assets History (For Charting)
  getMonthlyStatementsHistory: async (): Promise<MonthlyStatement[]> => {
    try {
      const res = await fetch(`${API_BASE}/statements/history`);
      if (!res.ok) throw new Error('Failed to fetch statements history');
      const data = await res.json();
      return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // New: Lightweight Date List (For Dropdowns)
  getMonthlyStatementDates: async (): Promise<string[]> => {
    try {
        const res = await fetch(`${API_BASE}/statements/dates`);
        if (!res.ok) throw new Error('Failed to fetch statement dates');
        const data = await res.json();
        return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // New: Get Details by Date (For Asset Manager "Time Travel")
  getMonthlyStatementByDate: async (date: string): Promise<MonthlyStatementDetail | null> => {
      try {
          const res = await fetch(`${API_BASE}/statements/details-by-date?date=${date}`);
          if (!res.ok) throw new Error('Failed to fetch statement details by date');
          const data = await res.json();
          return data.data || null;
      } catch (e) { console.error(e); return null; }
  },

  // Gets Full Details (For Single View)
  getMonthlyStatement: async (id: string): Promise<MonthlyStatementDetail | null> => {
    try {
        const res = await fetch(`${API_BASE}/statements/${id}`);
        if (!res.ok) throw new Error('Failed to fetch statement details');
        const data = await res.json();
        return data.data || null;
    } catch (e) { console.error(e); return null; }
  },

  saveMonthlyStatement: async (statement: MonthlyStatementDetail) => {
    await fetch(`${API_BASE}/statements`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(statement)
    });
  },

  // --- Helpers ---
  createDefaultStrategy: (): StrategyVersion => {
    return {
      id: generateId(),
      name: '2024 备战版策略',
      description: '# 初始化策略...',
      startDate: new Date().toISOString().slice(0, 10),
      status: 'active',
      layers: []
    };
  }
};
