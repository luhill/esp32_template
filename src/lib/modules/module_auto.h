#pragma once
#include <Control/Control.h>
#include <ESP32TimerInterrupt.h>
#include <time.h>
#include <sys/time.h>
#include <helpers.h>
// Forward declaration of the global registry
extern std::vector<ControlBase*> uiRegistry;

// Standard C-style function pointer typedef for ISR-safe callbacks
typedef void (*VoidCallback)(); 

class Module_Auto {
public:
    MultiControl control;
    ESP32_ISRTimer* isr_timer = nullptr;
    
    // Public Handles and Callbacks
    int handle_on = -1;
    int handle_off = -1;
    VoidCallback callback_on = nullptr;
    VoidCallback callback_off = nullptr;

    // Public Pointers for high-speed access in main.cpp / ISRs
    bool* on = nullptr;
    int* start = nullptr;
    int* stop = nullptr;

    Module_Auto(const char* group, const char* id, const char* name)
        : control(group, id, "autoStartStop", name) 
    {
        // Reserve space to prevent pointer invalidation during addValue
        control.values.reserve(8);
    }

    /**
     * @param _isr Shared ISR Timer instance (managed in main.cpp)
     * @param _on Callback for Start time alarm
     * @param _off Callback for Stop time alarm
     * @param initialStart Seconds from midnight (e.g. 32400 for 9AM)
     * @param initialStop Seconds from midnight (e.g. 61200 for 5PM)
     */
    void setup(ESP32_ISRTimer* _isr, VoidCallback _on, VoidCallback _off, int _start, int _stop) {
        isr_timer = _isr;
        callback_on = _on;
        callback_off = _off;

        control.addValue("on", false, true);
        control.addValue("start", _start, true);
        control.addValue("stop", _stop, true);
        
        // 2. Cache Pointers
        on = control.getBoolPtr("on");
        start = control.getIntPtr("start");
        stop = control.getIntPtr("stop");

        control.onUpdate = [this](const char* id, const char* key, JsonVariant val) {
            this->updateTimers();
        };

        uiRegistry.push_back(&control);
    }

    /**
     * Recalculates next alarm intervals
     */
    void updateTimers() {
        if (!isr_timer || !callback_on || !callback_off || !on || !start || !stop) return;

        time_t now;
        time(&now);
        struct tm lTime;
        localtime_r(&now, &lTime);
        
        int secNow = (lTime.tm_hour * 3600 + lTime.tm_min * 60 + lTime.tm_sec);
        const int SEC_PER_DAY = 86400;

        int secUntilStart = (*start - secNow + SEC_PER_DAY) % SEC_PER_DAY;
        int secUntilStop  = (*stop - secNow + SEC_PER_DAY) % SEC_PER_DAY;

        debugfln("start in:%i, stop in:%i",secUntilStart,secUntilStop);

        if (secUntilStart == 0) secUntilStart = SEC_PER_DAY;
        if (secUntilStop == 0) secUntilStop = SEC_PER_DAY;

        if (handle_on < 0)  handle_on  = isr_timer->setInterval((uint64_t)secUntilStart * 1000ULL, callback_on);
        else                isr_timer->changeInterval(handle_on, (uint64_t)secUntilStart * 1000ULL);
        if (handle_off < 0) handle_off = isr_timer->setInterval((uint64_t)secUntilStop * 1000ULL, callback_off);
        else                isr_timer->changeInterval(handle_off, (uint64_t)secUntilStop * 1000ULL);

        if (*on) {
            isr_timer->enable(handle_on);
            isr_timer->enable(handle_off);
        } else {
            isr_timer->disable(handle_on);
            isr_timer->disable(handle_off);
        }
    }

private: 
};