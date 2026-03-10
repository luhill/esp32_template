#pragma once
#include <Control/Control.h>
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  // S3: Use the modern RMT driver (Native & Fast)
  #define FASTLED_ESP32_RAW_RMT 
#else
#endif
#include <FastLED.h>

class Module_Led {
public:
    MultiControl control;
    
    // Pointers for high-speed task access
    int* bright = nullptr;
    int* r = nullptr;
    int* g = nullptr;
    int* b = nullptr;
    bool* isOn = nullptr;
    int* mode = nullptr;
    int* speed = nullptr;

    // FastLED Specifics
    CLEDController* controller = nullptr;
    CRGB* leds = nullptr;
    int numLeds = 0;
    uint8_t gHue = 0;

    Module_Led(const char* group, const char* id, const char* name)
        : control(group, id, "led", name) 
    {
        control.values.reserve(12);
    }

    // Template allows passing any LED type (WS2812, SK6812, etc.)
    template<template<uint8_t PIN, EOrder RGB_ORDER> class CHIPSET, uint8_t DATA_PIN, EOrder RGB_ORDER>
    void setup(int _numLeds) {
        numLeds = _numLeds;
        
        // 1. Dynamic Memory Allocation for the LED array
        leds = new CRGB[numLeds];
        
        // 2. Initialize specific controller (prevents global FastLED.show() crosstalk)
        controller = &FastLED.addLeds<CHIPSET, DATA_PIN, RGB_ORDER>(leds, numLeds)
                             .setCorrection(TypicalLEDStrip);

        // 3. Control Setup
        control.addValue("on", true, true);
        control.addValue("brightness", 255, true);
        control.addValue("mode", 0, true);
        control.addValue("speed", 50, true);
        control.addValue("color.r", 255);
        control.addValue("color.g", 0);
        control.addValue("color.b", 187);

        // 4. Metadata
        control.setMeta("max_brightness", 255);
        control.addArray("modes", "Solid", "Rainbow", "Breathe", "Fire");

        uiRegistry.push_back(&control);

        // 5. Cache Pointers
        bright = control.getIntPtr("brightness");
        isOn   = control.getBoolPtr("on");
        mode   = control.getIntPtr("mode");
        speed  = control.getIntPtr("speed");
        r      = control.getIntPtr("color.r");
        g      = control.getIntPtr("color.g");
        b      = control.getIntPtr("color.b");

        xTaskCreatePinnedToCore(task, "LedTask", 4096, this, 1, nullptr, 1);
    }

private:
    static void task(void* pv) {
        auto* self = static_cast<Module_Led*>(pv);
        self->runLoop();
    }

    void runLoop() {
        vTaskDelay(pdMS_TO_TICKS(500));

        for (;;) {
            if (isOn && *isOn) {
                // Use controller-specific brightness
                uint8_t finalBright = (uint8_t)*bright;
                
                switch (*mode) {
                    case 0: // SOLID
                        fill_solid(leds, numLeds, CRGB(*r, *g, *b));
                        break;
                    
                    case 1: // RAINBOW
                        fill_rainbow(leds, numLeds, gHue, 7);
                        gHue++;
                        break;
                }
                // Show ONLY this strip
                controller->showLeds(finalBright);
            } else {
                // Turn off only this strip
                fill_solid(leds, numLeds, CRGB::Black);
                controller->showLeds(0);
            }

            int delayTime = (int)((float)(100 - *speed) / 100.0f * 490.0f + 10.0f);
            vTaskDelay(pdMS_TO_TICKS(delayTime));
        }
    }
};