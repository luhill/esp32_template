#pragma once

#include <Arduino.h>
#include <cstdint>
#include <freertos/FreeRTOS.h>
#include <freertos/portmacro.h>
#include <FastLED.h>
// ---- Debugging templates ---- //

#define DEBUGGING true

#if DEBUGGING
template <typename T>
inline void debug(const T &x) { Serial.print(x); }

template <typename T>
inline void debugln(const T &x) { Serial.println(x); }

// Overloads for float with precision.
inline void debug(float x, int digits) { Serial.print(x, digits); }
inline void debugln(float x, int digits) { Serial.println(x, digits); }

// printf-style debug macros.
#define debugf(...) Serial.printf(__VA_ARGS__)
#define debugfln(fmt, ...) Serial.printf(fmt "\n", ##__VA_ARGS__)

#else
template <typename T>
inline void debug(const T &) {}
template <typename T>
inline void debugln(const T &) {}
inline void debug(float, int) {}
inline void debugln(float, int) {}
#define debugf(...)
#define debugfln(...)
#endif

#define MS_PER_DAY 86400000ULL
constexpr int timeToSec(int h, int m) { return (h * 3600) + (m * 60); }

/**
 * @brief Monotonic microsecond clock (preferred for stamps & durations).
 * @note Uses esp_timer_get_time() under Arduino-ESP32 (64-bit, monotonic).
 */
inline uint64_t now_us() { return esp_timer_get_time(); }

/// @brief Convenience 32-bit millisecond time (wraps ~49 days).
inline uint32_t now_ms32() { return static_cast<uint32_t>(now_us() / 1000ULL); }

/// @brief Convert milliseconds to FreeRTOS ticks.
inline TickType_t to_ticks_ms(uint32_t ms) { return pdMS_TO_TICKS(ms); }

// ---- Application configuration settings ---- //


// namespace cfg
// {
//     // ---- Canonical task cadences ---- //
//     namespace tick
//     {
//         constexpr uint32_t LOOP_MS = 10;                   ///< Standard loop cadence.
//         constexpr uint32_t LOOP_INTERVAL_TEST_SHORT = 100; ///< Short test ms.
//         constexpr uint32_t LOOP_INTERVAL_TEST_LONG = 1000; ///< Long test ms.
//     } ///< Namespace tick.

//     // ---- Button Timings ---- //
//     namespace button
//     {
//         constexpr uint32_t BTN_DEBOUNCE_MS = 1;
//         constexpr uint32_t BTN_SHORT_MS = 1;
//         constexpr uint32_t BTN_LONG_MS = 1000;
//     } ///< Namespace button.

//     // ---- Motor (MCPWM) ---- //
//     namespace motor
//     {
//         constexpr int RPWM_PIN = -1;
//         constexpr int LPWM_PIN = 6;
//         constexpr int EN_PIN = -1;
//     } ///< Namespace motor.

//     // ---- Remote Control (RCLink) ---- //
//     namespace rotary_encoder{
//         constexpr byte PIN_ROTARY_A = 11;       ///< iBUS data in.
//         constexpr byte PIN_ROTARY_B = 12;      ///< Not required for iBUS (disabled).
//         constexpr byte PIN_ROTARY_S = 13; 
//     } ///< Namespace rotary_encoder.
//     namespace led{
//         constexpr byte PIN_LED_DATA_ONBOARD = 48; ///< ESP32 S3 mini built in led data pin on GPIO 48
//         constexpr byte PIN_LED_DATA = 7;
//         constexpr uint8_t NUM_LEDS = 2;
//         constexpr uint8_t COLOR_ORDER = BRG;
//         // Note: LED_TYPE is defined as a macro above since it's a type, not a value
//     }
// } ///< Namespace cfg.


