
import { StrategyVersion, SnapshotItem, Asset } from '@shared/types';

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
          return data.data || [];
      } catch (e) { console.error(e); return []; }
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

  // Encapsulated Business Logic: Sync Strategies (Diffing)
  // 修复：添加操作锁防止并发修改导致数据覆盖
  syncStrategies: async (currentList: StrategyVersion[], newVersions: StrategyVersion[]) => {
      // 检查是否已有同步操作在进行中
      if (isSyncingStrategies) {
          throw new Error('策略同步操作正在进行中，请等待完成后再试');
      }

      try {
          isSyncingStrategies = true;

          const oldIds = new Set(currentList.map(v => v.id));
          const newIds = new Set(newVersions.map(v => v.id));

          // 1. Handle Creates & Updates
          for (const v of newVersions) {
              const old = currentList.find(o => o.id === v.id);
              if (!old) {
                  const res = await fetch(`${API_BASE}/strategies`, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify(v)
                  });
                  if (!res.ok) throw new Error(`创建策略失败: ${v.name}`);
              } else if (JSON.stringify(old) !== JSON.stringify(v)) {
                  const res = await fetch(`${API_BASE}/strategies/${v.id}`, {
                      method: 'PUT',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify(v)
                  });
                  if (!res.ok) throw new Error(`更新策略失败: ${v.name}`);
              }
          }

          // 2. Handle Deletes
          for (const old of currentList) {
              if (!newIds.has(old.id)) {
                  const res = await fetch(`${API_BASE}/strategies/${old.id}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error(`删除策略失败: ${old.name}`);
              }
          }
      } finally {
          // 无论成功失败，都要释放锁
          isSyncingStrategies = false;
      }
  },

  // --- Snapshots ---
  
  // Gets Lightweight List (For List View) - Paginated
  getSnapshots: async (page: number = 1, limit: number = 20): Promise<{ items: SnapshotItem[], total: number }> => {
    try {
      const res = await fetch(`${API_BASE}/snapshots?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      const data = await res.json();
      return data.data || { items: [], total: 0 };
    } catch (e) { console.error(e); return { items: [], total: 0 }; }
  },

  // Gets Lightweight Assets History (For Charting)
  getSnapshotsHistory: async (): Promise<SnapshotItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/snapshots/history`);
      if (!res.ok) throw new Error('Failed to fetch snapshots history');
      const data = await res.json();
      return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // New: Lightweight Date List (For Dropdowns)
  getSnapshotDates: async (): Promise<string[]> => {
    try {
        const res = await fetch(`${API_BASE}/snapshots/dates`);
        if (!res.ok) throw new Error('Failed to fetch snapshot dates');
        const data = await res.json();
        return data.data || [];
    } catch (e) { console.error(e); return []; }
  },

  // New: Get Details by Date (For Asset Manager "Time Travel")
  getSnapshotByDate: async (date: string): Promise<SnapshotItem | null> => {
      try {
          const res = await fetch(`${API_BASE}/snapshots/details-by-date?date=${date}`);
          if (!res.ok) throw new Error('Failed to fetch snapshot details by date');
          const data = await res.json();
          return data.data || null;
      } catch (e) { console.error(e); return null; }
  },

  // Gets Full Details (For Single View)
  getSnapshot: async (id: string): Promise<SnapshotItem | null> => {
    try {
        const res = await fetch(`${API_BASE}/snapshots/${id}`);
        if (!res.ok) throw new Error('Failed to fetch snapshot details');
        const data = await res.json();
        return data.data || null;
    } catch (e) { console.error(e); return null; }
  },

  saveSnapshotSingle: async (snapshot: SnapshotItem) => {
    await fetch(`${API_BASE}/snapshots`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(snapshot)
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
