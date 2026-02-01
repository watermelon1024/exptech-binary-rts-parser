package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
)

const (
	SupportedVersion = 1
	Epoch            = 1767225600000
	VarIntScale      = 100.0
	IntensityOffset  = 3.0
)

type RTSHeader struct {
	Version      uint8  `json:"version"`
	TimestampMs  int64  `json:"timestamp_ms"`
	StationCount uint16 `json:"station_count"`
	IntCount     uint16 `json:"int_count"`
	Reserved     uint16 `json:"reserved"`
}

type Station struct {
	ID        uint32  `json:"id"`
	PGA       float64 `json:"pga"`
	PGV       float64 `json:"pgv"`
	Intensity float64 `json:"intensity"`
	IsAlert   bool    `json:"is_alert"`
}

type AreaIntensity struct {
	Code      uint16  `json:"code"`
	Intensity float64 `json:"intensity"`
}

type RTSData struct {
	Header          RTSHeader       `json:"header"`
	Stations        []Station       `json:"stations"`
	AreaIntensities []AreaIntensity `json:"area_intensities"`
}

type RTSParser struct {
	reader io.Reader
}

func NewRTSParser(r io.Reader) *RTSParser {
	return &RTSParser{reader: r}
}

// --- Helper Methods ---

func (p *RTSParser) readExact(size int) ([]byte, error) {
	buf := make([]byte, size)
	// io.ReadFull make sure read exactly size, otherwise returns io.ErrUnexpectedEOF
	if _, err := io.ReadFull(p.reader, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func (p *RTSParser) readU8() (uint8, error) {
	buf, err := p.readExact(1)
	if err != nil {
		return 0, err
	}
	return buf[0], nil
}

func (p *RTSParser) readU16() (uint16, error) {
	buf, err := p.readExact(2)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint16(buf), nil
}

func (p *RTSParser) readU32() (uint32, error) {
	buf, err := p.readExact(4)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint32(buf), nil
}

// little-endian 40-bit signed integer with epoch offset
func (p *RTSParser) readTime40() (int64, error) {
	buf, err := p.readExact(5)
	if err != nil {
		return 0, err
	}

	// Little Endian combination
	raw := int64(buf[0]) |
		int64(buf[1])<<8 |
		int64(buf[2])<<16 |
		int64(buf[3])<<24 |
		int64(buf[4])<<32

	// Sign Extension
	// we shift u40's sign bit to the sign bit of int64, then shift back
	// 64 - 40 = 24, so the shift amount is 24
	raw = raw << 24 >> 24

	return Epoch + raw, nil
}

// variant-length integer decoding
func (p *RTSParser) readVarInt() (float64, error) {
	marker, err := p.readU8()
	if err != nil {
		return 0, err
	}

	var rawVal int64

	if marker <= 0xFC {
		rawVal = int64(marker)
	} else if marker == 0xFD {
		val, err := p.readU16()
		if err != nil {
			return 0, err
		}
		rawVal = int64(val)
	} else if marker == 0xFE {
		// read 3 bytes (u24)
		buf, err := p.readExact(3)
		if err != nil {
			return 0, err
		}
		// Little Endian combination
		val := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16
		rawVal = int64(val)
	} else {
		// 0xFF undefined, temporarily return 0
		rawVal = 0
	}

	return float64(rawVal) / VarIntScale, nil
}

// readIntensityAlert handle intensity and alert flag
func (p *RTSParser) readIntensityAlert() (float64, bool, error) {
	raw, err := p.readU8()
	if err != nil {
		return 0, false, err
	}

	// parse intensity: ((raw & 0x7F) / 10.0) - 3.0
	val := (float64(raw&0x7F) / 10.0) - IntensityOffset

	// round to 1 decimal place
	intensity := math.Round(val*10) / 10

	isAlert := (raw & 0x80) != 0

	return intensity, isAlert, nil
}

// --- Main Parse Logic ---

func (p *RTSParser) Parse() (*RTSData, error) {
	// Check Version
	version, err := p.readU8()
	if err != nil {
		return nil, err
	}
	if version != SupportedVersion {
		return nil, fmt.Errorf("unsupported RTS version: %d", version)
	}

	// Parse Header
	timestampMs, err := p.readTime40()
	if err != nil {
		return nil, err
	}

	stationCount, err := p.readU16()
	if err != nil {
		return nil, err
	}

	intCount, err := p.readU16()
	if err != nil {
		return nil, err
	}

	reserved, err := p.readU16()
	if err != nil {
		return nil, err
	}

	header := RTSHeader{
		Version:      version,
		TimestampMs:  timestampMs,
		StationCount: stationCount,
		IntCount:     intCount,
		Reserved:     reserved,
	}

	// Parse Stations
	stations := make([]Station, stationCount)
	for i := 0; i < int(stationCount); i++ {
		id, err := p.readU32()
		if err != nil {
			return nil, err
		}

		pga, err := p.readVarInt()
		if err != nil {
			return nil, err
		}

		pgv, err := p.readVarInt()
		if err != nil {
			return nil, err
		}

		intensity, isAlert, err := p.readIntensityAlert()
		if err != nil {
			return nil, err
		}

		stations[i] = Station{
			ID:        id,
			PGA:       pga,
			PGV:       pgv,
			Intensity: intensity,
			IsAlert:   isAlert,
		}
	}

	// Parse Area Intensities
	areaInts := make([]AreaIntensity, intCount)
	for i := 0; i < int(intCount); i++ {
		code, err := p.readU16()
		if err != nil {
			return nil, err
		}

		rawI, err := p.readU8()
		if err != nil {
			return nil, err
		}

		// handle area intensity
		val := (float64(rawI) / 10.0) - IntensityOffset
		intensity := math.Round(val*10) / 10

		areaInts[i] = AreaIntensity{
			Code:      code,
			Intensity: intensity,
		}
	}

	return &RTSData{
		Header:          header,
		Stations:        stations,
		AreaIntensities: areaInts,
	}, nil
}

// --- Example Usage ---

func main() {
	// read example RTS binary data from "example.rts"
	mockData, err := os.ReadFile("rts_example.bin")
	if err != nil {
		fmt.Printf("Error reading file: %v\n", err)
		return
	}

	// Create Parser
	reader := bytes.NewReader(mockData)
	parser := NewRTSParser(reader)

	// Execute parsing
	data, err := parser.Parse()
	if err != nil {
		fmt.Printf("Error parsing data: %v\n", err)
		return
	}

	// Convert to JSON and output
	jsonData, _ := json.MarshalIndent(data, "", "  ")
	fmt.Println(string(jsonData))
}
