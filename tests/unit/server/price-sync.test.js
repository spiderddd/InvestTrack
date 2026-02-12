/**
 * PriceSyncService Tests
 * 
 * Tests for price synchronization logic including:
 * - fetchStockPrice: Stock price fetching (with mocked API)
 * - makeSecid logic verification through fetchStockPrice
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock undici before importing the service
vi.mock('undici', () => ({
  fetch: vi.fn(),
  ProxyAgent: vi.fn()
}));

// Mock the service modules
vi.mock('../../../server/services/assetService.js', () => ({
  AssetService: {
    getByType: vi.fn(),
    getAll: vi.fn(),
    updatePrice: vi.fn(),
    getLatestPrice: vi.fn()
  }
}));

vi.mock('../../../server/utils/cache.js', () => ({
  lruCache: {
    delete: vi.fn()
  }
}));

import { fetch } from 'undici';
import { PriceSyncService } from '../../../server/services/priceSyncService.js';
import { AssetService } from '../../../server/services/assetService.js';

describe('PriceSyncService - Stock Price Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Exchange Detection (makeSecid logic)', () => {
    it('should use Shanghai prefix (1.) for stocks starting with 6', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: '招商银行', f43: 3585, f60: 3550 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('600036');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=1.600036');
    });

    it('should use Shanghai prefix (1.) for funds starting with 5', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: '沪深300ETF', f43: 4500, f60: 4480 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('510300');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=1.510300');
    });

    it('should use Shanghai prefix (1.) for B-shares starting with 9', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: 'Test B-Share', f43: 1000, f60: 990 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('900901');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=1.900901');
    });

    it('should use Shenzhen prefix (0.) for stocks starting with 0', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: '平安银行', f43: 1050, f60: 1040 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('000001');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=0.000001');
    });

    it('should use Shenzhen prefix (0.) for stocks starting with 3 (ChiNext)', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: '创业板股票', f43: 2500, f60: 2480 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('300001');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=0.300001');
    });

    it('should use Shenzhen prefix (0.) for stocks starting with 2 (SME)', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: '中小板股票', f43: 1500, f60: 1480 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      await PriceSyncService.fetchStockPrice('002001');

      const callUrl = fetch.mock.calls[0][0];
      expect(callUrl).toContain('secid=0.002001');
    });
  });

  describe('Real-time Price Fetching', () => {
    it('should return parsed price and name on success', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            f58: '招商银行',
            f43: 3585,  // Price in cents
            f60: 3550   // Previous close
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await PriceSyncService.fetchStockPrice('600036');

      expect(result).toEqual({
        name: '招商银行',
        price: 35.85
      });
    });

    it('should fallback to historical API when real-time returns no data', async () => {
      // First call returns empty data
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: null })
      });

      // Second call (historical) succeeds
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            klines: [`20240101,10.0,11.0,9.0,10.5,1000,10500`]
          }
        })
      });

      const result = await PriceSyncService.fetchStockPrice('600036');

      expect(fetch).toHaveBeenCalledTimes(2);
      // Second call should be to historical API
      const secondCallUrl = fetch.mock.calls[1][0];
      expect(secondCallUrl).toContain('push2his.eastmoney.com');
    });

    it('should fallback to historical API when real-time fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            klines: [`20240101,10.0,11.0,9.0,10.5,1000,10500`]
          }
        })
      });

      const result = await PriceSyncService.fetchStockPrice('600036');

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when both APIs fail', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await PriceSyncService.fetchStockPrice('600036');

      expect(result).toBeNull();
    });

    it('should return null when response data is invalid', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { f43: 0 } })
      });

      const result = await PriceSyncService.fetchStockPrice('600036');

      // Should fallback to historical, which also fails
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Stock Price Synchronization', () => {
    it('should sync prices for all stock assets', async () => {
      const stockAssets = [
        { id: 'stock-1', name: '招商银行', ticker: '600036', type: 'security' },
        { id: 'stock-2', name: '平安银行', ticker: '000001', type: 'security' }
      ];

      AssetService.getAll.mockResolvedValue(stockAssets);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: 'Test Stock', f43: 3500, f60: 3400 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await PriceSyncService.syncStockPrices();

      expect(result.assetsUpdated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.type).toBe('stock');
    });

    it('should skip assets that fail to fetch price', async () => {
      const stockAssets = [
        { id: 'stock-1', name: 'Good Stock', ticker: '600036', type: 'security' },
        { id: 'stock-2', name: 'Bad Stock', ticker: '999999', type: 'security' }
      ];

      AssetService.getAll.mockResolvedValue(stockAssets);

      // First call succeeds, second fails
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: { f58: 'Good', f43: 3500, f60: 3400 }
          })
        })
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await PriceSyncService.syncStockPrices();

      expect(result.assetsUpdated).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should return empty result when no stock assets', async () => {
      AssetService.getAll.mockResolvedValue([]);

      const result = await PriceSyncService.syncStockPrices();

      expect(result.assetsUpdated).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should only process security assets with ticker', async () => {
      const assets = [
        { id: 'stock-1', name: 'With Ticker', ticker: '600036', type: 'security' },
        { id: 'stock-2', name: 'No Ticker', ticker: '', type: 'security' },
        { id: 'fund-1', name: 'Fund', type: 'fund' }
      ];

      AssetService.getAll.mockResolvedValue(assets);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { f58: 'Test', f43: 3500, f60: 3400 }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await PriceSyncService.syncStockPrices();

      // Only processes security assets with ticker
      expect(result.assetsUpdated).toBe(1);
    });
  });
});

describe('PriceSyncService - Gold Price Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no gold assets exist', async () => {
    AssetService.getByType.mockResolvedValue([]);

    const result = await PriceSyncService.syncGoldPrices();

    expect(result).toBeNull();
  });

  it('should return latest gold price', async () => {
    AssetService.getByType.mockResolvedValue([{ id: 'gold-1', type: 'gold' }]);
    AssetService.getLatestPrice.mockResolvedValue({ price: 480.50, date: '2026-02-12' });

    const result = await PriceSyncService.getGoldPrice();

    expect(result.price).toBe(480.50);
  });

  it('should return null when no gold assets for getGoldPrice', async () => {
    AssetService.getByType.mockResolvedValue([]);

    const result = await PriceSyncService.getGoldPrice();

    expect(result).toBeNull();
  });
});

describe('PriceSyncService - syncAllPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attempt to sync both gold and stock prices', async () => {
    // Setup gold - no gold assets
    AssetService.getByType.mockResolvedValue([]);
    
    // Setup stock sync
    AssetService.getAll.mockResolvedValue([
      { id: 'stock-1', name: 'Test Stock', ticker: '600036', type: 'security' }
    ]);

    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { f58: 'Test', f43: 3500, f60: 3400 }
      })
    });

    const result = await PriceSyncService.syncAllPrices();

    // Gold returns null (no assets), stock succeeds
    expect(result.gold).toBeNull();
    expect(result.stock).toBeDefined();
    expect(result.stock.assetsUpdated).toBe(1);
  });

  it('should handle stock sync failure gracefully', async () => {
    // Gold - no assets
    AssetService.getByType.mockResolvedValue([]);
    
    // Stock fails
    AssetService.getAll.mockRejectedValue(new Error('DB error'));

    const result = await PriceSyncService.syncAllPrices();

    expect(result.gold).toBeNull();
    expect(result.stock.error).toBeDefined();
  });
});
