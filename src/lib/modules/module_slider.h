#pragma once
#include <module_base.h>

class Module_Slider : public Module_Base<Module_Slider> {
   private:
    int _initialSliderValue = 0;
    float _min = NAN;               // Default very low
    float _max = NAN;               // Default very high
    const char* _append = nullptr;  // Optional string to append to the displayed value (e.g., "s" for seconds)
   public:
    Module_Slider() { _type = "slider"; }

    // Direct Pointers for O(1) access in the runLoop task
    int* sliderValue = nullptr;

    // --- CONFIGURATION CHAIN ---

    /** @brief Define initial value of the slider (0-100). */
    Module_Slider& setSliderValue(int val) {
        _initialSliderValue = val;
        return *this;
    }

    /** @brief Sets the string to append to the displayed value. */
    Module_Slider& setAppend(const char* append) {
        _append = append;
        return *this;
    }

    /** @brief Sets the minimum and maximum values for numeric input. */
    Module_Slider& setRange(float min, float max) {
        _min = min;
        _max = max;
        return *this;
    }

    /** @brief Setup the module with values and meta data */
    void setup() override {
        sliderValue = this->control->addValue("duty", _initialSliderValue, this->_persist);

        // New Range and Precision Meta
        if (!isnan(_min)) this->control->setMeta("min", _min);
        if (!isnan(_max)) this->control->setMeta("max", _max);
        if (_append) this->control->setMeta("append", _append);
    }

    /** @brief optional override for modules that need to update there internal state when a control value is changed */
    // void onUpdateInternal() override {}
};