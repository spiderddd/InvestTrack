#!/usr/bin/env node
/**
 * 修复 Bitcoin 价格脚本
 * 
 * 当 Bitcoin 价格被错误地设置为低值（如150）时，
 * 使用此脚本将其修复为正确的价格。
 * 
 * 使用方法:
 *   node tests/scripts/fix-bitcoin-price.js [price]
 * 
 * 参数:
 *   price    可选，目标价格 (默认: 572585.2491)
 * 
 * 示例:
 *   # 使用默认价格修复
 *   node tests/scripts/fix-bitcoin-price.js
 * 
 *   # 指定价格修复
 *   node tests/scripts/fix-bitcoin-price.js 600000
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// 默认价格（来自 example.json）
const DEFAULT_PRICE = 572585.2491;

// 解析命令行参数
const targetPrice = parseFloat(process.argv[2]) || DEFAULT_PRICE;

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

// 主函数
async function main() {
  log('╔════════════════════════════════════╗', 'blue');
  log('║      Bitcoin 价格修复工具          ║', 'blue');
  log('╚════════════════════════════════════╝', 'blue');
  
  log(`\n目标价格: ¥${targetPrice.toFixed(4)}`, 'cyan');
  
  try {
    // 1. 获取资产列表，找到 Bitcoin
    log('\n🔍 查找 Bitcoin 资产...', 'cyan');
    const assetsRes = await fetch(`${API_BASE}/assets`);
    const assets = await assetsRes.json();
    
    const bitcoin = assets.data.find(a => a.name === 'Bitcoin');
    if (!bitcoin) {
      log('❌ 找不到 Bitcoin 资产', 'red');
      process.exit(1);
    }
    
    log(`✅ 找到 Bitcoin (ID: ${bitcoin.id})`, 'green');
    
    // 2. 检查当前价格
    log('\n💰 检查当前价格...', 'cyan');
    const today = new Date().toISOString().slice(0, 10);
    const priceRes = await fetch(`${API_BASE}/assets/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: [bitcoin.id] })
    });
    const priceData = await priceRes.json();
    const currentPrice = priceData.data[bitcoin.id]?.price;
    
    if (currentPrice) {
      log(`当前价格: ¥${currentPrice}`, 'cyan');
      
      if (currentPrice === targetPrice) {
        log('✅ 价格已经是目标值，无需修复', 'green');
        process.exit(0);
      }
      
      if (currentPrice < 1000) {
        log('⚠️  检测到异常低价格，需要修复', 'yellow');
      }
    } else {
      log('⚠️  未找到当前价格记录', 'yellow');
    }
    
    // 3. 更新价格
    log(`\n📝 更新价格为 ¥${targetPrice}...`, 'cyan');
    const updateRes = await fetch(`${API_BASE}/assets/${bitcoin.id}/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: targetPrice, date: today })
    });
    
    if (!updateRes.ok) {
      const error = await updateRes.text();
      log(`❌ 更新失败: ${error}`, 'red');
      process.exit(1);
    }
    
    const updateResult = await updateRes.json();
    
    if (updateResult.success) {
      log('✅ 价格更新成功', 'green');
      
      // 4. 验证修复结果
      log('\n🔍 验证修复结果...', 'cyan');
      const verifyRes = await fetch(`${API_BASE}/dashboard/metrics?viewMode=total&timeRange=all`);
      const metrics = await verifyRes.json();
      
      log(`\n修复后数据:`, 'cyan');
      log(`  总市值: ¥${metrics.data.endValue.toFixed(2)}`, 'cyan');
      log(`  总投入: ¥${metrics.data.endInvested}`, 'cyan');
      log(`  盈亏: ¥${metrics.data.profit.toFixed(2)}`, 'cyan');
      log(`  收益率: ${metrics.data.returnRate.toFixed(2)}%`, 'cyan');
      
      if (metrics.data.returnRate > 0) {
        log('\n✅ 修复成功！收益率已恢复正值', 'green');
      } else {
        log('\n⚠️  收益率仍为负，请检查其他资产价格', 'yellow');
      }
      
      log('\n╔════════════════════════════════════╗', 'green');
      log('║        🎉 价格修复完成！          ║', 'green');
      log('╚════════════════════════════════════╝', 'green');
    } else {
      log('❌ 更新返回失败状态', 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行
main();
