#pragma once
#include <modules/module_base.h>
#include <time.h>

class Module_Auto : public Module_Base<Module_Auto> {
private:
    VoidCallback _callback_on = nullptr;
    VoidCallback _callback_off = nullptr;
    int _initialStart = 0;
    int _initialStop = 0;

    int32_t _secToStart = -1;
    int32_t _secToStop  = -1;
    bool _isCurrentlyActive = false;

public:
    Module_Auto() {_type = "autoStartStop";}
    bool* on = nullptr;
    int* start_sec = nullptr;
    int* stop_sec = nullptr;

    // --- CONFIGURATION CHAIN ---

    Module_Auto& setCallbacks(VoidCallback on_cb, VoidCallback off_cb) {
        _callback_on = on_cb;
        _callback_off = off_cb;
        return *this;
    }

    Module_Auto& setInitialTimes(int startSec, int stopSec) {
        _initialStart = startSec;
        _initialStop = stopSec;
        return *this;
    }
    uint32_t onDurationSec() {
        return (_initialStop - _initialStart + SEC_PER_DAY)%SEC_PER_DAY;
    }
    // --- LOGIC: Recalculate the relative timer ---
    void syncAlarms() {
        time_t now; time(&now);
        struct tm lTime; localtime_r(&now, &lTime);
        int secNow = (lTime.tm_hour * 3600 + lTime.tm_min * 60 + lTime.tm_sec);

        // Calculate initial distance to both points in the future
        _secToStart = (*start_sec - secNow + SEC_PER_DAY) % SEC_PER_DAY;
        _secToStop  = (*stop_sec  - secNow + SEC_PER_DAY) % SEC_PER_DAY;

        // If it's 0, it means it's happening right now
        if (_secToStart <= 0) _secToStart = SEC_PER_DAY;
        if (_secToStop  <= 0) _secToStop  = SEC_PER_DAY;
        debugfln("Auto [%s]: State=%s, Next on in %ds, Next off in %ds",_id, _isCurrentlyActive ? "ON" : "OFF", _secToStart, _secToStop);
    }

    // --- LIFECYCLE ---
    void setup() override {
        on        = this->control->addValue("on", false, this->_persist);
        start_sec = this->control->addValue("start", 0, this->_persist);
        stop_sec  = this->control->addValue("stop", 0, this->_persist);
    }
    bool onUpdate_internal() override {
        syncAlarms();
        return true; //true performs any onUpdate function that was set
    }
    void onTimeChange() override {
        syncAlarms(); // Critical: Recalculate if NTP shifts the clock
    }

    void tick1s() override {
        if (!on || !(*on)) return;

        _secToStart--;
        _secToStop--;

        // START Event
        if (_secToStart <= 0) {
            if (_callback_on) _callback_on();
            _secToStart = SEC_PER_DAY; // Reset for tomorrow
            debugfln("Auto [%s]: Start Triggered", _id);
        }

        // STOP Event
        if (_secToStop <= 0) {
            if (_callback_off) _callback_off();
            _secToStop = SEC_PER_DAY; // Reset for tomorrow
            debugfln("Auto [%s]: Stop Triggered", _id);
        }
    }
};