#pragma once
#include <driver/adc.h>
#include "esp_adc_cal.h"
#include <helpers.h>

// Compatibility for S3 vs Original ESP32 Calibration Enums
#if !defined(ESP_ADC_CAL_VALUE_EFUSE_VREF) && defined(ESP_ADC_CAL_VALUE_VREF)
    #define ESP_ADC_CAL_VALUE_EFUSE_VREF ESP_ADC_CAL_VALUE_VREF
#endif
#if !defined(ESP_ADC_CAL_VALUE_EFUSE_TP) && defined(ESP_ADC_CAL_VALUE_TP)
    #define ESP_ADC_CAL_VALUE_EFUSE_TP ESP_ADC_CAL_VALUE_TP
#endif

/** * @brief Maps a physical GPIO pin to an ADC1 Channel based on Chip Architecture.
 * Supports: ESP32 (TinyBee) and ESP32-S3 (Super Mini)
 */
adc1_channel_t getADC1Channel(int pin) {
#if defined(CONFIG_IDF_TARGET_ESP32S3) || defined(ARDUINO_USB_OTG_ENABLE)
    // --- ESP32-S3 MAPPING (Super Mini) ---
    switch (pin) {
        case 1:
            return ADC1_CHANNEL_0;
        case 2:
            return ADC1_CHANNEL_1;
        case 3:
            return ADC1_CHANNEL_2;
        case 4:
            return ADC1_CHANNEL_3;
        case 5:
            return ADC1_CHANNEL_4;
        case 6:
            return ADC1_CHANNEL_5;
        case 7:
            return ADC1_CHANNEL_6;
        case 8:
            return ADC1_CHANNEL_7;
        case 9:
            return ADC1_CHANNEL_8;
        case 10:
            return ADC1_CHANNEL_9;
        default:
            return (adc1_channel_t)-1;
    }
#elif defined(CONFIG_IDF_TARGET_ESP32) || defined(ARDUINO_ARCH_ESP32)
    // --- ORIGINAL ESP32 MAPPING (TinyBee) ---
    switch (pin) {
        case 36:
            return ADC1_CHANNEL_0;
        case 37:
            return ADC1_CHANNEL_1;
        case 38:
            return ADC1_CHANNEL_2;
        case 39:
            return ADC1_CHANNEL_3;
        case 32:
            return ADC1_CHANNEL_4;
        case 33:
            return ADC1_CHANNEL_5;
        case 34:
            return ADC1_CHANNEL_6;
        case 35:
            return ADC1_CHANNEL_7;
        default:
            return (adc1_channel_t)-1;
    }
#else
    return (adc1_channel_t)-1;
#endif
}

class ESP32_ADC_HAL {
private:
    adc1_channel_t _chan;
    adc_atten_t _atten = ADC_ATTEN_DB_12; // Start at max range
    esp_adc_cal_characteristics_t _chars;
    uint32_t _lastMv = 0;

public:
    ESP32_ADC_HAL(int pin) : _chan(getADC1Channel(pin)) {}

    void begin() {
        // 1. Configure the ADC Hardware first
        adc1_config_width(ADC_WIDTH_BIT_12);
        adc1_config_channel_atten(_chan, _atten);

        // 2. Characterize ADC
        // This looks at the eFuse (Factory Cal) for your specific chip
        esp_adc_cal_value_t val_type = esp_adc_cal_characterize(
            ADC_UNIT_1, 
            _atten, 
            ADC_WIDTH_BIT_12, 
            1100, // Default VRef if eFuse is empty
            &_chars
        );

        // if (val_type == ESP_ADC_CAL_VALUE_EFUSE_VREF) {
        //     debugfln("ADC Cal: Found VRef in eFuse");
        // } else if (val_type == ESP_ADC_CAL_VALUE_EFUSE_TP) {
        //     debugfln("ADC Cal: Found Two-Point calibration");
        // } else {
        //     debugfln("ADC Cal: Using Default VRef (1100mV)");
        // }
    }

    uint32_t readMv() {
        uint32_t mv = 0;
        // THE FIX: Cast adc1_channel_t to adc_channel_t
        esp_adc_cal_get_voltage((adc_channel_t)_chan, &_chars, &mv);

        // --- Marlin-Style Hysteresis Gear Shifting ---
        adc_atten_t nextAtten = _atten;
        
        // Thresholds based on safe linear ranges for each attenuation level
        if (mv < 850 && _atten != ADC_ATTEN_DB_0) {
            nextAtten = ADC_ATTEN_DB_0;
        } else if (mv > 950 && mv < 1150 && _atten != ADC_ATTEN_DB_2_5) {
            nextAtten = ADC_ATTEN_DB_2_5;
        } else if (mv > 1250 && mv < 1650 && _atten != ADC_ATTEN_DB_6) {
            nextAtten = ADC_ATTEN_DB_6;
        } else if (mv > 1750 && _atten != ADC_ATTEN_DB_12) {
            nextAtten = ADC_ATTEN_DB_12;
        }

        // If we need to shift gears, update hardware and calibration mapping
        if (nextAtten != _atten) {
            _atten = nextAtten;
            adc1_config_channel_atten(_chan, _atten);
            esp_adc_cal_characterize(ADC_UNIT_1, _atten, ADC_WIDTH_BIT_12, 1100, &_chars);
            
            // Optional: Take one dummy read to let the voltage settle
            esp_adc_cal_get_voltage((adc_channel_t)_chan, &_chars, &mv);
        }

        _lastMv = mv;
        return mv;
    }
};