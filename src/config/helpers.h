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
#define SEC_PER_DAY 86400
#define WITHIN(N,L,H)       ((N) >= (L) && (N) <= (H))
#define NEAR_ZERO(x) WITHIN(x, -0.000001f, 0.000001f)
#define RECIPROCAL(x) (NEAR_ZERO(x) ? 0 : (1 / float(x)))
#define cu(x)      ({__typeof__(x) _x = (x); (_x)*(_x)*(_x);})

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



