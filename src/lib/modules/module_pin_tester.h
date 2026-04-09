#pragma once
#include <module_base.h>
#include <ShiftRegister/ShiftRegisterDMA.h>

class Module_Pin_Tester : public Module_Base<Module_Pin_Tester> {
private:
    //InputCallback _actionCb = nullptr;
    //bool _on = false;
    int _pin = -1;
    int _minTicks = 2;
    int _maxTicks = 250000;
public:
    Module_Pin_Tester() {_type = "pinTester";}
    
    bool* on = nullptr;
    bool* isPwm = nullptr;
    int* duty = nullptr;
    int* pin = nullptr;
    int* pwmTicks = nullptr;

    // --- CONFIGURATION CHAIN ---

    /** @brief Define initial value of the slider (0-100). */
    Module_Pin_Tester& setPin(int val) {
        _pin = val;
        return *this;
    }

    Module_Pin_Tester& setPwmRange(int minTicks, int maxTicks){
        _minTicks = minTicks;
        _maxTicks = maxTicks;
        return *this;
    }

    // --- EXECUTION ---
    void setup() override {
        pin = this->control->addValue("pin", _pin, this->_persist);
        isPwm = this->control->addValue("isPwm", true, this->_persist);
        on = this->control->addValue("on", false, this->_persist);
        duty = this->control->addValue("duty", 0, this->_persist);
        pwmTicks = this->control->addValue("pwmTicks", 250, this->_persist);
        this->control->setMeta("minTicks", _minTicks, "pwm");
        this->control->setMeta("maxTicks", _maxTicks, "pwm");
    }
    bool onUpdate_internal() override {
        if (IS_EXPANDER_PIN(_pin)) {
            if (*isPwm) {
                setCycles(*pin, *pwmTicks);
                aWrite(*pin, *on ? *duty : 0.0f);
            } else {
                dWrite(*pin, *on);
            }
        } else {
            if (*isPwm) {
            } else {
                pinMode(*pin, OUTPUT);
                digitalWrite(*pin, *on);
            }
        }
        return  true;
    }

private:
   
};