# Exptech Binary RTS Parser

本專案提供 Exptech 定義之 **RTS (Real-time Station) Binary Data Format v1** 的多語言解析器實作。

所有實作邏輯皆嚴格參照 [`rts.hexpat`](rts.hexpat) (ImHex Pattern) 的定義。

## 專案結構

本儲存庫包含多種程式語言的實作，請參考各自的說明文件：

- **Python**: [python/README.md](python/README.md)
- **TypeScript**: [typescript/README.md](typescript/README.md)

## 格式定義 (ImHex)

二進制格式定義檔位於 [`rts.hexpat`](rts.hexpat)。主要的底層資料類型包括：

- **VarInt**: 變動長度整數 (1, 2, 或 3 bytes)，解析後需除以 100。
- **Time40**: 40-bit (5 bytes) 小端序時間戳 (Epoch: 2026-01-01)。
- **IntensityAlert**: 單一位元組，包含震度數值與警報旗標。

## 授權

本專案採用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 授權。詳細內容請參閱 [`LICENSE`](LICENSE) 檔案。
