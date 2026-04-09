#pragma once
#include <module_base.h>

template <typename T>
class Module_Text_IO : public Module_Base<Module_Text_IO<T>> {
private:
    T _initialValue = T();
    bool __readOnly = false;
    const char* _prepend = nullptr; // Optional string to prepend to the displayed value (e.g., "$" for currency)
    const char* _append = nullptr; // Optional string to append to the displayed value (e.g., "s" for seconds)
    float _min = NAN; // Default very low
    float _max = NAN;  // Default very high
    int _precision = -1; // -1 means "don't truncate"
   
public:
    Module_Text_IO() {_type = "textIO";}
    
    T* valuePtr = nullptr;

    // --- CONFIGURATION CHAIN ---

    /** @brief Sets the starting value for the control. */
    Module_Text_IO& setValue(T val) {
        _initialValue = val;
        return *this;
    }

    /** @brief Sets the read-only status for the control. */
    Module_Text_IO& setReadOnly(bool val){
        __readOnly = val;
        return *this;
    }

    /** @brief Sets the string to prepend to the displayed value. */
    Module_Text_IO& setPrepend(const char* prepend) {
        _prepend = prepend;
        return *this;
    }

    /** @brief Sets the string to append to the displayed value. */
    Module_Text_IO& setAppend(const char* append) {
        _append = append;
        return *this;
    }

    /** @brief Sets the minimum and maximum values for numeric input. */
    Module_Text_IO& setRange(float min, float max) {
        _min = min;
        _max = max;
        return *this;
    }
    /** @brief Sets the number of decimal places to display for float input. */
    Module_Text_IO& setPrecision(int precision) {
        _precision = precision;
        return *this;
    }

    // --- THE EXECUTION (No arguments needed now!) ---
    void setup() override {
        valuePtr =this->control->addValue("input", _initialValue, this->_persist);

        // 2. Set the Type Metadata so React knows which keyboard/validation to use
        if (std::is_same<T, int>::value) {
            this->control->setMeta("type_attr", "int");
        } else if (std::is_same<T, float>::value || std::is_same<T, double>::value) {
            this->control->setMeta("type_attr", "float");
        } else if (std::is_same<T, bool>::value) {
            this->control->setMeta("type_attr", "bool");
        } else {
            this->control->setMeta("type_attr", "string");
        }

        if (__readOnly) this->control->setMeta("readonly", 1);
        if (_prepend) this->control->setMeta("prepend", _prepend);
        if (_append) this->control->setMeta("append", _append);

        // New Range and Precision Meta
        if (!isnan(_min)) this->control->setMeta("min", _min);
        if (!isnan(_max)) this->control->setMeta("max", _max);
        if (_precision >= 0) this->control->setMeta("precision", _precision);
    }
    T get() { return valuePtr ? *valuePtr : T(); }

    void set(T newValue) {
        if (valuePtr) *valuePtr = newValue;
        // Use -> because control is now a pointer
        if (this->control) this->control->updateValue("input", newValue);
    }
};
