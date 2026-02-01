# RTS Parser (Go)

這是 RTS Binary Data Format v1 的 Go (Golang) 實作。

## 檔案位置

- 原始碼: [`rts.go`](rts.go)

## 環境需求

- Go 1.10+

## 功能特點

- **介面導向**: 使用 `io.Reader` 介面，支援檔案、網路串流或記憶體 Buffer。
- **標準庫**: 僅依賴 Go 標準函式庫 (`io`, `encoding/binary`, `encoding/json`, `math`)。
- **JSON 標籤**: 結構體已包含 `json` 標籤，方便直接序列化輸出。

## 使用範例

### 從檔案讀取

```go
package main

import (
  "fmt"
  "os"
)

func main() {
  f, err := os.Open("rts_data.bin")
  if err != nil {
    panic(err)
  }
  defer f.Close()

  parser := NewRTSParser(f)
  data, err := parser.Parse()
  if err != nil {
    panic(err)
  }

  fmt.Printf("Timestamp: %d\n", data.Header.TimestampMs)
  fmt.Printf("Stations: %d\n", len(data.Stations))
}
```

### 從 Bytes 讀取

```go
import (
  "bytes"
  "fmt"
)

func parseBytes(data []byte) {
  reader := bytes.NewReader(data)
  parser := NewRTSParser(reader)

  result, err := parser.Parse()
  if err != nil {
    fmt.Println("Error:", err)
    return
  }
  // ...
}
```

## 資料結構

解析器回傳的 `RTSData` 結構如下：

```go
type RTSData struct {
 Header          RTSHeader       `json:"header"`
 Stations        []Station       `json:"stations"`
 AreaIntensities []AreaIntensity `json:"area_intensities"`
}
```

### Header

| 欄位 | Go 類型 | 說明 |
| --- | --- | --- |
| `Version` | `uint8` | 格式版本 |
| `TimestampMs` | `int64` | Unix 時間戳記 (毫秒) |
| `StationCount` | `uint16` | 測站數量 |
| `IntCount` | `uint16` | 區域震度數量 |
| `Reserved` | `uint16` | 保留欄位 |

### Station

| 欄位 | Go 類型 | 說明 |
| --- | --- | --- |
| `ID` | `uint32` | 測站 ID |
| `PGA` | `float64` | 最大地動加速度 |
| `PGV` | `float64` | 最大地動速度 |
| `Intensity` | `float64` | 震度 |
| `IsAlert` | `bool` | 是否觸發警報 |

### AreaIntensity

| 欄位 | Go 類型 | 說明 |
| --- | --- | --- |
| `Code` | `uint16` | 區域代碼 |
| `Intensity` | `float64` | 區域震度 |
