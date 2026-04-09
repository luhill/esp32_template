#pragma once
#include <module_base.h>
#include <ShiftRegister/ShiftRegisterDMA.h>
#include <Adafruit_ADS1X15.h>

extern Adafruit_ADS1115 ads;

class Module_Pool_Hardware : public Module_Base<Module_Pool_Hardware> {
   private:
    int _pin_forward = -1;
    int _pin_reverse = -1;
    int _ads_channel = 0;      // Which ADS1115 pin (0,1,2, or 3)
    float _mvPerAmp = 100.0;   // Sensitivity (Check datasheet for your specific 06A vs 015A)
    bool _lastPhysicalState = false; // Tracks if the cell is currently energized
    uint64_t _invertTime_sec = 14400;
    uint64_t _pwmCycleTime_sec = 100;
    uint64_t _pwmCounter = 0;
    String _control2Id;
    String _control2Label;

    float _currentAccumulator = 0.0f;

    // Safety flags
    bool _pendingInversion = false; 
    std::vector<bool*> _interlocks;

   public:
    Module_Pool_Hardware() {_type = "poolHardware";}
    
    MultiControl* control2 = nullptr;
    bool* on = nullptr;  // convenience names
    int* duty = nullptr;
    int* total_runtime_sec = nullptr;

    bool invert_output = false;
    bool pwm_on_Cycle = false;

    // --- CONFIGURATION CHAIN ---

    /** @brief Define the pins to output the duty signal. */
    Module_Pool_Hardware& setPins(int pin_forward, int pin_reverse) {
        _pin_forward = pin_forward;
        _pin_reverse = pin_reverse;
        return *this;
    }
    /** @brief Add a pointer to a boolean (e.g. pump_on) that must be true for output */
    Module_Pool_Hardware& addInterlock(bool* conditionPtr) {
        if (conditionPtr) _interlocks.push_back(conditionPtr);
        return *this;
    }
    /** @brief Define initial value of the switch. */
    Module_Pool_Hardware& setInvertTime(uint64_t val) {
        _invertTime_sec = constrain(val, 30, 12 * 60 * 60);  // constrain the inversion time to 10min - 12hrs
        return *this;
    }
    Module_Pool_Hardware& setPWMCycleTime(uint64_t val) {
        _pwmCycleTime_sec = constrain(val, 10, 10 * 60);  // constrain pwm cycle to 10sec - 10min
        return *this;
    }

    /** @brief Configure ADC channel and sensor sensitivity */
    Module_Pool_Hardware& setCurrentSensor(int adsChannel, float mvPerAmp) {
        _ads_channel = adsChannel;
        _mvPerAmp = mvPerAmp;
        return *this;
    }

    void setup() override {
        //set pins to ouput and turn them off
        dWrite(_pin_forward, LOW);
        dWrite(_pin_reverse, LOW);
        
        // 3. Capture Pointers directly
        on = this->control->addValue("on", false, false);//On state is not saved, should just default to off after reboot
        duty = this->control->addValue("duty", 0, true);//save user duty setting
        

        //---second control to store and display the total runtime on the info page. Persist causes it to be saved to nvs
        _control2Id = String(this->_id)+"_runtime";
        _control2Label = String(this->_label)+" Runtime";
        this->control2 = new MultiControl("info", _control2Id.c_str(), "textIO", _control2Label.c_str());

        // 3. Capture Pointers directly
        total_runtime_sec = this->control2->addValue("time", 0, true);
        this->control2->setMeta("readonly", true);
        this->control2->setMeta("type_attr", "int");
        this->control2->setMeta("append","sec");
        Registry::controls.push_back(this->control2);
    }
    bool onUpdate_internal() override {
        tick1s();//execute the tick logic right away
        return true; //true performs any onUpdate function that was set
    }
    /** @brief Check if all interlocks (flow, pump, etc) are clear */
    bool interlocksClear() {
        for (bool* check : _interlocks) {
            if (check && !(*check)) return false; // If any condition is false, we are interlocked (blocked)
        }
        return true;
    }
    /** @brief Reads the ADS1115 and calculates Amps */
    float readAmps() {
        // Read raw millivolts from ADS1115
        float mVolts = ads.computeVolts(ads.readADC_SingleEnded(_ads_channel)) * 1000.0f;
        
        // The HCS sensor usually rests at VCC/2 (approx 2500mV)
        // Adjust 2500.0 to your measured zero-current voltage
        float deltaV = abs(mVolts - 2500.0f); 
        return deltaV / _mvPerAmp;
    }
    /** @brief Write to the output pins*/
    void updateHardware(bool state) {
        // Master Safety Gate
        bool safeState = (state && !_pendingInversion && interlocksClear());

        // Only write to the pins if the state has actually changed 
        // OR if a polarity flip just finished
        if (safeState != _lastPhysicalState || _pendingInversion) {
            dWrite(_pin_forward, invert_output ? LOW : safeState);
            dWrite(_pin_reverse, invert_output ? safeState : LOW);
            _lastPhysicalState = safeState;
        }
    }

    /** @brief Based on the invertTime and pwmCycleTime update the the invert_output and pwm_on_cycle flags
     * if a flag changes value it should call _onChangeCb()
     */
    void tick1s() override {
        // 1. INTERLOCK AUTO-KILL: If pump stops, turn the software switch OFF
        if (!interlocksClear() && *on) {
            *on = false;
            debugfln("%s action ignored, interlock is active", this->_id);
            // We don't return yet; we want to fall through to updateHardware(false)
        }
        
        // RETURN: If the switch is off and the pins are already low, 
        if (!(*on) && !_lastPhysicalState) {
            return; 
        }
        // 2. Track the runtime (including pwm off-cycle time)
        if (total_runtime_sec) (*total_runtime_sec)++;
        
        // --- 1. HANDLE POLARITY INVERSION (Slow Cycle) ---
        uint32_t current_val = (uint32_t)(*total_runtime_sec);
        uint64_t currentWindow = (uint64_t)current_val / _invertTime_sec;
        
        bool shouldBeInverted = (currentWindow % 2 == 1);
        debugfln("total:%d, invert:%llu, current:%llu, shouldInvert:%d", *total_runtime_sec, _invertTime_sec, currentWindow, shouldBeInverted);

        if (invert_output != shouldBeInverted) {
            if (!_pendingInversion) {
                // FIRST TICK: Shut everything down for safety
                _pendingInversion = true;
                updateHardware(LOW); 
                debugfln("Chlorinator: Entering 1s Dead-time for Polarity Swap...");
                return; // Exit early to ensure we stay LOW for 1 full second
            } else {
                // SECOND TICK: We have waited 1 second, now flip
                invert_output = shouldBeInverted;
                _pendingInversion = false;
                debugfln("Chlorinator: Polarity Swapped to %s", invert_output ? "REVERSE" : "FORWARD");
            }
        }

        // --- 2. HANDLE PWM PRODUCTION CYCLE (Fast Cycle) ---
        _pwmCounter++;
        if (_pwmCounter >= _pwmCycleTime_sec) _pwmCounter = 0;

        uint64_t onThreshold = (_pwmCycleTime_sec * (*duty)) / 100;
        bool shouldBeOn = (*on) && (_pwmCounter < onThreshold);

        // --- 3. APPLY OUTPUT ---
        // We call updateHardware every second to catch interlock changes immediately
        updateHardware(shouldBeOn);
        
        if (pwm_on_Cycle != shouldBeOn) {
            pwm_on_Cycle = shouldBeOn;
        }
    }

   private:
};