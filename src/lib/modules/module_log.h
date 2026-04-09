#pragma once
#include <module_base.h>
#include <esp_system.h>
#include <deque>

class Module_Log : public Module_Base<Module_Log> {
   private:
    std::deque<String> _logEntries;
    const int MAX_LOGS = 15;
    String* _entriesPtr = nullptr;
    bool _logBoot = false;
   public:
    Module_Log() {_type = "list";}

    /**
     * @brief flag to automatically log the boot reason after the time changes (when the time is synced).
     */
    Module_Log& setLogBoot(bool logBoot) {
        _logBoot = logBoot;
        return *this;
    }

    /**
     * @brief Phase 1: Define the schema.
     * Call this BEFORE loadSettings() so the NVS provider knows this key
     * exists.
     */
    void setup() override {
        //this->control = new MultiControl(this->_tab, this->_id, "list", this->_label);

        // Add the value to the control and capture the pointer immediately
        _entriesPtr = this->control->addValue("entries", "[]", true);
    }

    /**
     * @brief Phase 2: Execution.
     * Call this AFTER loadSettings() to parse the restored Flash data.
     */
    void onBegin() override {
        debugln("Starting log");
        if (_entriesPtr && *_entriesPtr != "[]") {
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, *_entriesPtr);

            if (!error) {
                JsonArray arr = doc.as<JsonArray>();
                _logEntries.clear();
                for (JsonVariant v : arr) {
                    _logEntries.push_back(v.as<String>());
                }
            }
        }
    }

    /**
     * @brief Adds a timestamped entry to the log.
     */
    void add(String msg) {
        time_t now;
        time(&now);
        struct tm ti;
        localtime_r(&now, &ti);

        char buf[32];
        // If NTP hasn't synced (year < 2020), mark as [BOOT]
        const char* fmt = (ti.tm_year > 120) ? "[%Y-%m-%d %H:%M:%S] " : "[BOOT] ";
        strftime(buf, sizeof(buf), fmt, &ti);

        String entry = String(buf) + msg;

        // Circular buffer logic
        _logEntries.push_front(entry);
        if (_logEntries.size() > MAX_LOGS) {
            _logEntries.pop_back();
        }

        syncToNVS();
    }
    void onTimeChange() override {
        if(_logBoot){
            logRebootReason();
        }   
    }   
    void logRebootReason() {
        esp_reset_reason_t reason = esp_reset_reason();
        String msg = "Online (Reason: ";
        switch (reason) {
            case ESP_RST_POWERON:
                msg += "Cold Boot";
                break;
            case ESP_RST_SW:
                msg += "Software Reset";
                break;
            case ESP_RST_PANIC:
                msg += "Crash Recovery";
                break;
            case ESP_RST_INT_WDT:
                msg += "Watchdog Timeout";
                break;
            case ESP_RST_BROWNOUT:
                msg += "Power Brownout";
                break;
            default:
                msg += "Unknown";
                break;
        }
        msg += ")";
        add(msg);
    }

   private:
    void syncToNVS() {
        if (!_entriesPtr) return;

        JsonDocument doc;
        JsonArray arr = doc.to<JsonArray>();

        for (const auto& s : _logEntries) {
            arr.add(s);
        }

        // Serialize directly into the MultiControl's internal String
        *_entriesPtr = "";
        serializeJson(arr, *_entriesPtr);

        // This triggers the global "Auto-Save to Flash" task
        this->control->markDirty();
    }
};