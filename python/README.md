# RTS Parser (Python)

這是 RTS Binary Data Format v1 的 Python 實作。

## 檔案位置

- 原始碼: [`rts.py`](rts.py)

## 環境需求

- Python 3.6+

## 功能特點

- **純 Python**: 僅使用標準函式庫 (`io`, `struct`, `typing`)，無外部依賴。
- **強型別提示**: 提供完整 `TypedDict` 定義，便於 IDE 自動補全與靜態檢查。
- **高效解析**: 支援 `bytes` 或 `BinaryIO` (File-like object) 串流讀取。

## 使用範例

### 從檔案讀取

```python
import json
from rts import RTSParser

# 讀取二進制檔案
with open("rts_data.bin", "rb") as f:
    parser = RTSParser(f)
    try:
        result = parser.parse()
        print(json.dumps(result, indent=2))
    except ValueError as e:
        print(f"Parsing error: {e}")
```

### 從 Bytes 讀取

```python
from rts import RTSParser

data_bytes = b'\x01...' # 您的二進制數據
parser = RTSParser(data_bytes)
result = parser.parse()

print(f"Timestamp: {result['header']['timestamp_ms']}")
print(f"Stations count: {len(result['stations'])}")
```

## 資料結構

解析器回傳的 `RTSData` 字典結構如下：

### Header

| 欄位 | 類型 | 說明 |
| --- | --- | --- |
| `version` | `int` | 格式版本 (目前僅支援 v1) |
| `timestamp_ms` | `int` | Unix 時間戳記 (毫秒) |
| `station_count` | `int` | 測站數量 |
| `int_count` | `int` | 區域震度數量 |
| `reserved` | `int` | 保留欄位 |

### Stations (測站資料)

包含在 `stations` 列表中：

| 欄位 | 類型 | 說明 |
| --- | --- | --- |
| `id` | `int` | 測站 ID (Hex 格式) |
| `pga` | `float` | 最大地動加速度 (已轉換單位) |
| `pgv` | `float` | 最大地動速度 (已轉換單位) |
| `intensity` | `float` | 計算震度 (已扣除 offset) |
| `is_alert` | `bool` | 是否觸發警報 |

### Area Intensities (區域震度)

包含在 `area_intensities` 列表中：

| 欄位 | 類型 | 說明 |
| --- | --- | --- |
| `code` | `int` | 區域代碼 |
| `intensity` | `float` | 區域震度 |
