# RTS Parser (JavaScript)

這是 RTS Binary Data Format v1 的 JavaScript 實作。

## 檔案位置

- 原始碼: [`rts.js`](rts.js)

## 功能特點

- **通用性**: 僅使用原生 `DataView` API，可在瀏覽器、Node.js 等任何支援 ES6 的環境運行。
- **無依賴**: 不需要安裝任何 npm 套件。
- **BigInt 支援**: 使用 `BigInt` 精確處理 40-bit 時間戳記運算。

## 使用範例

### Node.js

```javascript
const fs = require("fs");
const { RTSParser } = require('./rts');

const buffer = fs.readFileSync("rts_example.bin");
// Node.js Buffer 可以直接作為 Uint8Array 使用，但明確轉換更安全
const parser = new RTSParser(new Uint8Array(buffer));

try {
  const result = parser.parse();
  console.log("Timestamp:", new Date(result.header.timestampMs));
  console.log("Stations:", result.header.stationCount);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Parsing failed:", e.message);
}
```

### 瀏覽器

```javascript
/* 假設已載入 RTSParser */

fetch('rts_data.bin')
  .then(res => res.arrayBuffer())
  .then(buffer => {
    const parser = new RTSParser(buffer);
    const result = parser.parse();
    console.log(result);
  });
```

## 資料結構

解析器回傳的物件結構如下：

- `header`
  - `version`: (Number) 格式版本
  - `timestampMs`: (Number) Unix 時間戳記 (毫秒)
  - `stationCount`: (Number) 測站數量
  - `intCount`: (Number) 區域震度數量
- `stations`: 測站物件陣列
  - `id`: (Number) 測站 ID
  - `pga`: (Number) 最大地動加速度
  - `pgv`: (Number) 最大地動速度
  - `intensity`: (Number) 震度
  - `isAlert`: (Boolean) 是否警報
- `areaIntensities`: 區域震度陣列
