#!/usr/bin/env python3
"""
InvestTrack 资产价格自动同步脚本

功能：
1. 从 InvestTrack 获取所有资产列表
2. 使用 akshare 查询 A 股实时价格
3. 批量更新价格到 InvestTrack

使用方法：
    python sync_prices.py
    
定时任务（Linux/Mac）：
    crontab -e
    # 添加：每天下午 3:30 执行（A股收盘后）
    30 15 * * * /usr/bin/python3 /path/to/sync_prices.py >> /var/log/investtrack_sync.log 2>&1

依赖安装：
    pip install requests akshare
"""

import requests
from datetime import datetime
import logging
import sys

# 尝试导入 akshare，如果失败给出友好提示
ak = None  # type: ignore
AKSHARE_AVAILABLE = False

try:
    import akshare as ak  # type: ignore
    AKSHARE_AVAILABLE = True
except ImportError:
    print("警告: 未安装 akshare，将使用模拟数据模式")
    print("安装命令: pip install akshare")

# 配置
BASE_URL = "http://localhost:3001/api"
LOG_LEVEL = logging.INFO

# 设置日志
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def get_assets(format_type="simple"):
    """从 InvestTrack 获取资产列表"""
    try:
        response = requests.get(
            f"{BASE_URL}/assets?format={format_type}", 
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        
        if result.get("success"):
            return result.get("data", [])
        else:
            logger.error(f"API 返回错误: {result.get('error')}")
            return []
            
    except requests.exceptions.ConnectionError:
        logger.error(f"无法连接到 InvestTrack 服务器 (端口 3001)")
        logger.error("请确保后端服务已启动: npm start")
        return []
    except Exception as e:
        logger.error(f"获取资产列表失败: {e}")
        return []


def query_a_share_price(ticker):
    """
    使用 akshare 查询 A 股实时价格
    
    支持：
    - 上海主板 (600xxx, 601xxx, 603xxx)
    - 深圳主板 (000xxx, 001xxx)
    - 创业板 (300xxx)
    - 科创板 (688xxx)
    - 北交所 (8xxxxx, 4xxxxx)
    """
    global ak
    global AKSHARE_AVAILABLE
    
    if not AKSHARE_AVAILABLE or ak is None:
        # 模拟模式：返回随机价格（仅用于测试）
        import random
        return {
            "price": round(random.uniform(10, 200), 2),
            "name": f"股票{ticker}"
        }
    
    try:
        # 获取 A 股实时行情
        df = ak.stock_zh_a_spot_em()
        
        # 查找指定股票
        row = df[df["代码"] == ticker]
        
        if row.empty:
            logger.warning(f"  未找到股票代码: {ticker}")
            return None
        
        # 获取最新价格和名称
        price = float(row["最新价"].values[0])
        name = row["名称"].values[0]
        
        return {
            "price": price,
            "name": name
        }
        
    except Exception as e:
        logger.error(f"  查询股票 {ticker} 价格失败: {e}")
        return None


def update_price(asset_id, price, date):
    """更新资产价格到 InvestTrack"""
    try:
        response = requests.post(
            f"{BASE_URL}/assets/{asset_id}/price",
            json={
                "price": price,
                "date": date
            },
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if result.get("success"):
            return True
        else:
            logger.error(f"  API 错误: {result.get('error')}")
            return False
            
    except Exception as e:
        logger.error(f"  更新价格失败: {e}")
        return False


def sync_prices():
    """主同步函数"""
    logger.info("=" * 60)
    logger.info("开始同步资产价格")
    logger.info("=" * 60)
    
    if not AKSHARE_AVAILABLE:
        logger.warning("⚠️  未安装 akshare，使用模拟数据模式（仅用于测试）")
        logger.warning("   安装命令: pip install akshare")
        logger.info("")
    
    # 获取资产列表
    assets = get_assets("simple")
    if not assets:
        logger.error("❌ 未获取到资产列表，同步中止")
        logger.error("   请检查: 1) 后端服务是否运行  2) 是否有资产数据")
        return
    
    logger.info(f"📋 获取到 {len(assets)} 个资产")
    
    # 筛选出需要同步价格的资产
    # 目前只支持 A 股 (security 类型且有 ticker)
    sync_assets = [
        a for a in assets 
        if a.get("type") == "security" and a.get("ticker")
    ]
    
    logger.info(f"🔍 其中 {len(sync_assets)} 个资产需要同步价格 (security 类型且有 ticker)")
    logger.info("")
    
    if len(sync_assets) == 0:
        logger.info("💡 提示: 没有需要同步的资产。请确保：")
        logger.info("   1. 已创建资产")
        logger.info("   2. 资产类型为 'security' (股票/证券)")
        logger.info("   3. 已填写 ticker (股票代码)")
        return
    
    # 今天的日期
    today = datetime.now().strftime("%Y-%m-%d")
    
    # 统计
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    # 批量处理
    for i, asset in enumerate(sync_assets, 1):
        asset_id = asset["id"]
        name = asset["name"]
        ticker = asset["ticker"]
        
        logger.info(f"[{i}/{len(sync_assets)}] 处理: {name} ({ticker})")
        
        # 查询价格
        result = query_a_share_price(ticker)
        
        if result is None:
            logger.warning(f"       ⚠️  跳过: 无法获取价格")
            skipped_count += 1
            continue
        
        price = result["price"]
        queried_name = result["name"]
        
        # 验证价格合理性
        if price <= 0:
            logger.warning(f"       ⚠️  跳过: 价格异常 ({price})")
            skipped_count += 1
            continue
        
        # 更新价格
        if update_price(asset_id, price, today):
            logger.info(f"       ✅ 成功: ¥{price:.2f}")
            success_count += 1
        else:
            logger.error(f"       ❌ 失败")
            failed_count += 1
    
    # 统计报告
    logger.info("")
    logger.info("=" * 60)
    logger.info("同步完成统计")
    logger.info("=" * 60)
    logger.info(f"✅ 成功: {success_count}")
    logger.info(f"❌ 失败: {failed_count}")
    logger.info(f"⚠️  跳过: {skipped_count}")
    logger.info(f"📊 总计: {len(sync_assets)}")
    logger.info("=" * 60)
    
    if failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    try:
        sync_prices()
    except KeyboardInterrupt:
        logger.info("\n⚠️  用户中断")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"❌ 同步过程出错: {e}")
        sys.exit(1)
