#pragma once
#include <module_base.h>
#include <lib/esp32_adc_hal.h>

class Module_Analog_Read : public Module_Base<Module_Analog_Read> {
   private:
    ESP32_ADC_HAL* _hal = nullptr;
    float _alpha = 0.1f;
    float _avgMv = 0.0f;

    // Config
    float _res25 = 10000.0f;
    float _beta = 3950.0f;
    float _pullup = 4700.0f;
    float _vRef_diode = 3100.0f;
    float _sh_c_coeff = 0.00;
    
    //calculated in begin
    float _sh_alpha, _beta_recip;

    //ui settings
    const char* _append = nullptr;
    int _precision = -1;
    
    //pin to be read
    int _pin = -1;

   public:
    float* reading = nullptr;

    Module_Analog_Read() {_type = "textIO";}

    // --- CONFIGURATION CHAIN ---
    Module_Analog_Read& setPin(int pin) {
        _pin = pin;
        return *this;
    }
    Module_Analog_Read& setSmoothing(float alpha) {
        _alpha = constrain(alpha, 0.01f, 1.0f);
        return *this;
    }
    Module_Analog_Read& setAppend(const char* append) {
        _append = append;
        return *this;
    }
    Module_Analog_Read& setPrecision(int precision) {
        _precision = precision;
        return *this;
    }
     Module_Analog_Read& setR25(float r25) {
        _res25 = r25;
        return *this;
    }
     Module_Analog_Read& setBeta(float b) {
        _beta = b;
        return *this;
    }
     Module_Analog_Read& setPullup(float p) {
        _pullup = p;
        return *this;
    }
    Module_Analog_Read& setThermistorParams(float r25, float b, float p) {
        _res25 = r25;
        _beta = b;
        _pullup = p;
        return *this;
    }
    /** @brief mks tinybee uses diodes to set a reference voltate.
     * @note Measure vRef for the tinybee manually or via the console when the thermistor is unpluged */
    Module_Analog_Read& setVRef(float diodeV) {
        _vRef_diode = diodeV;
        return *this;
    }

    void setup() override {
        if(_pin < 0 ){
            debugfln("No pin set for analog read");
            return;
        }
        _hal = new ESP32_ADC_HAL(_pin);
        _hal->begin();


        // 1. Pre-compute Steinhart-Hart Alpha
        // This is the 'A' in the equation, calculated once to save CPU
        float res25_log = logf(_res25);
        _beta_recip = 1.0f / _beta;

        // sh_alpha = 1/T0 - (1/Beta * ln(R0)) - (C * ln(R0)^3)
        _sh_alpha = 1.0f / (25.0f + 273.15f) - (_beta_recip * res25_log) - (_sh_c_coeff * powf(res25_log, 3));

        // 3. UI Setup
        reading = this->control->addValue("voltage", 0.0f, false);
        this->control->setMeta("type_attr", "float");
        this->control->setMeta("readonly", true);
        if (_append) this->control->setMeta("append", _append);
        if (_precision >= 0) this->control->setMeta("precision", _precision);

        _avgMv = _hal->readMv();//get initial value right away so smoothing doesnt start at 0
    }
    float getTemp() {
        // 1. Safety check to prevent NaN/Inf
        // If voltage is 0, resistance is 0. If voltage >= Vref, resistance is Infinite.
        if (_avgMv <= 1.0f) return -273.15f;
        if (_avgMv >= _vRef_diode - 1.0f) return 999.0f;  // Indicates 'Open Circuit'

        // 2. Calculate Resistance (Standard High-Side Pullup / Thermistor to GND)
        // Formula: R_therm = R_pullup * (V_out / (V_ref - V_out)) <-- If Thermistor is High Side
        // Formula: R_therm = R_pullup * (V_ref - V_out) / V_out <-- If Thermistor is Low Side (GND)

        // Most 3D Printer boards (TinyBee) use Low Side (GND) for the sensor:
        //float resistance = _pullup * (_vRef_diode - _avgMv) / _avgMv;
        //or high side:
        float resistance = _pullup / ((_vRef_diode / _avgMv) - 1.0f);   // NEW (Simplified)
        // 3. Steinhart-Hart
        float logR = logf(resistance);
        float kelvin = 1.0f / (_sh_alpha + (logR * _beta_recip));

        return kelvin - 273.15f;
    }
    void tick10s() override {
        if (!reading) return;
        this->control->forceUiUpdate();//force an update even if the value has not changed
        // Scale the raw filtered reading from the diode reference to the standard 3.1V scale
        //float scaled_raw = _rawReading * (_vRef_standard / _vRef_diode);

        *reading = getTemp();
        debugfln("%s: %.2f%s (%.2f mV)", this->_id, *reading, _append ? _append : "", _avgMv);
    }
    void tick100ms() override {
        // 1. Get raw Millivolts from our HAL
        uint32_t currentMv = _hal->readMv();

        // 2. Smooth the Millivolt reading
        _avgMv = (_alpha * (float)currentMv) + ((1.0f - _alpha) * _avgMv);
    }
};