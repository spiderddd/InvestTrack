#!/usr/bin/env python3
"""
InvestTrack 资产价格自动同步脚本（东方财富版）

注意：黄金价格同步已集成到后端 (server/services/priceSyncService.js)
     此脚本保留作为手动备用工具。

功能：
- 股票行情 (东方财富 API)
- 黄金价格 (5huangjin.com)
"""

import requests
from datetime import datetime
import logging
import sys
import os
import time

# ===== 强制禁用所有代理 =====
for k in [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
]:
    os.environ.pop(k, None)

# 配置
BASE_URL = "http://localhost:3001/api"
LOG_LEVEL = logging.INFO

# 日志
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def get_gold_price():
    """获取并显示主要黄金价格"""
    url = "https://www.5huangjin.com/data/jin.js"

    try:
        response = requests.get(url, timeout=5)
        response.encoding = "utf-8"

        if response.status_code == 200:
            # 提取关键数据
            patterns = {
                "上海黄金": r'var hq_str_gds_AUTD="([^"]+)"',
                "伦敦金": r'var hq_str_hf_XAU="([^"]+)"',
                "纽约黄金": r'var hq_str_hf_GC="([^"]+)"',
            }

            print(f"\n黄金价格 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("-" * 50)

            for name, pattern in patterns.items():
                match = re.search(pattern, response.text)
                if match:
                    data = match.group(1).split(",")
                    if len(data) >= 10:
                        print(f"{name}:")
                        print(f"  价格: {data[0]}")
                        print(f"  涨跌: {data[10]} ({data[11]}%)")
                        print(f"  最高: {data[4]} | 最低: {data[5]}")
                        print(f"  时间: {data[12]} {data[6]}")
                        print()

    except Exception as e:
        print(f"获取数据失败: {e}")


HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://quote.eastmoney.com",
}


def make_secid(ticker: str) -> str:
    """根据股票代码生成 secid"""
    if ticker.startswith(("6", "9", "5")):
        return f"1.{ticker}"  # 上证
    else:
        return f"0.{ticker}"  # 深证


def query_price_eastmoney(ticker: str):
    """
    查询单只股票价格：
    - 优先：最新价
    - 失败 / 非交易时段：最近一个交易日收盘价
    """
    secid = make_secid(ticker)

    # 1️⃣ 尝试实时 / 最新价
    try:
        url = "https://push2.eastmoney.com/api/qt/stock/get"
        params = {"secid": secid, "fields": "f58,f43,f60", "_": int(time.time() * 1000)}

        r = requests.get(url, params=params, headers=HEADERS, timeout=5)
        r.raise_for_status()
        data = r.json()["data"]

        price = data["f43"]
        if price and price > 0:
            return {"name": data["f58"], "price": price / 100}

    except Exception as e:
        logger.debug(f"实时价失败，尝试历史价: {e}")

    # 2️⃣ 回退：最近交易日收盘价（稳定）
    try:
        url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        params = {
            "secid": secid,
            "klt": "101",  # 日线
            "fqt": "0",  # 不复权
            "beg": "19900101",
            "end": datetime.now().strftime("%Y%m%d"),
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55",
        }

        r = requests.get(url, params=params, headers=HEADERS, timeout=5)
        r.raise_for_status()
        klines = r.json()["data"]["klines"]

        if not klines:
            return None

        last = klines[-1].split(",")
        return {
            "name": f"股票{ticker}",
            "price": float(last[2]),  # 收盘价
        }

    except Exception as e:
        logger.error(f"  查询股票 {ticker} 价格失败: {e}")
        return None


# -------------------------------------------------
# InvestTrack API
# -------------------------------------------------


def get_assets(format_type="simple"):
    try:
        r = requests.get(f"{BASE_URL}/assets?format={format_type}", timeout=10)
        r.raise_for_status()
        result = r.json()
        return result.get("data", []) if result.get("success") else []
    except Exception as e:
        logger.error(f"获取资产列表失败: {e}")
        return []


def update_price(asset_id, price, date):
    try:
        r = requests.post(
            f"{BASE_URL}/assets/{asset_id}/price",
            json={"price": price, "date": date},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("success", False)
    except Exception as e:
        logger.error(f"  更新价格失败: {e}")
        return False


# -------------------------------------------------
# 主逻辑（几乎未动）
# -------------------------------------------------


def sync_prices():
    logger.info("=" * 60)
    logger.info("开始同步资产价格（东方财富）")
    logger.info("=" * 60)

    assets = get_assets("simple")
    if not assets:
        logger.error("❌ 未获取到资产列表")
        return

    sync_assets = [a for a in assets if a.get("type") == "security" and a.get("ticker")]

    today = datetime.now().strftime("%Y-%m-%d")

    success = failed = skipped = 0

    for i, asset in enumerate(sync_assets, 1):
        asset_id = asset["id"]
        name = asset["name"]
        ticker = asset["ticker"]

        logger.info(f"[{i}/{len(sync_assets)}] 处理: {name} ({ticker})")

        result = query_price_eastmoney(ticker)

        if not result or result["price"] <= 0:
            logger.warning("       ⚠️  跳过: 无法获取价格")
            skipped += 1
            continue

        if update_price(asset_id, result["price"], today):
            logger.info(f"       ✅ 成功: ¥{result['price']:.2f}")
            success += 1
        else:
            logger.error("       ❌ 失败")
            failed += 1

    logger.info("=" * 60)
    logger.info(f"✅ 成功: {success}")
    logger.info(f"❌ 失败: {failed}")
    logger.info(f"⚠️  跳过: {skipped}")
    logger.info("=" * 60)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    sync_prices()
