#pragma once
#include <Control/Control.h>
#include "helpers.h"
#include <deque>

#include <esp_system.h>

class Module_Log {
public:
    MultiControl control;
    std::deque<String> logEntries;
    const int MAX_LOGS = 15;
    String* entriesPtr = nullptr;

    Module_Log(const char* group, const char* id, const char* name)
        : control(group, id, "list", name) {}

    /**
     * @brief Phase 1: Define the schema. 
     * Call this BEFORE loadSettings() in main.cpp
     */
    void setup() {
        // Register the key so loadSettings() knows where to put the Flash data
        control.addValue("entries", "[]", true); 
        uiRegistry.push_back(&control);
        
        // Cache the pointer for later use
        entriesPtr = control.getStringPtr("entries");
    }

    /**
     * @brief Phase 2: Start logic. 
     * Call this AFTER loadSettings() in main.cpp
     */
    void begin() {
        if (entriesPtr) {
            // 1. Parse what loadSettings() just pulled from Flash
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, *entriesPtr);
            
            if (!error) {
                JsonArray arr = doc.as<JsonArray>();
                logEntries.clear();
                for (JsonVariant v : arr) {
                    logEntries.push_back(v.as<String>()); // Restore to deque
                }
            }
        }

        // 2. Now append the new Reboot Reason to the restored list
        //logRebootReason();
    }

    void add(String msg) {
        time_t now;
        time(&now);
        struct tm ti;
        localtime_r(&now, &ti);

        char buf[32];
        // Only show date if we have a valid NTP sync (year > 2020)
        const char* fmt = (ti.tm_year > 120) ? "[%Y-%m-%d %H:%M:%S] " : "[BOOT] ";
        strftime(buf, sizeof(buf), fmt, &ti);

        String entry = String(buf) + msg;
        
        // Add to front of deque
        logEntries.push_front(entry);
        
        // Maintain circular buffer size
        if (logEntries.size() > MAX_LOGS) {
            logEntries.pop_back();
        }

        syncToPointer();
    }

    void logRebootReason() {
        esp_reset_reason_t reason = esp_reset_reason();
        String msg = "Restart (";
        switch (reason) {
            case ESP_RST_POWERON:  msg += "Power On"; break;
            case ESP_RST_SW:       msg += "Software"; break;
            case ESP_RST_PANIC:    msg += "Crash/Panic"; break;
            case ESP_RST_INT_WDT:  msg += "Watchdog"; break;
            case ESP_RST_BROWNOUT: msg += "Brownout"; break;
            default:               msg += "Other"; break;
        }
        msg += ")";
        add(msg);
    }

private:
    void syncToPointer() {
        if (!entriesPtr) return;

        JsonDocument doc;
        JsonArray arr = doc.to<JsonArray>();
        
        // Deque is push_front, so we iterate normally to keep order in JSON
        for (const auto& s : logEntries) {
            arr.add(s);
        }

        // Serialize directly into the pointer's string
        *entriesPtr = ""; 
        serializeJson(arr, *entriesPtr);

        // Mark dirty for the global NVS auto-save task
        control.markDirty();
    }
};