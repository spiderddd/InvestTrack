#!/usr/bin/env node
/**
 * 自动化API测试脚本
 * 
 * 使用方法:
 *   node tests/scripts/run-api-tests.js [options]
 * 
 * 选项:
 *   --import-only     只导入数据，不运行测试
 *   --skip-import     跳过数据导入（假设数据已存在）
 *   --verbose         显示详细输出
 *   --help            显示帮助
 * 
 * 示例:
 *   node tests/scripts/run-api-tests.js
 *   node tests/scripts/run-api-tests.js --skip-import
 *   node tests/scripts/run-api-tests.js --verbose
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  importOnly: args.includes('--import-only'),
  skipImport: args.includes('--skip-import'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
};

// 显示帮助
if (options.help) {
  console.log(`
自动化API测试脚本

使用方法:
  node tests/scripts/run-api-tests.js [options]

选项:
  --import-only     只导入数据，不运行测试
  --skip-import     跳过数据导入（假设数据已存在）
  --verbose         显示详细输出
  --help            显示帮助

环境变量:
  API_BASE          API基础URL (默认: http://localhost:3001/api)

示例:
  # 完整测试（导入数据 + 运行测试）
  node tests/scripts/run-api-tests.js

  # 只导入数据
  node tests/scripts/run-api-tests.js --import-only

  # 跳过导入，直接测试
  node tests/scripts/run-api-tests.js --skip-import

  # 详细输出
  node tests/scripts/run-api-tests.js --verbose
`);
  process.exit(0);
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logVerbose(message) {
  if (options.verbose) {
    console.log(`${colors.cyan}[VERBOSE] ${message}${colors.reset}`);
  }
}

// 检查服务是否运行
async function checkService() {
  log('🔍 检查服务状态...', 'cyan');
  
  try {
    const res = await fetch(`${API_BASE}/assets`);
    if (res.ok) {
      log('✅ 服务正在运行', 'green');
      return true;
    }
  } catch (e) {
    // 服务未运行
  }
  
  log('❌ 服务未运行，请先启动后端服务', 'red');
  log('   npm start', 'yellow');
  return false;
}

// 导入数据
async function importData() {
  log('\n📦 导入 example.json 数据...', 'cyan');
  
  try {
    const examplePath = join(PROJECT_ROOT, 'scripts/example.json');
    
    if (!fs.existsSync(examplePath)) {
      log(`❌ 找不到文件: ${examplePath}`, 'red');
      return false;
    }
    
    logVerbose(`读取文件: ${examplePath}`);
    const backupData = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    
    logVerbose('发送导入请求...');
    const res = await fetch(`${API_BASE}/export/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData)
    });
    
    if (!res.ok) {
      const error = await res.text();
      log(`❌ 导入失败: ${error}`, 'red');
      return false;
    }
    
    const result = await res.json();
    log('✅ 数据导入成功', 'green');
    log(`   资产: ${result.imported.assets}`, 'cyan');
    log(`   策略: ${result.imported.strategies}`, 'cyan');
    log(`   月报: ${result.imported.monthlyStatements}`, 'cyan');
    
    return true;
  } catch (error) {
    log(`❌ 导入出错: ${error.message}`, 'red');
    return false;
  }
}

// 运行测试
async function runTests() {
  log('\n🧪 运行API测试...', 'cyan');
  
  return new Promise((resolve) => {
    const testFile = join(PROJECT_ROOT, 'tests/integration/example-data-api.test.js');
    const vitestArgs = ['vitest', 'run', testFile];
    
    if (options.verbose) {
      vitestArgs.push('--reporter=verbose');
    }
    
    const child = spawn('npx', vitestArgs, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env, API_BASE }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log('\n✅ 所有测试通过', 'green');
        resolve(true);
      } else {
        log(`\n❌ 测试失败 (退出码: ${code})`, 'red');
        resolve(false);
      }
    });
  });
}

// 验证关键数据
async function verifyData() {
  log('\n🔍 验证关键数据...', 'cyan');
  
  try {
    // 验证资产数量
    const assetsRes = await fetch(`${API_BASE}/assets`);
    const assets = await assetsRes.json();
    logVerbose(`资产数量: ${assets.data.length}`);
    
    if (assets.data.length !== 7) {
      log(`⚠️  警告: 资产数量不符 (预期: 7, 实际: ${assets.data.length})`, 'yellow');
    } else {
      log('✅ 资产数量正确 (7)', 'green');
    }
    
    // 验证仪表板数据
    const dashboardRes = await fetch(`${API_BASE}/dashboard/metrics?viewMode=total&timeRange=all`);
    const dashboard = await dashboardRes.json();
    logVerbose(`总市值: ¥${dashboard.data.endValue.toFixed(2)}`);
    logVerbose(`总投入: ¥${dashboard.data.endInvested}`);
    logVerbose(`盈亏: ¥${dashboard.data.profit.toFixed(2)}`);
    logVerbose(`收益率: ${dashboard.data.returnRate.toFixed(2)}%`);
    
    // 检查Bitcoin价格是否已修复
    const today = new Date().toISOString().slice(0, 10);
    const stmtRes = await fetch(`${API_BASE}/statements/details-by-date?date=${today}`);
    const stmt = await stmtRes.json();
    
    const bitcoin = stmt.data.assets.find(a => a.name === 'Bitcoin');
    if (bitcoin) {
      logVerbose(`Bitcoin市值: ¥${bitcoin.marketValue.toFixed(2)}`);
      
      if (bitcoin.marketValue < 1000) {
        log('⚠️  警告: Bitcoin价格可能未修复 (市值过低)', 'yellow');
        log('   建议运行: node tests/scripts/fix-bitcoin-price.js', 'cyan');
      } else {
        log('✅ Bitcoin价格已修复', 'green');
      }
    }
    
    // 验证收益率
    if (dashboard.data.returnRate < 0) {
      log('⚠️  警告: 收益率为负，可能需要修复价格数据', 'yellow');
    } else {
      log(`✅ 收益率为正: +${dashboard.data.returnRate.toFixed(2)}%`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ 验证失败: ${error.message}`, 'red');
    return false;
  }
}

// 主函数
async function main() {
  log('╔════════════════════════════════════╗', 'blue');
  log('║     InvestTrack API 测试工具      ║', 'blue');
  log('╚════════════════════════════════════╝', 'blue');
  
  // 检查服务
  if (!await checkService()) {
    process.exit(1);
  }
  
  // 导入数据
  if (!options.skipImport) {
    if (!await importData()) {
      process.exit(1);
    }
    
    if (options.importOnly) {
      log('\n✅ 数据导入完成', 'green');
      process.exit(0);
    }
  } else {
    log('\n⏭️  跳过数据导入', 'yellow');
  }
  
  // 验证数据
  await verifyData();
  
  // 运行测试
  const success = await runTests();
  
  if (success) {
    log('\n╔════════════════════════════════════╗', 'green');
    log('║        🎉 所有测试通过！          ║', 'green');
    log('╚════════════════════════════════════╝', 'green');
    process.exit(0);
  } else {
    log('\n╔════════════════════════════════════╗', 'red');
    log('║        ❌ 测试未通过              ║', 'red');
    log('╚════════════════════════════════════╝', 'red');
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  log(`\n❌ 运行时错误: ${error.message}`, 'red');
  process.exit(1);
});
