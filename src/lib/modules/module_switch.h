#pragma once
#include <driver/touch_sensor.h>
#include <helpers.h>

#include <functional>

#include <Control/Control.h>

typedef void (*InputCallback)();

extern std::vector<ControlBase*> uiRegistry;

class Module_Switch {
   public:
    MultiControl control;
    int pin = -1;
    InputCallback onAction = nullptr;

    // Internal state tracking
    bool* on = nullptr;
    volatile uint64_t lastTouchTime = 0;
    volatile bool pendingFirstTap = false;

    Module_Switch(const char* group, const char* id, const char* name)
        : control(group, id, "switch", name) {
        control.values.reserve(1);
    }

    /**
     * @param _pin Pin number
     * @param isTouch True for touch, False for GPIO
     * @param _cb OPTIONAL callback (pass nullptr or leave empty if not needed)
     */
    void setup(int _pin = -1, bool isTouch = false, InputCallback _cb = nullptr,
               int sensitivity = 25) {
        pin = _pin;
        onAction = _cb;

        // 1. Setup the UI Control
        control.addValue("on", false, true);
        on = control.getBoolPtr("on");

        control.onUpdate = [this](const char* id, const char* key,
                                  JsonVariant val) { this->trigger(); };
        uiRegistry.push_back(&control);

        // 2. Setup Hardware Interrupts (S3/ESP32 Universal)
        if (isTouch) {
            touch_pad_init();
#if CONFIG_IDF_TARGET_ESP32S3
            touch_filter_config_t filter_info = {
                .mode = TOUCH_PAD_FILTER_IIR_16,
                .debounce_cnt = 1,
                .noise_thr = 0,
                .jitter_step = 4,
                .smh_lvl = TOUCH_PAD_SMOOTH_IIR_2};
            touch_pad_filter_set_config(&filter_info);
            touch_pad_filter_enable();
            uint32_t v;
            touch_pad_read_raw_data((touch_pad_t)pin, &v);
#else
            touch_pad_filter_start(10);
            uint16_t v = touchRead(pin);
#endif
            int threshold = (v * (100 - sensitivity)) / 100;
            touchAttachInterruptArg(pin, isr_handler_touch, this, threshold);
        } else if (pin != -1) {
            pinMode(pin, INPUT_PULLUP);
            attachInterruptArg(pin, isr_handler_interrupt, this, FALLING);
        }
    }

    // Logic to toggle state and run optional callback
    void trigger() {
        if (onAction) onAction();  // Run callback ONLY if provided
    }

   private:
    static void IRAM_ATTR isr_handler_interrupt(void* arg);
    static void IRAM_ATTR isr_handler_touch(void* arg);
};
void IRAM_ATTR Module_Switch::isr_handler_interrupt(void* arg) {
    Module_Switch* self = static_cast<Module_Switch*>(arg);
    uint64_t now = esp_timer_get_time() / 1000;
    if (now - self->lastTouchTime < 1000) return;
    self->lastTouchTime = now;
    self->trigger();
}
void IRAM_ATTR Module_Switch::isr_handler_touch(void* arg) {
    // debugln("here");
    Module_Switch* self = static_cast<Module_Switch*>(arg);
    uint64_t now = esp_timer_get_time() / 1000;
    if (now - self->lastTouchTime < 150) return;
    if (!self->pendingFirstTap) {
        self->pendingFirstTap = true;
        self->lastTouchTime = now;
    } else {
        if (now - self->lastTouchTime < 500) {
            self->trigger();
            self->pendingFirstTap = false;
        } else {
            self->lastTouchTime = now;
        }
    }
}