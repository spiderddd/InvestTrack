CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    ticker TEXT,
    note TEXT,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS strategy_versions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    archived_at TEXT,
    updated_at INTEGER,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS strategy_layers (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(version_id) REFERENCES strategy_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_targets (
    id TEXT PRIMARY KEY,
    layer_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    weight REAL NOT NULL,
    color TEXT,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(layer_id) REFERENCES strategy_layers(id) ON DELETE CASCADE,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS monthly_statements (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    note TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS market_prices (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    date TEXT NOT NULL,
    price REAL NOT NULL,
    source TEXT DEFAULT 'manual',
    updated_at INTEGER,
    UNIQUE(asset_id, date)
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    statement_id TEXT,
    date TEXT NOT NULL,
    type TEXT,
    quantity_change REAL DEFAULT 0,
    cost_change REAL DEFAULT 0,
    note TEXT,
    created_at INTEGER,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE INDEX IF NOT EXISTS idx_prices_asset_date ON market_prices(asset_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);
