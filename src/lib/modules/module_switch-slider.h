#pragma once
#include <module_base.h>

class Module_Switch_Slider : public Module_Base<Module_Switch_Slider> {
   private:
    bool _initialSwitchValue = false;
    int _initialSliderValue = 0;
    bool slider_is_timer = false;
    int _mult = -1;
    uint32_t _counter = 0;
    const char* _append = nullptr;
    float _min = NAN;
    float _max = NAN;
    float _step = NAN;
    std::vector<bool*> _interlocks;

   public:
    Module_Switch_Slider() { _type = "switchSlider"; }

    bool* switchValue = nullptr;
    int* sliderValue = nullptr;
    bool* on = nullptr;  // convenience names
    int* duty = nullptr;

    // --- CONFIGURATION CHAIN ---

    /** @brief Define initial value of the switch. */
    Module_Switch_Slider& setSwitchValue(bool val) {
        _initialSwitchValue = val;
        return *this;
    }
    /** @brief Define initial value of the slider (0-100). */
    Module_Switch_Slider& setSliderValue(int val) {
        _initialSliderValue = val;
        return *this;
    }
    /** @brief Sets the minimum and maximum values for numeric input. */
    Module_Switch_Slider& setRange(float min, float max) {
        _min = min;
        _max = max;
        return *this;
    }
    Module_Switch_Slider& setStep(float step) {
        _step = step;
        return *this;
    }

    /** @brief Add a pointer to a boolean (e.g. pump_on) that must be true for output */
    Module_Switch_Slider& addInterlock(bool* conditionPtr) {
        if (conditionPtr) _interlocks.push_back(conditionPtr);
        return *this;
    }
    /** @brief Converts the slider into an autoOff time setting.
     * @param mult The slider scale multiple. (i.e. seconds = 1, minutes = 60, hours = 3600)
     */
    Module_Switch_Slider& makeTimer(int mult = 1) {
        _mult = mult;
        return *this;
    }
    Module_Switch_Slider& setAppend(const char* append) {
        _append = append;
        return *this;
    }
    // --- EXECUTION ---

    void setup() override {
        switchValue = this->control->addValue("on", _initialSwitchValue, this->_persist);
        sliderValue = this->control->addValue("duty", _initialSliderValue, true);
        
        on = switchValue;
        duty = sliderValue;

        if (_append) {
            this->control->setMeta("append", _append);
        }
        if (!isnan(_min)) this->control->setMeta("min", _min);
        if (!isnan(_max)) this->control->setMeta("max", _max);
        if (!isnan(_step)) this->control->setMeta("step", _step);
    }
    bool onUpdate_internal() override {
        if(*on && !interlocksClear()){
            tick1s();
            return false;// false bypasses onUpdate function call
        }
        tick1s();
        return true;
    }
    /** @brief Check if all interlocks (flow, pump, etc) are clear */
    bool interlocksClear() {
        for (bool* check : _interlocks) {
            if (check && !(*check)) return false;  // If any condition is false, we are interlocked (blocked)
        }
        return true;
    }
    void tick1s() override {
        if (!interlocksClear() && *on) {
            *on = false;
            debugfln("%s action ignored, interlock is active", this->_id);
        }
        if (_mult < 0) return;  // no timer function

        if (!(*on)) {
            _counter = 0;  // reset counter when switch is off
            return;
        }
        _counter++;
        if (_counter > (*sliderValue) * _mult) {
            *on = false;
            _counter = 0;
            if (_onUpdate) _onUpdate();
        }
    }

   private:
};