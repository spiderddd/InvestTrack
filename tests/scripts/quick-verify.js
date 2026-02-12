#!/usr/bin/env node
/**
 * 快速验证脚本 - 验证API和数据是否正常
 * 
 * 使用方法:
 *   node tests/scripts/quick-verify.js
 * 
 * 这个脚本会快速检查：
 * - 服务是否运行
 * - 数据是否已导入
 * - 关键数据是否正确
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('╔════════════════════════════════════╗', 'blue');
  log('║     InvestTrack 快速验证工具      ║', 'blue');
  log('╚════════════════════════════════════╝', 'blue');
  
  let allPassed = true;
  
  // 1. 检查服务
  log('\n1️⃣  检查服务状态...', 'cyan');
  try {
    const res = await fetch(`${API_BASE}/assets`);
    if (res.ok) {
      log('   ✅ 服务正在运行', 'green');
    } else {
      log('   ❌ 服务返回错误', 'red');
      allPassed = false;
    }
  } catch (e) {
    log('   ❌ 服务未运行', 'red');
    log('      请先运行: npm start', 'yellow');
    process.exit(1);
  }
  
  // 2. 检查资产数量
  log('\n2️⃣  检查资产数据...', 'cyan');
  try {
    const res = await fetch(`${API_BASE}/assets`);
    const data = await res.json();
    const count = data.data.length;
    
    if (count === 7) {
      log(`   ✅ 资产数量正确 (7)`, 'green');
    } else {
      log(`   ⚠️  资产数量不符 (预期: 7, 实际: ${count})`, 'yellow');
      allPassed = false;
    }
  } catch (e) {
    log('   ❌ 检查失败', 'red');
    allPassed = false;
  }
  
  // 3. 检查策略
  log('\n3️⃣  检查策略数据...', 'cyan');
  try {
    const res = await fetch(`${API_BASE}/strategies`);
    const data = await res.json();
    const count = data.data.length;
    
    if (count === 1) {
      log(`   ✅ 策略数量正确 (1)`, 'green');
    } else {
      log(`   ⚠️  策略数量不符 (预期: 1, 实际: ${count})`, 'yellow');
      allPassed = false;
    }
  } catch (e) {
    log('   ❌ 检查失败', 'red');
    allPassed = false;
  }
  
  // 4. 检查月报
  log('\n4️⃣  检查月度报表...', 'cyan');
  try {
    const res = await fetch(`${API_BASE}/statements`);
    const data = await res.json();
    const count = data.data.items.length;
    
    if (count === 6) {
      log(`   ✅ 月报数量正确 (6)`, 'green');
    } else {
      log(`   ⚠️  月报数量不符 (预期: 6, 实际: ${count})`, 'yellow');
      allPassed = false;
    }
  } catch (e) {
    log('   ❌ 检查失败', 'red');
    allPassed = false;
  }
  
  // 5. 检查关键数据
  log('\n5️⃣  检查关键指标...', 'cyan');
  try {
    const res = await fetch(`${API_BASE}/dashboard/metrics?viewMode=total&timeRange=all`);
    const data = await res.json();
    const metrics = data.data;
    
    log(`   总市值: ¥${metrics.endValue.toFixed(2)}`, 'cyan');
    log(`   总投入: ¥${metrics.endInvested}`, 'cyan');
    log(`   盈亏: ¥${metrics.profit.toFixed(2)}`, 'cyan');
    log(`   收益率: ${metrics.returnRate.toFixed(2)}%`, 'cyan');
    
    if (metrics.returnRate > 0) {
      log('   ✅ 收益率为正', 'green');
    } else {
      log('   ⚠️  收益率为负，可能需要修复数据', 'yellow');
      allPassed = false;
    }
  } catch (e) {
    log('   ❌ 检查失败', 'red');
    allPassed = false;
  }
  
  // 总结
  log('\n' + '═'.repeat(40), 'blue');
  if (allPassed) {
    log('✅ 所有检查通过！', 'green');
    log('\n你可以运行完整测试:', 'cyan');
    log('  npm test -- tests/integration/example-data-api.test.js --run', 'yellow');
    process.exit(0);
  } else {
    log('⚠️  部分检查未通过', 'yellow');
    log('\n建议操作:', 'cyan');
    log('  1. 导入数据: node tests/scripts/run-api-tests.js', 'yellow');
    log('  2. 修复价格: node tests/scripts/fix-bitcoin-price.js', 'yellow');
    process.exit(1);
  }
}

main().catch(e => {
  log(`\n❌ 错误: ${e.message}`, 'red');
  process.exit(1);
});
