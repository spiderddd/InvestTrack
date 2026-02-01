
import { StrategyVersion, SnapshotItem, Asset } from '../types';

const API_BASE = '/api'; 

export const generateId = (): string => {
  // Use modern crypto API for consistent ID generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const StorageService = {
  // --- Dashboard API (New) ---
  getDashboardMetrics: async (viewMode: string, timeRange: string) => {
      try {
          const res = await fetch(`${API_BASE}/dashboard/metrics?viewMode=${viewMode}&timeRange=${timeRange}`);
          if (!res.ok) throw new Error('Failed to fetch metrics');
          return await res.json();
      } catch (e) { console.error(e); return { endValue: 0, endInvested: 0, profit: 0, returnRate: 0 }; }
  },

  getDashboardAllocation: async (viewMode: string, layerId: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/allocation?viewMode=${viewMode}`;
          if (layerId) url += `&layerId=${layerId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch allocation');
          return await res.json();
      } catch (e) { console.error(e); return []; }
  },

  getDashboardTrend: async (viewMode: string, layerId: string | null, startDate: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/trend?viewMode=${viewMode}`;
          if (layerId) url += `&layerId=${layerId}`;
          if (startDate) url += `&startDate=${startDate}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch trend');
          return await res.json();
      } catch (e) { console.error(e); return []; }
  },

  getDashboardBreakdown: async (viewMode: string, timeRange: string, layerId: string | null) => {
      try {
          let url = `${API_BASE}/dashboard/breakdown?viewMode=${viewMode}&timeRange=${timeRange}`;
          if (layerId) url += `&layerId=${layerId}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch breakdown');
          return await res.json();
      } catch (e) { console.error(e); return []; }
  },

  // --- Assets ---
  getAssets: async (): Promise<Asset[]> => {
    try {
      const res = await fetch(`${API_BASE}/assets`);
      if (!res.ok) throw new Error('Failed to fetch assets');
      return await res.json();
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
        return await res.json();
    } catch (e) { console.error(e); return []; }
  },

  // --- Strategies ---
  getStrategyVersions: async (): Promise<StrategyVersion[]> => {
    try {
      const res = await fetch(`${API_BASE}/strategies`);
      if (!res.ok) throw new Error('Failed to fetch strategies');
      return await res.json();
    } catch (e) { console.error(e); return []; }
  },

  // Encapsulated Business Logic: Sync Strategies (Diffing)
  syncStrategies: async (currentList: StrategyVersion[], newVersions: StrategyVersion[]) => {
      const oldIds = new Set(currentList.map(v => v.id));
      const newIds = new Set(newVersions.map(v => v.id));

      // 1. Handle Creates & Updates
      for (const v of newVersions) {
          const old = currentList.find(o => o.id === v.id);
          if (!old) {
              await fetch(`${API_BASE}/strategies`, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(v)
              });
          } else if (JSON.stringify(old) !== JSON.stringify(v)) {
              await fetch(`${API_BASE}/strategies/${v.id}`, {
                  method: 'PUT',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(v)
              });
          }
      }

      // 2. Handle Deletes
      for (const old of currentList) {
          if (!newIds.has(old.id)) {
              await fetch(`${API_BASE}/strategies/${old.id}`, { method: 'DELETE' });
          }
      }
  },

  // Low-level method (Internal use or specific overrides)
  createStrategy: async (strategy: StrategyVersion) => {
    await fetch(`${API_BASE}/strategies`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(strategy)
    });
  },

  // --- Snapshots ---
  
  // Gets Lightweight List (For List View) - Paginated
  getSnapshots: async (page: number = 1, limit: number = 20): Promise<{ items: SnapshotItem[], total: number }> => {
    try {
      const res = await fetch(`${API_BASE}/snapshots?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      return await res.json();
    } catch (e) { console.error(e); return { items: [], total: 0 }; }
  },

  // Gets Lightweight Assets History (For Charting)
  getSnapshotsHistory: async (): Promise<SnapshotItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/snapshots/history`);
      if (!res.ok) throw new Error('Failed to fetch snapshots history');
      return await res.json();
    } catch (e) { console.error(e); return []; }
  },

  // Gets Full Details (For Single View)
  getSnapshot: async (id: string): Promise<SnapshotItem | null> => {
    try {
        const res = await fetch(`${API_BASE}/snapshots/${id}`);
        if (!res.ok) throw new Error('Failed to fetch snapshot details');
        return await res.json();
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
