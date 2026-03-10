#pragma once
#include <Control/Control.h>
#include <time.h>
#include <sys/time.h>
#include <helpers.h>
extern std::vector<ControlBase*> uiRegistry;

class Module_Time {
public:
    MultiControl control;

    Module_Time(const char* group, const char* id, const char* name)
        : control(group, id, "dateTime", name) {
        control.values.reserve(4);
    }

    void setup() {
        control.addValue("date_time_now", "2024-01-01T00:00:00", false);
        
        // Manual Time Sync from Web
        control.onUpdate = [this](const char* id, const char* key, JsonVariant val) {
            if (strcmp(key, "date_time_now") == 0) {
                this->processManualTimeSet(val.as<const char*>());
            }
        };

        uiRegistry.push_back(&control);
    }

    void refreshSystemTime() {
        time_t now; time(&now);
        struct tm ti; localtime_r(&now, &ti);
        char buf[24];
        snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d", 
                 ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, 
                 ti.tm_hour, ti.tm_min, ti.tm_sec);
        
        control.setSilent("date_time_now", String(buf));
        debugfln("System time refreshed: %s",buf);
    }

private:
    void processManualTimeSet(const char* sDateTime) {
        if (!sDateTime) return;
        int y, m, d, hh, mm, ss = 0;
        if (sscanf(sDateTime, "%d-%d-%dT%d:%d:%d", &y, &m, &d, &hh, &mm, &ss) >= 5) {
            struct tm ti = {0};
            ti.tm_year = y - 1900; ti.tm_mon = m - 1; ti.tm_mday = d;
            ti.tm_hour = hh; ti.tm_min = mm; ti.tm_sec = ss;
            time_t t = mktime(&ti);
            if (t != -1) {
                struct timeval tv = { .tv_sec = t, .tv_usec = 0 };
                settimeofday(&tv, NULL);
                debugfln("System time manually set: %s",sDateTime);
            }
        }
    }
};