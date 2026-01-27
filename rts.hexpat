#pragma endian little
#pragma pattern_limit 100000

import std.io;

// RTS 二進制數據格式 v1 - ImHex Pattern

// VarInt 類型
struct VarInt {
    u8 marker;
    if (marker <= 0xFC) {
        // 單位元組，值就是 marker
    } else if (marker == 0xFD) {
        u16 value;
    } else if (marker == 0xFE) {
        u8 b0;
        u8 b1;
        u8 b2;
    }
} [[format("format_varint")]];

fn format_varint(VarInt v) {
    if (v.marker <= 0xFC) {
        return v.marker / 100.0;
    } else if (v.marker == 0xFD) {
        return v.value / 100.0;
    } else {
        return (v.b0 | (v.b1 << 8) | (v.b2 << 16)) / 100.0;
    }
};

// 震度 + Alert 欄位
struct IntensityAlert {
    u8 raw;
} [[format("format_intensity")]];

fn format_intensity(IntensityAlert ia) {
    double i = ((ia.raw & 0x7F) / 10.0) - 3.0;
    bool alert = (ia.raw & 0x80) != 0;
    return i;
};

// 站點資料
struct Station {
    u32 id [[format("format_hex_id"), comment("Station ID (hex)")]];
    VarInt pga [[comment("PGA value")]];
    VarInt pgv [[comment("PGV value")]];
    IntensityAlert intensity [[comment("Intensity + Alert flag")]];
};

fn format_hex_id(u32 id) {
    return id;
};

// Int 區域震度
struct IntEntry {
    u16 code [[comment("Area code")]];
    u8 i [[format("format_int_i"), comment("Intensity")]];
};

fn format_int_i(u8 raw) {
    return (raw / 10.0) - 3.0;
};

// 時間戳 (5 bytes, uint40)
struct Time40 {
    u8 bytes[5];
} [[format("format_time40")]];

fn format_time40(Time40 t) {
    u64 ms = t.bytes[0]
           | (u64(t.bytes[1]) << 8)
           | (u64(t.bytes[2]) << 16)
           | (u64(t.bytes[3]) << 24)
           | (u64(t.bytes[4]) << 32);
    return ms;
};

// Header
struct Header {
    u8 version [[comment("Format version")]];
    Time40 time [[comment("Unix timestamp (ms)")]];
    u16 station_count [[comment("Number of stations")]];
    u16 int_count [[comment("Number of int entries")]];
    u16 reserved [[comment("Reserved")]];
};

// 主結構
struct RtsData {
    Header header;
    Station stations[header.station_count];
    IntEntry ints[header.int_count];
};

RtsData rts @ 0x00;
