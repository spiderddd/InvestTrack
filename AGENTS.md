# InvestTrack - Agent Development Guide

This document provides guidelines for AI agents working on the InvestTrack codebase.

## Build, Lint, and Test Commands

```bash
# Development
npm run dev              # Start frontend dev server (http://localhost:5173)
npm start                # Start backend server (http://localhost:3001)

# Build and Type Checking
npm run build            # TypeScript check + Vite production build
npm run typecheck        # TypeScript type checking only (no emit)

# Data Management
npm run seed             # Generate test data (7 assets, 1 strategy, 6 months)

# Testing
npm run test             # Run unit tests with Vitest
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Run tests with UI browser

# Regression Testing (REQUIRED before any code change)
npm run test:record      # Record API snapshots (set RECORD_MODE=true)
npm run test:regression  # Run regression test after code change

# Docker
docker build -t invest-track .    # Build Docker image
docker run -p 3001:3001 invest-track  # Run container
```

## Code Style Guidelines

### General Formatting
- **Quotes**: Single quotes for strings
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Optional (follow existing code style)
- **Line endings**: LF (Unix-style)

### Naming Conventions
- **Components**: PascalCase (e.g., `Dashboard.tsx`, `StatementManager`)
- **Types/Interfaces**: PascalCase (e.g., `Asset`, `StrategyVersion`)
- **Functions/Variables**: camelCase (e.g., `handleUpdateStrategies`, `isLoading`)
- **Constants**: UPPER_SNAKE_CASE for config constants, camelCase for others
- **Files**: kebab-case for utilities, PascalCase for components

### TypeScript Rules
- **Strict Mode**: Enabled in `tsconfig.json` - no implicit `any`
- **Type Annotations**: Required for callback parameters in `map`/`filter`/`find`/`reduce`
- **Shared Types**: All types must be imported from `@shared/types`, never redefined locally

```typescript
// ✅ Correct
import { Asset, StrategyVersion } from '@shared/types';
assets.filter((a: Asset) => a.id === targetId);

// ❌ Incorrect - duplicate type definition
interface Asset { id: string; name: string; }
assets.filter(a => a.id === targetId);  // implicit any error
```

### Import Conventions
- Use path alias `@shared/*` instead of relative paths
- Group imports: React → External Libraries → Internal Components → Services/Utils
- Named imports for multiple exports from same package

```typescript
import React, { useState } from 'react';
import { PieChart, History } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { Asset } from '@shared/types';
```

### Path Alias
The `@shared/*` alias points to the project root's `shared/` directory. Configure your IDE to recognize this alias.

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": { "@shared/*": ["shared/*"] }
  }
}
```

## Backend API Patterns

### Zod Validation (Required)
All API endpoints must validate input using Zod schemas:

```javascript
// Route file
import { validateBody, validateParams } from '../validations/middleware.js';
import { AssetSchema } from '../validations/schemas.js';

router.post('/', validateBody(AssetSchema), async (req, res) => {
  // req.body is now validated and typed
});
```

**Available Schemas** (`server/validations/schemas.js`):
- `AssetSchema` / `AssetUpdateSchema`
- `StrategyVersionSchema` / `StrategyVersionCreateSchema`
- `MonthlyStatementSchema`
- `PriceUpdateSchema`
- `PaginationSchema`
- `DashboardQuerySchema`

### Response Helpers
Use standardized response functions for consistent API output:

```javascript
import { sendSuccess, sendCreated, sendError } from '../utils/responseHelper.js';

sendSuccess(res, data, 'Operation completed');           // 200
sendCreated(res, newItem, 'Created successfully');        // 201
sendError(res, error, 'Context description', 400);        // Error response
```

### Error Response Format
All error responses follow this structure:

```json
{
  "success": false,
  "error": "Error message",
  "context": "Operation context",
  "details": [{ "path": "field", "message": "validation error" }]
}
```

### JSDoc Documentation
Every API route must include JSDoc comments:

```javascript
/**
 * @route   POST /api/assets
 * @desc    Create new asset
 * @access  Public
 * @body    {Asset} Asset data
 * @returns {Asset} Created asset
 */
router.post('/', validateBody(AssetSchema), async (req, res) => { ... });
```

### HTTP Status Codes
- 200: Success
- 201: Created
- 400: Validation error
- 404: Resource not found
- 409: Conflict (e.g., unique constraint violation)
- 500: Internal server error

## Frontend Component Patterns

### Component Structure
- Use function components with TypeScript
- Props must define an `interface`
- Wrap complex components with `ErrorBoundary`
- Use React.FC type for component

```typescript
interface DashboardProps {
  strategies: StrategyVersion[];
  statements: MonthlyStatement[];
}

const Dashboard: React.FC<DashboardProps> = ({ strategies, statements }) => {
  // Component logic
};
```

### Error Boundary
Root component and complex components must be wrapped with `ErrorBoundary`:

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => (
  <ErrorBoundary>
    <DataProvider>
      <AppContent />
    </DataProvider>
  </ErrorBoundary>
);
```

### Data Fetching
Use the `DataContext` for global state management. Services call API endpoints:

```typescript
import { StorageService } from './services/storageService';
import { useData } from './contexts/DataContext';

const MyComponent: React.FC = () => {
  const { assets, refreshAssets } = useData();
  // ...
};
```

## Adding New Features

### New Type Definition
1. Add interface to `shared/types.ts`
2. Export the type
3. Create corresponding Zod schema in `server/validations/schemas.js`

### New Backend API
1. Add Zod schema in `server/validations/schemas.js`
2. Create route file in `server/routes/`
3. Create service logic in `server/services/`
4. Mount route in `server/index.js`
5. Add JSDoc documentation

### New Frontend Component
1. Create `.tsx` file in `client/src/components/`
2. Define Props interface (import types from `@shared/types`)
3. Add ErrorBoundary wrapper if complex
4. Export and use in parent component

### New Custom Hook
1. Create file in `client/src/hooks/`
2. Follow pattern: `useXxx` naming
3. Return tuple `[data, functions]` or single object

## Important Distinctions

### Asset vs Position
- **Asset**: Asset definition (stock/fund metadata - name, ticker, type)
- **Position**: Holding record at a specific point in time (quantity, price, cost) - formerly AssetRecord

### Date Formats
- **Strategy date**: `YYYY-MM-DD`
- **Statement period**: `YYYY-MM` (monthly statement period)

### File Locations
- Shared types: `shared/types.ts`
- Backend routes: `server/routes/*.js`
- Backend services: `server/services/*.js`
- Validation schemas: `server/validations/schemas.js`
- Validation middleware: `server/validations/middleware.js`
- Response helpers: `server/utils/responseHelper.js`
- Frontend components: `client/src/components/**/*.tsx`
- Frontend hooks: `client/src/hooks/*.ts`
- API services: `client/src/services/storageService.ts`

### Temporary Documentation (`tmp_doc/`)
The `tmp_doc/` folder contains working drafts, analysis documents, and temporary notes that are not part of the official documentation:

- **Purpose**: Working space for analysis, calculations, and brainstorming documents
- **Git**: This folder is gitignored and should never be committed to the repository
- **Usage**: Place any draft documents, calculation notes, or temporary working files here
- **Convention**: When you need to create documentation that is work-in-progress or for personal reference, always put it in `tmp_doc/` instead of the project root

## Important Concepts

### Monthly Statement (formerly Snapshot)
The system uses **Monthly Statements** to record investment adjustments:
- Each statement records **monthly net adjustments** (quantity and cost changes) for the current period only
- It does NOT record the full holding state at month-end
- Previous holdings are tracked by accumulating all historical adjustments up to the query date
- **Key implication**: To know current holdings, the system sums all adjustments from all statements up to the target date

### Position (formerly AssetRecord)
A Position represents a holding at a specific point in time:
- `quantity`: Current holdings
- `totalCost`: Accumulated cost (can be negative for realized gains)
- `marketValue`: Current market value (quantity × price)

### Holdings Data Flow
The asset library fetches holdings data through this chain:
1. **Backend**: `server/routes/assets.js` → `server/services/assetsService.js`
2. **API**: `GET /api/assets/holdings-by-date?date=YYYY-MM-DD`
3. **Frontend Service**: `client/src/services/storageService.getHoldingsByDate()`
4. **Hook**: `client/src/hooks/useAssetGrouping.ts` - manages filtering, grouping, search
5. **Component**: `client/src/components/AssetManager.tsx` - renders asset cards

### Asset States in AssetManager
- **isHeld**: `quantity > 0` - currently holding
- **isCleared**: `quantity === 0 && totalCost !== 0` - sold out but has profit/loss
- **isHistorical**: `selectedDate !== 'latest'` - viewing historical snapshot

## Database
- SQLite database at `data/invest_track_v2.db`
- Use `server/db.js` for database operations
- Backup by copying the database file

## Regression Testing (IMPORTANT)

### Overview
Before making ANY code changes, you MUST run regression tests to ensure the existing functionality remains intact. This prevents regressions and validates that your changes don't break existing features.

### Workflow

```
┌────────────────────────────────────────────────────────────────┐
│ Step 1: Record Baseline (BEFORE any code changes)             │
│   1. Start server: npm start                                   │
│   2. Run: npm run test:record                                 │
│   3. Snapshot saved to: snapshots/api-responses.json          │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 2: Make Code Changes                                      │
│   - Modify the code as needed                                  │
│   - DO NOT run test:record again                               │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 3: Run Regression Test (AFTER code changes)              │
│   1. Start server: npm start                                   │
│   2. Run: npm run test:regression                              │
│   3. Check results: All 20 APIs should pass                   │
└────────────────────────────────────────────────────────────────
```

### Test Coverage
The regression test covers 20 API endpoints:
- **Assets**: list, holdings-by-date, latest-prices
- **Statements**: list, pagination, dates, history, previous, detail, recalculate
- **Strategies**: list
- **Prices**: gold, status
- **Dashboard**: overview, metrics, allocation, trend, breakdown
- **Export**: backup

### How It Works
1. **Record Mode** (`--record`): Calls all APIs and saves responses to `snapshots/api-responses.json`
2. **Regression Mode**: Calls all APIs and compares with saved snapshots
   - Automatically ignores dynamic fields: `timestamp`, `createdAt`, `updatedAt`, etc.
   - Allows floating-point tolerance: ±0.001

### Adding New APIs
To add new APIs to the regression test, edit `tests/integration/api-regression.test.js` and add entries to the `API_ENDPOINTS` array:

```javascript
const API_ENDPOINTS = [
  // Add new endpoint here
  { method: 'GET', path: '/api/your-new-endpoint', name: 'your-name' },
];
```

### Data Management
- **data_bak/**: Backup data (read-only, used as source for tests)
- **data_test/**: Test data (auto-generated, gitignored)
- **snapshots/**: API response snapshots (gitignored)

### If Tests Fail
When regression tests fail, you'll see:
```
✗ dashboard-metrics
  FAIL: 检测到 2 个差异
  [
    { path: 'data.endValue', actual: 100000, expected: 99999.5 },
    ...
  ]
```

Analyze the differences:
- **Expected difference**: Your code change intentionally modified behavior → Update snapshot with `npm run test:record`
- **Unexpected difference**: Your code change accidentally broke something → Fix your code
