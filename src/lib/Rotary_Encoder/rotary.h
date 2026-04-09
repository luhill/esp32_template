#pragma once
#include <Arduino.h>

typedef std::function<void(int, int)> RotaryCallback;

class rotary {
   public:
    rotary() {}

    rotary(byte pinA, byte pinB, byte pinS)
        : _pinA(pinA), _pinB(pinB), _pinS(pinS) {}

    /** @brief setPins(clk, dt, sw) */
    rotary& setPins(byte a, byte b, byte s) {
        _pinA = a;
        _pinB = b;
        _pinS = s;
        return *this;
    }

    /** @brief Optional external pointers */
    rotary& setTargets(volatile int8_t* counterPtr, volatile bool* togglePtr) {
        this->counter = counterPtr;
        this->toggle = togglePtr;
        return *this;
    }

    /** @brief Set the callback: (type, value) -> type 0=rot, 1=btn */
    rotary& setCallback(RotaryCallback cb) {
        this->onRotaryInput = cb;
        return *this;
    }

    void begin();

   private:
    static void IRAM_ATTR isr_handler_rotation(void* arg);
    static void IRAM_ATTR isr_handler_switch(void* arg);

    RotaryCallback onRotaryInput = nullptr;

    uint8_t _pinA = -1, _pinB = -1, _pinS = -1;
    volatile bool lastA = HIGH, lastB = HIGH, lastS = HIGH;
    volatile unsigned long lastUpdate_rotary = 0;
    volatile unsigned long lastUpdate_button = 0;

    volatile int8_t* counter = nullptr;
    volatile bool* toggle = nullptr;
};

// --- Implementation (Marked inline for header-only safety) ---

void IRAM_ATTR rotary::isr_handler_rotation(void* arg) {
    rotary* self = static_cast<rotary*>(arg);

    bool a = digitalRead(self->_pinA);
    bool b = digitalRead(self->_pinB);
    unsigned long now = millis();
    
    // Simple quadrature decoding with 5ms debounce
    if (a != self->lastA && (now - self->lastUpdate_rotary) > 5) {
        int delta = (a == b) ? 1 : -1;
        
        if (self->onRotaryInput) {
            self->onRotaryInput(0, delta);
        }
        if (self->counter != nullptr) {
            *(self->counter) += delta;
        }
        self->lastUpdate_rotary = now;
    }
    self->lastA = a;
    self->lastB = b;
}

void IRAM_ATTR rotary::isr_handler_switch(void* arg) {
    rotary* self = static_cast<rotary*>(arg);
    bool s = digitalRead(self->_pinS);
    unsigned long now = millis();

    // 100ms debounce for the mechanical switch
    if (s != self->lastS && (now - self->lastUpdate_button) > 100) {
        if (s == HIGH) { // Trigger on release (standard behavior)
            if (self->onRotaryInput) {
                self->onRotaryInput(1, 0);
            }
            if (self->toggle != nullptr) {
                *(self->toggle) = !*(self->toggle);
            }
        }
        self->lastUpdate_button = now;
    }
    self->lastS = s;
}

void rotary::begin() {
    if (_pinA == (uint8_t)-1) return; // Safety check

    pinMode(_pinA, INPUT_PULLUP);
    pinMode(_pinB, INPUT_PULLUP);
    if (_pinS != (uint8_t)-1) pinMode(_pinS, INPUT_PULLUP);

    lastUpdate_rotary = millis();
    lastUpdate_button = lastUpdate_rotary;

    attachInterruptArg(_pinA, isr_handler_rotation, this, CHANGE);
    if (_pinS != (uint8_t)-1) {
        attachInterruptArg(_pinS, isr_handler_switch, this, CHANGE);
    }
}
