#pragma once
#include <Control/Control.h>
#include <functional>

typedef void (*TouchCallback)();
extern std::vector<ControlBase*> uiRegistry;

class Module_Touch {
public:
    MultiControl control;
    
    int touchPin;
    int sensitivity; // Percentage drop to trigger (e.g. 20 means 20% drop)
    TouchCallback onAction = nullptr;

    bool isTouched = false;
    unsigned long lastTouchTime = 0;
    unsigned long lastReleaseTime = 0;

    uint16_t baseline = 0;

    Module_Touch(const char* group, const char* id, const char* name)
        : control(group, id, "button", name) {
        control.values.reserve(6);
    }

    /**
     * @param pin ESP32 Touch Pin
     * @param _sensitivity % deviation from baseline to trigger (e.g. 25)
     * @param _cb Callback
     */
    void setup(int pin, int _sensitivity, TouchCallback _cb) {
        touchPin = pin;
        sensitivity = _sensitivity;
        onAction = _cb;

        // Initial Calibration: Average 10 readings
        uint32_t sum = 0;
        for(int i=0; i<10; i++) {
            sum += touchRead(touchPin);
            delay(10);
        }
        baseline = sum / 10;

        control.addValue("click", false, false);

        control.onUpdate = [this](const char* id, const char* key, JsonVariant val) {
                 if (this->onAction) this->onAction();
             };
        uiRegistry.push_back(&control);

        xTaskCreatePinnedToCore(taskWrapper, "TouchTask", 2048, this, 1, nullptr, 1);
    }

private:
    static void taskWrapper(void* pv) {
        auto* self = static_cast<Module_Touch*>(pv);
        self->runLoop();
    }

    void runLoop() {
        const int DOUBLE_TAP_WINDOW = 500; 
        const int MIN_TOUCH_MS = 60; // Higher for rain rejection
        
        for (;;) {
            uint16_t raw = touchRead(touchPin);
            //*reading_ui = (int)raw;
            // 1. DYNAMIC THRESHOLD CALCULATION
            // Trigger if current reading is X% lower than baseline
            int32_t diff = (int32_t)raw - (int32_t)baseline;
            uint16_t absDiff = abs(diff);
            
            uint16_t triggerThreshold = (baseline * sensitivity)/100;
            bool pressed = (absDiff > triggerThreshold);

            // 2. Slow Drift Compensation (Optional but pro)
            // If NOT pressed, slowly nudge baseline toward current 'raw' 
            // to account for humidity changes over hours.
            if (!pressed && !isTouched) {
                baseline = (baseline * 999 + raw) / 1000; 
            }

            unsigned long now = millis();

            if (pressed && !isTouched) {
                isTouched = true;
                lastTouchTime = now;
            } 
            else if (!pressed && isTouched) {
                isTouched = false;
                unsigned long duration = now - lastTouchTime;

                if (duration > MIN_TOUCH_MS) {
                    if (now - lastReleaseTime < DOUBLE_TAP_WINDOW) {
                        if (onAction) onAction();
                        lastReleaseTime = 0; 
                    } else {
                        lastReleaseTime = now;
                    }
                }
            }

            vTaskDelay(pdMS_TO_TICKS(30));
        }
    }
};