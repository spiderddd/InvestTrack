/**
 * Test fixtures for strategies
 */

export const testStrategies = [
  {
    id: 'strategy-1',
    name: '稳健增长策略',
    status: 'active',
    versions: [
      {
        id: 'version-1-1',
        strategyId: 'strategy-1',
        startDate: '2024-01-01',
        status: 'active',
        layers: [
          {
            id: 'layer-1',
            name: '股票层',
            weight: 60,
            items: [
              { assetId: 'asset-stock-1', weight: 40 },  // 腾讯 - 固定40%
              { assetId: 'asset-stock-2', weight: -1 }   // 茅台 - 自动分配
            ]
          },
          {
            id: 'layer-2',
            name: '债券层',
            weight: 30,
            items: [
              { assetId: 'asset-fixed-1', weight: -1 },  // 定期 - 自动分配
              { assetId: 'asset-cash-1', weight: -1 }    // 余额宝 - 自动分配
            ]
          },
          {
            id: 'layer-3',
            name: '商品层',
            weight: 10,
            items: [
              { assetId: 'asset-gold-1', weight: 100 }   // 黄金 - 固定100%（层内）
            ]
          }
        ]
      },
      {
        id: 'version-1-2',
        strategyId: 'strategy-1',
        startDate: '2024-06-01',
        status: 'archived',
        layers: [
          {
            id: 'layer-1',
            name: '股票层',
            weight: 50,
            items: [
              { assetId: 'asset-stock-1', weight: 50 },
              { assetId: 'asset-fund-1', weight: 50 }
            ]
          },
          {
            id: 'layer-2',
            name: '债券层',
            weight: 50,
            items: [
              { assetId: 'asset-fixed-1', weight: -1 },
              { assetId: 'asset-cash-1', weight: -1 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'strategy-2',
    name: '保守策略',
    status: 'archived',
    versions: [
      {
        id: 'version-2-1',
        strategyId: 'strategy-2',
        startDate: '2023-06-01',
        status: 'archived',
        layers: [
          {
            id: 'layer-1',
            name: '现金层',
            weight: 100,
            items: [
              { assetId: 'asset-cash-1', weight: 100 }
            ]
          }
        ]
      }
    ]
  }
];

/**
 * Get strategy by ID
 */
export function getStrategyById(id) {
  return testStrategies.find(s => s.id === id);
}

/**
 * Get active strategies
 */
export function getActiveStrategies() {
  return testStrategies.filter(s => s.status === 'active');
}
