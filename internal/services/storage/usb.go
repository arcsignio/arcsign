package storage

import (
	"errors"
	"fmt"

	usbdrivedetector "github.com/SonarBeserk/gousbdrivedetector"
)

// DetectUSBDevices returns a list of detected USB storage device paths.
// Returns empty slice if no devices found.
func DetectUSBDevices() ([]string, error) {
	devices, err := usbdrivedetector.Detect()
	if err != nil {
		return nil, fmt.Errorf("USB detection failed: %w", err)
	}

	if len(devices) == 0 {
		return nil, errors.New("no USB storage devices found")
	}

	return devices, nil
}
