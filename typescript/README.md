# RTS Parser (TypeScript)

這是 RTS Binary Data Format v1 的 TypeScript 實作。

## 檔案位置

- 原始碼: [`rts.ts`](rts.ts)

## 功能特點

- **無依賴**: 僅使用原生 `DataView` API，可在瀏覽器、Node.js 或 Deno 環境運行。
- **型別安全**: 完整定義 `RTSData`, `Station`, `RTSHeader` 等介面。
- **BigInt 支援**: 使用 `BigInt` 精確處理 40-bit 時間戳記運算。

## 使用範例

```typescript
import { RTSParser } from './rts';

// 假設 buffer 為 ArrayBuffer 或 Uint8Array
const buffer = new Uint8Array([/* binary data */]);
const parser = new RTSParser(buffer);

try {
  const result = parser.parse();
  
  console.log(`Time: ${new Date(result.header.timestampMs).toISOString()}`);
  console.log(`Stations: ${result.header.stationCount}`);
  
  result.stations.forEach(station => {
    if (station.isAlert) {
      console.warn(`Alert at Station ${station.id.toString(16)}! Intensity: ${station.intensity}`);
    }
  });
} catch (e) {
  console.error("Parsing failed:", e);
}
```

## 資料結構

解析器回傳的 `RTSData` 介面包含：

- `header`: 包含版本、時間戳記與數量統計。
- `stations`: 測站詳細資料陣列 (PGA, PGV, 震度, 警報狀態)。
- `areaIntensities`: 區域震度陣列。
