#pragma once
#include <module_base.h>
#include <ESP32_MCPWM.h>

class Module_Brushed_Motor : public Module_Base<Module_Brushed_Motor> {
private:
    // Hardware configuration stored before .begin()
    int _lpwm = -1, _rpwm = -1, _en = -1;
    int _frequency = 20000;
    int _auto_off_sec = -1;
    Motor pump; // The hardware motor instance
    uint32_t _auto_off_counter = 0;
public:
    // Direct Pointers for O(1) access in the runLoop task
    bool* on = nullptr;
    int* duty_target = nullptr;
    int* duty = nullptr;

    Module_Brushed_Motor() {_type = "switchSlider";}

    // --- CONFIGURATION CHAIN ---

    /** @brief Define the pins for the motor driver. */
    Module_Brushed_Motor& setPins(int lpwm, int rpwm = -1, int en = -1) {
        _lpwm = lpwm; _rpwm = rpwm; _en = en;
        return *this;
    }

    /** @brief Set the PWM frequency (default 20kHz). */
    Module_Brushed_Motor& setFrequency(int freq) {
        _frequency = freq;
        return *this;
    }

    /** @brief Set an optional max duration pump can run*/
    Module_Brushed_Motor& setSafetyOffDuration_sec(uint32_t off_sec) {
        _auto_off_sec = off_sec;
        return *this;
    }

    // --- EXECUTION ---

    void setup() override {
        // 1. Hardware Initialization
        MotorMCPWMConfig hw{};
        hw.rpwm_pin = _rpwm;
        hw.lpwm_pin = _lpwm;
        hw.en_pin = _en;
        
        pump.setup(hw);
        pump.setFreewheelMode(FreewheelMode::HiZ);
        pump.setSoftBrakePWM(0);
        pump.reconfigureFrequency(_frequency);
        
        // 2. UI Initialization
        on          = this->control->addValue("on", false);
        duty_target = this->control->addValue("duty_target", 0, this->_persist);
        duty        = this->control->addValue("duty", 0);
    }
    bool onUpdate_internal() override {
        _auto_off_counter = 0;
        return true; //true performs any onUpdate function that was set
    }
    void tick1s() override {
        if(_auto_off_sec < 0) return;
        if(on && *on){
            _auto_off_counter++;
            if(_auto_off_counter >= _auto_off_sec){
                *on = false;
                _auto_off_counter = 0;
            }
        }
    }
    void tick20ms() override {
        if (on && duty && duty_target) {
            // Determine target speed based on switch state
            int target = (*on) ? *duty_target : 0;

            // Ramping logic: move current duty 1% closer to target every 25ms
            int change = constrain(target - *duty, -1, 1);
            *duty += change;

            // Update Hardware
            pump.setSpeedPercent(*duty, Dir::CW);
        }
    }
    /**
     * @brief High-level helper for physical inputs like Rotary Encoders.
     * Manages logic for minimum starting duty (16%) and auto-shutoff.
     */
    void updateFromRotary(int sw, int ctr) {
        if (!on || !duty_target) return;
        _auto_off_counter = 0;

        if (ctr > 0) { // Clockwise
            if (!*on) {
                *on = true;
                *duty_target = 16; // Min start torque
            } else {
                *duty_target = constrain(*duty_target + 1, 16, 100);
            }
        } else if (ctr < 0) { // Counter-clockwise
            *duty_target = constrain(*duty_target - 1, 0, 100);
            if (*duty_target < 16) {
                *on = false;
                *duty_target = 0;
            }
        }

        if (sw > 0) *on = !*on; // Toggle button press
    }

private:

};