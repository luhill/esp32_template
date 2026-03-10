#include "rotary.h"
#include <Arduino.h>

rotary::rotary(byte pA, byte pB, byte pS) : pinA(pA), pinB(pB), pinS(pS) {
    pinMode(pinA, INPUT_PULLUP);
    pinMode(pinB, INPUT_PULLUP);
    pinMode(pinS, INPUT_PULLUP);
}
rotary::rotary(byte pA, byte pB, byte pS, volatile int8_t* _counter, volatile bool* _toggle)
    : pinA(pA), pinB(pB), pinS(pS),counter(_counter),toggle(_toggle) {
    pinMode(pinA, INPUT_PULLUP);
    pinMode(pinB, INPUT_PULLUP);
    pinMode(pinS, INPUT_PULLUP);
}

void IRAM_ATTR rotary::isr_handler_rotation(void* arg) {
    rotary* self = static_cast<rotary*>(arg);

    bool a = digitalRead(self->pinA);
    bool b = digitalRead(self->pinB);
    unsigned long now = millis();
    if (a != self->lastA && b != self->lastB && (now - self->lastUpdate_rotary) > 5) {  // state changed
        int delta = (a == b) ? 1 : -1;
        if (self->onRotaryInput) {
            self->onRotaryInput(0, delta);
        }
        if(self->counter != nullptr){
            *(self->counter) += delta;
        }
        self->lastUpdate_rotary = now;
    }
    self->lastA = a;
    self->lastB = b;
}
void IRAM_ATTR rotary::isr_handler_switch(void* arg) {
    rotary* self = static_cast<rotary*>(arg);
    bool s = digitalRead(self->pinS);
    unsigned long now = millis();

    if (s != self->lastS && (now - self->lastUpdate_button) > 100) {  // state changed
        if (s == HIGH) {
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
void rotary::start(){ //must be called after esp setup()
    lastUpdate_rotary = millis();
    lastUpdate_button = lastUpdate_rotary;
    attachInterruptArg(pinA,isr_handler_rotation,this,CHANGE);
    attachInterruptArg(pinS,isr_handler_switch,this,CHANGE);
}

