/**
 * API 回归测试
 *
 * 功能：
 * - 记录模式 (--record)：调用全部 API，保存响应到 snapshots/
 * - 回归模式：调用全部 API，与快照智能比对
 *
 * 运行：
 *   npm run test:record      # 改代码前记录快照
 *   npm run test:regression   # 改代码后回归测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const SNAPSHOT_DIR = path.join(__dirname, '../../snapshots');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'api-responses.json');

const IGNORE_FIELDS = [
  'timestamp', 'createdAt', 'updatedAt', 'serverTime', 'currentDate',
  'id', 'assetId', 'strategyId', 'statementId',
  'serverVersion', 'nodeVersion',
  'exportedAt', 'assetsUpdated', 'type', 'source', 'syncTime',
];

const FLOAT_TOLERANCE = 0.001;

const API_ENDPOINTS = [
  { method: 'GET',    path: '/assets',                                        name: 'assets-list' },
  { method: 'GET',    path: '/assets/holdings-by-date?date=2024-06-30',       name: 'assets-holdings' },
  { method: 'GET',    path: '/assets/latest_prices',                         name: 'assets-latest-prices' },
  { method: 'GET',    path: '/statements',                                     name: 'statements-list' },
  { method: 'GET',    path: '/statements?page=1&limit=3',                      name: 'statements-pagination' },
  { method: 'GET',    path: '/statements/dates',                              name: 'statements-dates' },
  { method: 'GET',    path: '/statements/history',                             name: 'statements-history' },
  { method: 'GET',    path: '/statements/previous/2024-06-30',                name: 'statements-previous' },
  { method: 'GET',    path: '/statements/{id}',                                name: 'statements-detail' },
  { method: 'POST',   path: '/statements/recalculate',                         name: 'statements-recalculate' },
  { method: 'GET',    path: '/strategies',                                    name: 'strategies-list' },
  { method: 'GET',    path: '/prices/gold',                                   name: 'prices-gold' },
  { method: 'GET',    path: '/prices/status',                                 name: 'prices-status' },
  { method: 'GET',    path: '/dashboard/overview?viewMode=total&timeRange=all', name: 'dashboard-overview' },
  { method: 'GET',    path: '/dashboard/metrics?viewMode=total&timeRange=all', name: 'dashboard-metrics' },
  { method: 'GET',    path: '/dashboard/allocation?viewMode=total',          name: 'dashboard-allocation' },
  { method: 'GET',    path: '/dashboard/trend?viewMode=total',                name: 'dashboard-trend' },
  { method: 'GET',    path: '/dashboard/breakdown?viewMode=total',           name: 'dashboard-breakdown' },
  { method: 'GET',    path: '/export/backup',                                 name: 'export-backup' },
];

async function apiRequest(endpoint) {
  const url = `${API_BASE}${endpoint.path}`;
  const res = await fetch(url, {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' },
  });

  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

function compareValues(actual, expected, path = '') {
  const differences = [];

  if (typeof actual !== typeof expected) {
    differences.push({ path, actual: typeof actual, expected: typeof expected });
    return differences;
  }

  if (typeof actual === 'number' && !Number.isInteger(actual)) {
    if (Math.abs(actual - expected) > FLOAT_TOLERANCE) {
      differences.push({ path, actual, expected, diff: actual - expected });
    }
    return differences;
  }

  if (typeof actual === 'object' && actual !== null) {
    const expectedKeys = expected ? Object.keys(expected) : [];
    const actualKeys = actual ? Object.keys(actual) : [];
    const allKeys = new Set([...expectedKeys, ...actualKeys]);

    for (const key of allKeys) {
      if (IGNORE_FIELDS.includes(key)) continue;
      const childPath = path ? `${path}.${key}` : key;
      differences.push(...compareValues(actual[key], expected[key], childPath));
    }
  } else if (actual !== expected) {
    differences.push({ path, actual, expected });
  }

  return differences;
}

describe('API Regression Test', () => {
  const isRecordMode = process.env.RECORD_MODE === 'true';
  let snapshot = {};

  beforeAll(async () => {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
    }
  });

  for (const endpoint of API_ENDPOINTS) {
    it(`${endpoint.method} ${endpoint.path} - ${endpoint.name}`, async () => {
      const response = await apiRequest(endpoint);

      if (isRecordMode) {
        snapshot[endpoint.name] = {
          status: response.status,
          data: response.data,
        };
        console.log(`[RECORD] ${endpoint.name}: ${response.status}`);
        return;
      }

      const expected = snapshot[endpoint.name];
      expect(expected, `快照中未找到: ${endpoint.name}`).toBeDefined();

      expect(response.status).toBe(expected.status);

      const diffs = compareValues(response.data, expected.data);

      if (diffs.length > 0) {
        console.error(`[FAIL] ${endpoint.name}:`, diffs);
      }

      expect(diffs.length, `检测到 ${diffs.length} 个差异`).toBe(0);
    });
  }

  afterAll(async () => {
    if (isRecordMode) {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      }
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
      console.log(`\n✅ 快照已保存到: ${SNAPSHOT_FILE}`);
      console.log(`   共记录 ${Object.keys(snapshot).length} 个 API 响应`);
    }
  });
});
