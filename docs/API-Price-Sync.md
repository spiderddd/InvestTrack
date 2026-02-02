# InvestTrack 价格同步 API

## 1. 更新资产价格

**POST** `/api/assets/:id/price`

### 请求示例
```bash
curl -X POST http://localhost:3001/api/assets/{资产ID}/price \
  -H "Content-Type: application/json" \
  -d '{"price": 158.75, "date": "2024-02-01"}'
```

### 参数
- `price` (number, 必填): 资产价格，必须为正数
- `date` (string, 可选): 日期格式 `YYYY-MM-DD`，默认当天

### 响应
```json
{
  "success": true,
  "data": {"success": true},
  "message": "Price updated successfully"
}
```

---

## 2. 获取资产列表

**GET** `/api/assets?format=simple`

### 请求示例
```bash
curl http://localhost:3001/api/assets?format=simple
```

### 响应
```json
{
  "success": true,
  "data": [
    {"id": "xxx", "name": "贵州茅台", "type": "security", "ticker": "600519"},
    {"id": "yyy", "name": "腾讯控股", "type": "security", "ticker": "00700"}
  ]
}
```

### 查询参数
- `format=simple`: 简化格式（不含 createdAt）
- `fields=id,name,type,ticker`: 只返回指定字段

---

## 3. 完整 Python 脚本

保存为 `sync_prices.py`：

```python
#!/usr/bin/env python3
"""InvestTrack 价格自动同步脚本"""

import requests
from datetime import datetime

try:
    import akshare as ak
except ImportError:
    print("请先安装 akshare: pip install akshare")
    exit(1)

BASE_URL = "http://localhost:3001/api"

def main():
    # 1. 获取资产列表
    assets = requests.get(f"{BASE_URL}/assets?format=simple").json()["data"]
    
    # 2. 筛选股票类资产
    stocks = [a for a in assets if a["type"] == "security" and a.get("ticker")]
    print(f"找到 {len(stocks)} 个股票资产")
    
    # 3. 批量更新价格
    today = datetime.now().strftime("%Y-%m-%d")
    
    for asset in stocks:
        ticker = asset["ticker"]
        
        # 查询 A 股价格
        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == ticker]
            if row.empty:
                continue
                
            price = float(row["最新价"].values[0])
            
            # 更新价格
            requests.post(
                f"{BASE_URL}/assets/{asset['id']}/price",
                json={"price": price, "date": today}
            )
            print(f"✅ {asset['name']} ({ticker}): ¥{price}")
            
        except Exception as e:
            print(f"❌ {asset['name']}: {e}")

if __name__ == "__main__":
    main()
```

### 使用方法

```bash
# 安装依赖
pip install requests akshare

# 运行
python sync_prices.py

# 设置定时任务（每天下午 3:30）
crontab -e
# 添加：30 15 * * * /usr/bin/python3 /path/to/sync_prices.py
```

---

## 资产类型

| 类型 | 说明 | 价格源 |
|------|------|--------|
| `security` | 股票/证券 | akshare |
| `fund` | 基金 | 天天基金 |
| `gold` | 黄金 | 上海金交所 |
| `crypto` | 加密货币 | 币安 |
| `fixed` | 固收 | 固定利率 |

---

## 快速测试

```bash
# 测试资产列表
curl http://localhost:3001/api/assets?format=simple | jq

# 测试更新价格（替换 {id}）
curl -X POST http://localhost:3001/api/assets/{id}/price \
  -H "Content-Type: application/json" \
  -d '{"price": 100}'
```
