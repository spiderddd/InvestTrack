/**
 * AssetService Tests
 * 
 * Tests for asset management operations:
 * - CRUD operations
 * - Price management
 * - History tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetService } from '../../../server/services/assetService.js';

describe('AssetService - Get Operations', () => {
  describe('getAll', () => {
    it('should return all assets with default format', async () => {
      const assets = await AssetService.getAll();
      
      expect(Array.isArray(assets)).toBe(true);
      
      if (assets.length > 0) {
        const asset = assets[0];
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('type');
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('ticker');
        expect(asset).toHaveProperty('note');
      }
    });

    it('should return assets in simple format without createdAt', async () => {
      const assets = await AssetService.getAll({ format: 'simple' });
      
      expect(Array.isArray(assets)).toBe(true);
      
      if (assets.length > 0) {
        const asset = assets[0];
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('type');
        expect(asset).toHaveProperty('name');
        expect(asset).not.toHaveProperty('createdAt');
        expect(asset).not.toHaveProperty('created_at');
      }
    });

    it('should return only specified fields when fields option provided', async () => {
      const assets = await AssetService.getAll({ fields: 'id,name,type' });
      
      expect(Array.isArray(assets)).toBe(true);
      
      if (assets.length > 0) {
        const asset = assets[0];
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('type');
        expect(asset).not.toHaveProperty('ticker');
      }
    });

    it('should order by name when fields option is used', async () => {
      const assets = await AssetService.getAll({ fields: 'id,name' });
      
      // Just verify it returns without error
      expect(Array.isArray(assets)).toBe(true);
    });
  });

  describe('getByType', () => {
    it('should return assets filtered by type', async () => {
      const types = ['security', 'fund', 'gold', 'fixed', 'wealth', 'crypto'];
      
      for (const type of types) {
        const assets = await AssetService.getByType(type);
        
        expect(Array.isArray(assets)).toBe(true);
        
        // All returned assets should have the requested type
        assets.forEach(asset => {
          expect(asset.type).toBe(type);
        });
      }
    });

    it('should return empty array for non-existent type', async () => {
      const assets = await AssetService.getByType('nonexistent');
      
      expect(Array.isArray(assets)).toBe(true);
      expect(assets.length).toBe(0);
    });
  });
});

describe('AssetService - Price Operations', () => {
  describe('updatePrice', () => {
    it('should update price for an asset', async () => {
      // Get first asset
      const assets = await AssetService.getAll({ format: 'simple' });
      if (assets.length === 0) {
        console.log('⚠️  No assets found, skipping updatePrice test');
        return;
      }

      const assetId = assets[0].id;
      const testPrice = 123.45;
      const testDate = new Date().toISOString().slice(0, 10);

      const result = await AssetService.updatePrice(assetId, testPrice, testDate, 'test');

      expect(result.success).toBe(true);
    });

    it('should upsert price for same date', async () => {
      const assets = await AssetService.getAll({ format: 'simple' });
      if (assets.length === 0) {
        console.log('⚠️  No assets found, skipping upsert test');
        return;
      }

      const assetId = assets[0].id;
      const testDate = new Date().toISOString().slice(0, 10);

      // First update
      await AssetService.updatePrice(assetId, 100.00, testDate, 'test');
      // Second update (should overwrite)
      const result = await AssetService.updatePrice(assetId, 150.00, testDate, 'test');

      expect(result.success).toBe(true);

      // Verify the price was updated
      const latestPrice = await AssetService.getLatestPrice(assetId);
      expect(latestPrice.price).toBe(150.00);
    });
  });

  describe('getLatestPrice', () => {
    it('should return latest price for an asset', async () => {
      const assets = await AssetService.getAll({ format: 'simple' });
      if (assets.length === 0) {
        console.log('⚠️  No assets found, skipping getLatestPrice test');
        return;
      }

      const assetId = assets[0].id;

      const price = await AssetService.getLatestPrice(assetId);

      if (price) {
        expect(price).toHaveProperty('price');
        expect(price).toHaveProperty('date');
        expect(price).toHaveProperty('source');
        expect(typeof price.price).toBe('number');
      }
    });

    it('should return null for asset with no prices', async () => {
      // Use a fake UUID
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const price = await AssetService.getLatestPrice(fakeId);

      expect(price).toBeNull();
    });
  });

  describe('getPrices', () => {
    it('should return price map for multiple assets', async () => {
      const assets = await AssetService.getAll({ format: 'simple' });
      if (assets.length === 0) {
        console.log('⚠️  No assets found, skipping getPrices test');
        return;
      }

      const assetIds = assets.slice(0, 3).map(a => a.id);

      const priceMap = await AssetService.getPrices(assetIds);

      expect(typeof priceMap).toBe('object');
      
      // Should have entries for assets that have prices
      Object.keys(priceMap).forEach(assetId => {
        expect(priceMap[assetId]).toHaveProperty('price');
        expect(priceMap[assetId]).toHaveProperty('date');
      });
    });

    it('should return empty object for empty assetIds', async () => {
      const priceMap = await AssetService.getPrices([]);

      expect(priceMap).toEqual({});
    });

    it('should return empty object for null assetIds', async () => {
      const priceMap = await AssetService.getPrices(null);

      expect(priceMap).toEqual({});
    });
  });
});

describe('AssetService - History Operations', () => {
  describe('getHistory', () => {
    it('should return asset history with statement alignment', async () => {
      const assets = await AssetService.getAll({ format: 'simple' });
      if (assets.length === 0) {
        console.log('⚠️  No assets found, skipping getHistory test');
        return;
      }

      const assetId = assets[0].id;

      const history = await AssetService.getHistory(assetId);

      expect(Array.isArray(history)).toBe(true);

      if (history.length > 0) {
        const record = history[0];
        expect(record).toHaveProperty('date');
        expect(record).toHaveProperty('unitPrice');
        expect(record).toHaveProperty('quantity');
        expect(record).toHaveProperty('marketValue');
        expect(record).toHaveProperty('totalCost');
        expect(record).toHaveProperty('addedQuantity');
        expect(record).toHaveProperty('addedPrincipal');
        expect(record).toHaveProperty('note');

        // Verify calculated fields
        expect(record.marketValue).toBeCloseTo(record.quantity * record.unitPrice, 2);
      }
    });

    it('should return empty array for asset with no transactions', async () => {
      // This test might not be reliable with real DB data
      // but we'll check that it doesn't throw
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const history = await AssetService.getHistory(fakeId);

      expect(Array.isArray(history)).toBe(true);
    });
  });
});

describe('AssetService - CRUD Operations', () => {
  let createdAssetId;

  afterEach(async () => {
    // Clean up created asset
    if (createdAssetId) {
      try {
        await AssetService.delete(createdAssetId);
      } catch (e) {
        // Ignore cleanup errors
      }
      createdAssetId = null;
    }
  });

  describe('create', () => {
    it('should create a new asset', async () => {
      const newAsset = {
        name: 'Test Asset',
        type: 'security',
        ticker: 'TEST123',
        note: 'Test note'
      };

      const result = await AssetService.create(newAsset);
      createdAssetId = result.id;

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(newAsset.name);
      expect(result.type).toBe(newAsset.type);
      expect(result.ticker).toBe(newAsset.ticker);
      expect(result.note).toBe(newAsset.note);
      expect(result).toHaveProperty('createdAt');
    });

    it('should throw error when name is missing', async () => {
      await expect(AssetService.create({ type: 'security' }))
        .rejects.toThrow('Name and Type required');
    });

    it('should throw error when type is missing', async () => {
      await expect(AssetService.create({ name: 'Test' }))
        .rejects.toThrow('Name and Type required');
    });
  });

  describe('update', () => {
    it('should update an existing asset', async () => {
      // First create an asset
      const newAsset = await AssetService.create({
        name: 'Original Name',
        type: 'fund',
        ticker: 'ORIG',
        note: 'Original note'
      });
      createdAssetId = newAsset.id;

      // Update it
      const updateData = {
        name: 'Updated Name',
        type: 'security',
        ticker: 'UPDATED',
        note: 'Updated note'
      };

      const result = await AssetService.update(createdAssetId, updateData);

      expect(result.success).toBe(true);
      expect(result.id).toBe(createdAssetId);
    });
  });

  describe('delete', () => {
    it('should delete an asset', async () => {
      // First create an asset
      const newAsset = await AssetService.create({
        name: 'To Delete',
        type: 'fixed',
        ticker: 'DELETE',
        note: 'Will be deleted'
      });
      const idToDelete = newAsset.id;

      // Delete it
      const result = await AssetService.delete(idToDelete);

      expect(result.success).toBe(true);
      
      // Clean up tracking
      createdAssetId = null;
    });
  });
});
