#pragma once
#include <module_base.h>
#include <sys/time.h>
#include <time.h>

class Module_Time : public Module_Base<Module_Time> {
   private:
    String* _dateTimePtr = nullptr;

   public:
    Module_Time() {_type = "dateTime";}

    void setup() override {
        _dateTimePtr = this->control->addValue("date_time_now", "2026-01-01T00:00:00", false);
    }
    
    bool onUpdate_internal() override {
        this->processManualTimeSet(_dateTimePtr);
        return true;
    }
    void tick10s() override {
        // UI Refresh every 10 seconds
        refreshSystemTime();
    }

    void refreshSystemTime() {
        if (!_dateTimePtr) return;

        time_t now;
        time(&now);
        struct tm ti;
        localtime_r(&now, &ti);

        char buf[24];
        snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d", ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);

        this->control->setSilent("date_time_now", String(buf));
    }
    void onTimeChange() override { refreshSystemTime(); }

   private:
    void broadcastTimeChange() {
        debugln("Time: Broadcasting update to all modules...");

        for (Module* m : Registry::modules) {
            if (m == this) {continue;}
            if (m) {m->onTimeChange();}
        }
    }

    void processManualTimeSet(String* sDateTime) {
        if (!sDateTime) return;

        int y, m, d, hh, mm, ss = 0;
        if (sscanf(sDateTime->c_str(), "%d-%d-%dT%d:%d:%d", &y, &m, &d, &hh, &mm, &ss) >= 5) {
            struct tm ti = {0};
            ti.tm_year = y - 1900;
            ti.tm_mon = m - 1;
            ti.tm_mday = d;
            ti.tm_hour = hh;
            ti.tm_min = mm;
            ti.tm_sec = ss;

            time_t t = mktime(&ti);
            if (t != -1) {
                struct timeval tv = {.tv_sec = t, .tv_usec = 0};
                settimeofday(&tv, NULL);
                debugfln("System time manually set: %s", sDateTime);

                broadcastTimeChange();  // Notify all modules of the time change
            }
        }
    }
};