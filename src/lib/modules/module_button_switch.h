#pragma once
#include <module_base.h>
#include <driver/touch_sensor.h>

class Module_Button_Switch : public Module_Base<Module_Button_Switch> {
private:
    int _pin = -1;
    bool _isTouch = false;
    bool _isLatching = false; // The "Morph" flag
    int _sensitivity = 25;
    std::vector<bool*> _interlocks;

    // ISR-Safe state
    volatile bool _triggered = false;
    volatile uint64_t _lastTouchTime = 0;
    volatile bool _pendingFirstTap = false;
    
public:
    Module_Button_Switch(bool isButton) {_type = isButton ? "button" : "switch";}

    bool* on = nullptr; // Acts as 'clicked' for buttons or 'on' for switches

    // --- CONFIGURATION CHAIN ---

    Module_Button_Switch& setPhysical(int pin, bool isTouch = false, int sensitivity = 25) {
        _pin = pin;
        _isTouch = isTouch;
        _sensitivity = sensitivity;
        return *this;
    }

    /** @brief If true, behaves like a toggle switch. If false, behaves like a momentary button. */
    Module_Button_Switch& setLatching(bool latching) {
        _isLatching = latching;
        return *this;
    }

    /** @brief Add a pointer to a boolean (e.g. pump_on) that must be true for output */
    Module_Button_Switch& addInterlock(bool* conditionPtr) {
        if (conditionPtr) _interlocks.push_back(conditionPtr);
        return *this;
    }

    // --- LIFECYCLE HOOKS ---

    void tick10ms() override {
    // PHYSICAL INTERRUPT LOGIC
    if (_triggered) {
        _triggered = false;
        
        if (_isLatching && on) {
            // Physical tap ALWAYS toggles if in latching mode
            *on = !(*on); 
            this->control->markDirty(); // Sync NEW state back to UI
        } else if (!_isLatching && on) {
            *on = true; // Momentary Pulse
        }

        if (_onUpdate) _onUpdate();
    } else {
        // Reset momentary button state after one tick
        if (!_isLatching && on && *on) {
            *on = false;
        }
    }
}

    static void IRAM_ATTR isr_btn(void* arg);
    static void IRAM_ATTR isr_touch(void* arg);

    void setup() override {
        // Switches persist their state
        on = this->control->addValue(_isLatching ? "on" : "click", false, _isLatching ? _persist : false);

        if (_pin != -1) {
            if (_isTouch) {
                setupTouch();
            } else {
                pinMode(_pin, INPUT_PULLUP);
                attachInterruptArg(_pin, Module_Button_Switch::isr_btn, this, FALLING);
            }
        }
    }
    /** @brief Check if all interlocks (flow, pump, etc) are clear */
    bool interlocksClear() {
        for (bool* check : _interlocks) {
            if (check && !(*check)) return false;  // If any condition is false, we are interlocked (blocked)
        }
        return true;
    }
    bool onUpdate_internal() override {
        if(*on && !interlocksClear()){
            debugfln("%s action ignored, interlock is active", this->_id);
            *on = false;
            return false;// false bypasses onUpdate function call
        }
        return true; //true performs any onUpdate function that was set
    }
private:
    void setupTouch() {
        touch_pad_init();
#if CONFIG_IDF_TARGET_ESP32S3
        touch_filter_config_t filter_info = {
            .mode = TOUCH_PAD_FILTER_IIR_16, .debounce_cnt = 1, .noise_thr = 0, 
            .jitter_step = 4, .smh_lvl = TOUCH_PAD_SMOOTH_IIR_2
        };
        touch_pad_filter_set_config(&filter_info);
        touch_pad_filter_enable();
        uint32_t val;
        touch_pad_read_raw_data((touch_pad_t)_pin, &val);
#else
        touch_pad_filter_start(10);
        uint16_t val = touchRead(_pin);
#endif
        int threshold = (val * (100 - _sensitivity)) / 100;
        touchAttachInterruptArg(_pin, Module_Button_Switch::isr_touch, this, threshold);
    }
};

// --- ISR DEFINITIONS (Outside class for linker safety) ---

void IRAM_ATTR Module_Button_Switch::isr_btn(void* arg) {
    auto* self = static_cast<Module_Button_Switch*>(arg);
    if(!self->interlocksClear())return;
    uint64_t now = esp_timer_get_time() / 1000;
    if (now - self->_lastTouchTime < 1000) return;
    self->_lastTouchTime = now;
    self->_triggered = true;
}

void IRAM_ATTR Module_Button_Switch::isr_touch(void* arg) {
    auto* self = static_cast<Module_Button_Switch*>(arg);
    if(!self->interlocksClear())return;
    uint64_t now = esp_timer_get_time() / 1000;
    if (now - self->_lastTouchTime < 150) return;
    if (!self->_pendingFirstTap) {
        self->_pendingFirstTap = true;
        self->_lastTouchTime = now;
    } else {
        if (now - self->_lastTouchTime < 500) {
            self->_triggered = true;
            self->_pendingFirstTap = false;
        } else {
            self->_lastTouchTime = now;
        }
    }
}