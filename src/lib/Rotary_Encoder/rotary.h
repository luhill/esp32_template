#pragma once
#include <Arduino.h>

typedef std::function<void(int, int)> RotaryCallback;

class rotary{
public:
    /**
     * @brief Rot
     *
     * @param pinA first pin of encoder (clk)
     * @param pinB second pin of encoder (dt)
     * @param pinS button pin of encoder (sw)
     * @param counter pointer to variable to increment /decrement on rotation
     * @param toggle pointer to variable to toggle on button press
     */
    rotary(byte pinA, byte pinB, byte pinS, volatile int8_t* counter, volatile bool* toggle);
    rotary(byte pinA, byte pinB, byte pinS);
    //void start(void (*onChange)(int,int));//Warning! start() cannot be called before the esp32 setup() method
    
    void start(); // WARNING! must be called after esp32 setup method

    /* onRotaryInput must be hooked into during or after setup like below:
        encoder_pump.onRotaryInput = [&](int s,int r){
            //logic here
            module_pump.updateFromRotary(s,r);//call another function etc
        };
        encoder_pump.start();
    */
    RotaryCallback onRotaryInput = nullptr;

    
private:
    static void IRAM_ATTR isr_handler_rotation(void* arg);
    static void IRAM_ATTR isr_handler_switch(void* arg);

    uint8_t pinA, pinB, pinS;
    volatile bool lastA = HIGH, lastB = HIGH, lastS = HIGH;
    volatile unsigned long lastUpdate_rotary = 0;
    volatile unsigned long lastUpdate_button = 0;
    volatile int8_t* counter = nullptr;
    volatile bool* toggle = nullptr;

};
