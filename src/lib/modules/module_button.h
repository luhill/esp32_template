#pragma once
#include <Control/Control.h>
#include <functional>
#include <driver/touch_sensor.h>
#include <helpers.h>
typedef void (*InputCallback)();

extern std::vector<ControlBase*> uiRegistry;

class Module_Button {
public:
    MultiControl control;
    int pin = -1;
    bool *clicked;
    bool *enabled;//is the physical button enabled?
    InputCallback onAction = nullptr;

    volatile unsigned long lastTouchTime = 0;
    volatile bool pendingFirstTap = false;

    Module_Button(const char* group, const char* id, const char* name) 
        : control(group, id, "button", name) {
        control.values.reserve(1);
    }

    /**
     * @param _pin Pin number (or -1 for Virtual)
     * @param _isTouch true for touch sense, false for gpio trigger
     * @param _cb Callback function
     * @param _sensitivity Only used for TOUCH (default 25)
     */
    void setup(int _pin, bool isTouch, InputCallback _cb, bool* _enabled = nullptr, int sensitivity = 25) {
        pin = _pin;
        onAction = _cb;
        enabled = _enabled;

        if (isTouch) {
            touch_pad_init();
            #if CONFIG_IDF_TARGET_ESP32S3
                touch_filter_config_t filter_info = {.mode = TOUCH_PAD_FILTER_IIR_16, .debounce_cnt = 1, .noise_thr = 0, .jitter_step = 4, .smh_lvl = TOUCH_PAD_SMOOTH_IIR_2};
                touch_pad_filter_set_config(&filter_info);
                touch_pad_filter_enable();
                uint32_t val;
                touch_pad_read_raw_data((touch_pad_t)pin, &val);
            #else
                touch_pad_filter_start(10);
                uint16_t val = touchRead(pin);
            #endif
            int threshold = (val * (100 - sensitivity)) / 100;
            touchAttachInterruptArg(pin,isr_handler_touch,this,threshold);
        } else if (pin != -1) {
            pinMode(pin, INPUT_PULLUP);
            attachInterruptArg(pin, isr_handler_btn, this, FALLING);
        }
        control.addValue("click", false, false);
        control.onUpdate = [this](const char* id, const char* key, JsonVariant val) {
                 this->trigger();
                 *clicked = false;//reset clicked state so future click events get registered
             };
        clicked = control.getBoolPtr("click");
        uiRegistry.push_back(&control);
    }
    static void IRAM_ATTR isr_handler_btn(void* arg);
    static void IRAM_ATTR isr_handler_touch(void *arg);

    // Public method so mywifi_socket or other code can trigger the logic
    void trigger() {
        if (onAction) onAction();
    }

private:
};

void IRAM_ATTR Module_Button::isr_handler_btn(void* arg) {
    Module_Button* self = static_cast<Module_Button*>(arg);
    if(self->enabled && !(*self->enabled)) return;//dont trigger event if button is disabled
    uint64_t now = esp_timer_get_time() / 1000;
    if (now - self->lastTouchTime < 1000) return;
    self->lastTouchTime = now;
    self->trigger();
}
void IRAM_ATTR Module_Button::isr_handler_touch(void* arg) {
    //debugln("here");
    Module_Button* self = static_cast<Module_Button*>(arg);
    if(self->enabled && !(*self->enabled)) return;//dont trigger event if button is disabled
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
