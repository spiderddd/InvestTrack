
// Asset Definitions (Global Dictionary)
export type AssetCategory = 'security' | 'fund' | 'wealth' | 'gold' | 'fixed' | 'crypto' | 'other';

export interface Asset {
  id: string;
  type: AssetCategory;
  name: string;
  ticker?: string;
  note?: string;
}

// --- New Strategy Hierarchy ---

// Level 3: The Leaf Node (Asset Allocation)
export interface StrategyTarget {
  id: string;      
  assetId: string; // Link to Asset Table
  
  // Display props
  targetName: string;
  weight: number;  // Inner Weight (0-100) relative to the Layer
  color: string;
  note?: string;
}

// Level 2: The Structural Layer
export interface StrategyLayer {
  id: string;
  name: string;   // e.g., "Core Defense"
  weight: number; // Layer Weight (0-100) relative to the Portfolio
  description?: string;
  items: StrategyTarget[];
}

// Level 1: The Version
export interface StrategyVersion {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  status: 'active' | 'archived';
  archivedAt?: string;
  updatedAt?: number;
  layers: StrategyLayer[]; // Structured hierarchy
}

// --- Ledger / Monthly Statement Records ---

// Position (formerly AssetRecord) - Real-time calculated view of holdings
export interface Position {
  id: string; // Unique Position ID
  assetId: string; // Link to Asset
  
  // De-normalized info for UI convenience
  name: string;
  category: AssetCategory;
  
  // State
  unitPrice: number;
  quantity: number;
  marketValue: number;
  
  // History
  totalCost: number;
  
  // Flow (monthly changes) - Optional, for backwards compatibility
  addedPrincipal?: number;
  addedQuantity?: number;
  
  // Transaction Note - Optional
  note?: string; 
}

// Holdings - Simple asset holdings for time-travel feature
export interface HoldingsItem {
  assetId: string;
  name: string;
  category: AssetCategory;
  quantity: number;
  totalCost: number;
  unitPrice: number;
}

export interface Holdings {
  date: string;
  assets: HoldingsItem[];
}

// MonthlyStatement - Header record for monthly adjustments
export interface MonthlyStatement {
  id: string;
  date: string; // YYYY-MM-DD (end of month), e.g., "2024-01-31"
  note?: string;  // Monthly investment review
  // Note: entries are calculated by summing all historical entries up to this date
}

// Extended MonthlyStatement with calculated assets (for API responses)
export interface MonthlyStatementDetail extends MonthlyStatement {
  assets?: Position[]; // Calculated assets/positions at this period
  totalValue: number;
  totalInvested: number;
}

// App Data Container
export interface AppData {
  assets: Asset[]; 
  strategies: StrategyVersion[];
  monthlyStatements: MonthlyStatement[];
}
