#pragma once

#ifndef SHIFT_REGISTER_DMA_H
#define SHIFT_REGISTER_DMA_H
#define HAS_DMA
#include <Arduino.h>

// // MKS Tinybee Hardwired Pins
// #define I2S_BCK_IO 25  // SRCLK (Clock)
// #define I2S_WS_IO  26  // RCLK  (Latch)
// #define I2S_DO_IO  27  // SER   (Data)

#define MAX_PINS   24 //3x shift registers with 8 output pins each (OE tied low for always on)

static uint32_t i2s_port_data = 0;


#define IS_EXPANDER_PIN(p) ((p) & 0x80) // Check if pin >= 128, which indicates it's an expander pin
#define GET_EXPANDER_INDEX(p)   ((p) & 0x7F) // Subtract 128 to get 0-based index for expander pins
#define TEST_BIT_32(n, b)  (!!((n) & (1UL << (b)))) //read bit b of a 32-bit number n

struct PinConfig {
    uint32_t duty_ticks = 0;
    uint32_t cycle_ticks = 250; // Default to 1kHz PWM frequency at 250kHz sample rate
    uint32_t counter = 0;
    float duty_percent = 0.0f; // For easier UI interaction, store the duty cycle as a percentage
};
inline TaskHandle_t handle_dma = nullptr;

void initShiftRegisterDMA(uint8_t PIN_BCK, uint8_t PIN_WS, uint8_t PIN_DATA);

void setFreq(uint8_t pin, uint32_t frequency_hz);
void aWrite(uint8_t pin, float duty_percent);       // 0.0 to 100.0
void dWrite(uint8_t pin, bool value);
void setCycles(uint8_t pin, uint32_t cycle_ticks);  // Directly set duty in ticks (0 to cycle_ticks)                                         

void applyHardwareFixes(); // Applies necessary register tweaks for timing and MSB alignment
float getPWMDuty(uint8_t pin);



#endif