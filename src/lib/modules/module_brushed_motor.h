#pragma once
#include <Control/Control.h>
#include <ESP32_MCPWM.h>
#include <helpers.h>

class Module_Brushed_Motor {
public:
    // The control lives inside the module
    MultiControl control;
    Motor pump;

    // Cache pointers for the task
    bool* on;
    int* duty_target;
    int* duty;

    Module_Brushed_Motor(const char* group, const char* id, const char* name) 
        : control(group, id, "switchSlider", name) {}

    void setup(int lpwm, int rpwm=-1, int en =-1) {
        // 1. Hardware Setup
        MotorMCPWMConfig hw{};
        hw.rpwm_pin = rpwm;
        hw.lpwm_pin = lpwm;
        hw.en_pin = en;
        pump.setup(hw);
        pump.setFreewheelMode(FreewheelMode::HiZ);
        pump.setSoftBrakePWM(0);
        pump.reconfigureFrequency(20000);
        
        // 2. Control Setup
        control.addValue("on", false);
        control.addValue("duty", 0);
        control.addValue("duty_target", 0, true);
        
        // Register to the global registry
        uiRegistry.push_back(&control);

        // 3. Cache Pointers
        on = control.getBoolPtr("on");
        duty_target = control.getIntPtr("duty_target");
        duty = control.getIntPtr("duty");

        // 4. Start Task (Passing 'this' as the parameter)
        xTaskCreatePinnedToCore(task, "PumpTask", 2048, this, 1, nullptr, 0);
    }
    //works with rotary.h to allow on/off and speed control with a rotary knob
    void updateFromRotary(int sw, int ctr) {
        if (ctr > 0) {  // clockwise turn
            // if power is off
            if (!*on) {  // if off, turn on and set counter to 0
                *on = true;
                *duty_target = 16;  // min value for motor to work
            } else {                // power is on
                *duty_target = constrain(*duty_target + 1, 16, 100);
            }
        } else if (ctr < 0) {  // counterclockwise turn
            *duty_target = constrain(*duty_target - 1, 0, 100);
            if (*duty_target < 16) {
                *on = false;
                *duty_target = 0;
            }
        }
        if (sw > 0) {  // btn was pressed
            *on = !*on;
        }
        debugfln("switch:%i, duty:%i", *on, *duty_target);
    }
private:
   // 1. The Wrapper (Static) 
    static void task(void* pv) { 
        // 2. The Bridge (Cast) 
        auto* self = static_cast<Module_Brushed_Motor*>(pv); 
        // 3. The Implementation
        self->runLoop(); 
    } 

    // 4. The Actual Logic (Instance) 
    void runLoop() { 
        for (;;) { 
            // Add your "Smooth Transition" logic here!
            if (on && duty && duty_target) {
                int target = (*on) ? *duty_target : 0;
                int change = constrain(target - *duty, -1, 1);
                *duty += change;
                pump.setSpeedPercent(*duty, Dir::CW);
            }
            vTaskDelay(pdMS_TO_TICKS(25)); 
        } 
    } 
};