import io
import struct
from typing import TYPE_CHECKING, BinaryIO, Union

if TYPE_CHECKING:
    from typing import TypedDict

    class RTSHeader(TypedDict):
        version: int
        timestamp_ms: int
        station_count: int
        int_count: int
        reserved: int

    class Station(TypedDict):
        id: int
        pga: float
        pgv: float
        intensity: float
        is_alert: bool

    class AreaIntensity(TypedDict):
        code: int
        intensity: float

    class RTSData(TypedDict):
        header: RTSHeader
        stations: "list[Station]"
        area_intensities: "list[AreaIntensity]"


EPOCH = 1767225600000  # ms


class RTSParser:
    """
    解析 RTS（二進位格式）資料的類別
    參考 .hexpat 中的 struct 定義與格式說明
    """

    stream: BinaryIO  # use better type hint?

    def __init__(self, data: Union[bytes, BinaryIO]):
        """
        初始化 RTSParser 物件

        :param data: 輸入的資料，可以是 bytes 或具有 read() 方法的檔案類物件
        :type data: bytes | BinaryIO

        :raises TypeError: 當輸入資料型態不符合要求時拋出
        """
        if isinstance(data, (bytes, bytearray, memoryview)):
            self.stream = io.BytesIO(data)
        elif hasattr(data, "read"):  # use better type check?
            self.stream = data
        else:
            raise TypeError("data must be bytes or a file-like object")

    # --- Helper methods to read various data types ---
    # u8, u16, u32, Time40, VarInt, IntensityAlert
    # using fail-fast approach: raise EOFError on insufficient data

    def _read_u8(self):
        "unsigned 8-bit integer"
        data = self.stream.read(1)
        if not data:
            raise EOFError("Unexpected end of stream while reading u8")
        return data[0]  # u8

    def _read_u16(self):
        "unsigned 16-bit integer"
        data = self.stream.read(2)
        if len(data) < 2:
            raise EOFError("Unexpected end of stream while reading u16")
        return struct.unpack("<H", data)[0]  # little-endian unsigned short (u16)

    def _read_u32(self):
        "unsigned 32-bit integer"
        data = self.stream.read(4)
        if len(data) < 4:
            raise EOFError("Unexpected end of stream while reading u32")
        return struct.unpack("<I", data)[0]  # little-endian unsigned int (u32)

    def _read_time40(self):
        """
        Time40 (5 bytes)
        u64 ms = b0 | b1<<8 | b2<<16 | b3<<24 | b4<<32
        """
        # little-endian signed int40 (5 bytes)
        raw_bytes = self.stream.read(5)
        if len(raw_bytes) < 5:
            raise EOFError("Unexpected end of stream while reading time40")
        return int.from_bytes(raw_bytes, byteorder="little", signed=True) + EPOCH

    def _read_varint(self):
        """
        VarInt + format_varint
        回傳值要 / 100
        """
        marker = self._read_u8()

        raw_val = 0
        if marker <= 0xFC:
            # Case 1: 1 byte
            raw_val = marker
        elif marker == 0xFD:
            # Case 2: marker + u16 (2 bytes)
            raw_val = self._read_u16()
        elif marker == 0xFE:
            # Case 3: marker + u8 * 3 = u24 (3 bytes)
            b = self.stream.read(3)
            if len(b) < 3:
                raise EOFError("Unexpected end of stream while reading varint u24")
            raw_val = int.from_bytes(b, byteorder="little")
        # .hexpat hasn't defined marker == 0xFF ?

        return raw_val / 100.0

    def _read_intensity_alert(self):
        """
        IntensityAlert + format_intensity
        """
        raw = self._read_u8()

        # parse Intensity (low 7 bits)
        intensity = ((raw & 0x7F) / 10.0) - 3.0
        # fix floating point precision issue
        intensity = round(intensity, 1)
        # parse Alert Flag (highest bit)
        is_alert = (raw & 0x80) != 0

        return (intensity, is_alert)

    def _read_station(self) -> "Station":
        """
        解析單一測站資料並回傳結構化的結果
        """
        # u32 station id
        s_id = self._read_u32()
        # VarInt pga, pgv
        pga = self._read_varint()
        pgv = self._read_varint()
        # IntensityAlert
        intensity, is_alert = self._read_intensity_alert()

        return {"id": s_id, "pga": pga, "pgv": pgv, "intensity": intensity, "is_alert": is_alert}

    def parse(self) -> "RTSData":
        """
        解析 RTS 資料並回傳結構化的結果

        :return: 解析後的 RTS 資料 (Python dict)
        :rtype: RTSData
        """
        # u8 version
        version = self._read_u8()
        if version != 1:
            raise ValueError(f"Unsupported RTS version: {version}")
        # Time40 time
        timestamp_ms = self._read_time40()
        # u16 station_count
        station_count = self._read_u16()
        # u16 int_count
        int_count = self._read_u16()
        # u16 reserved
        reserved = self._read_u16()
        return {
            "header": {
                "version": version,
                "timestamp_ms": timestamp_ms,
                "station_count": station_count,
                "int_count": int_count,
                "reserved": reserved,
            },
            "stations": [self._read_station() for _ in range(station_count)],
            "area_intensities": [
                {
                    # u16 code
                    "code": self._read_u16(),
                    # u8 i (with format)
                    "intensity": round((self._read_u8() / 10.0) - 3.0, 1),
                }
                for _ in range(int_count)
            ],
        }


if __name__ == "__main__":
    with open("rts_example.bin", "rb") as f:
        parser = RTSParser(f)
        parsed_data = parser.parse()

    import json

    with open("rts_example_parsed.json", "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, ensure_ascii=False, indent=2)
