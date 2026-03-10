#pragma once
#include <Control/Control.h>
#include <Wifi_socket/myWifi_socket.h>
#include <helpers.h>

extern JsonDocument jsonMaster;
extern JsonDocument jsonReply;
extern std::vector<ControlBase*> uiRegistry;

// Standard ESP32 IP to String helper
inline String ipToString(IPAddress ip) {
  return String(ip[0]) + "." + String(ip[1]) + "." + String(ip[2]) + "." + String(ip[3]);
}

class Module_WiFi {
public:
    MultiControl control;
    MyWiFi_socket* wf = nullptr;
    
    // Pointers for the monitor task
    int* rssi = nullptr;
    String* ip = nullptr;

    Module_WiFi(const char* group, const char* id, const char* name)
        : control(group, id, "display", name) {
        control.values.reserve(8);
    }

    /**
     * @param _wf Pointer to the existing WiFi socket instance
     */
    void setup(MyWiFi_socket* _wf) {
        wf = _wf;

        // 1. Setup Values (Read-only, no persist)
        control.addValue("rssi", 0, false);
        control.addValue("ip", "0.0.0.0", false);
        
        // Add some metadata for your new Display.jsx
        control.setMeta("append", ""); 
        control.setMeta("thresholds.rssi", -80); 

        uiRegistry.push_back(&control);

        // 2. Cache Pointers
        rssi = control.getIntPtr("rssi");
        ip = control.getStringPtr("ip");

        // 3. Start Connection
        wf->start_wifi();

        // 4. Start Monitor Task
        xTaskCreatePinnedToCore(task, "WiFiMon", 4096, this, 1, nullptr, 0);
    }
    static String jsonFromWeb(char* jsonString) {
        // 1. Handle "GET" (Initial Load / Browser Refresh)
        if (jsonString == nullptr) {
            String c;
            serializeJson(jsonMaster, c);
            return c;
        }

        // 2. Parse Incoming JSON
        JsonDocument incomingDoc;
        DeserializationError error = deserializeJson(incomingDoc, jsonString);
        if (error) {
            debugln("WiFi: Invalid JSON received");
            return "";
        }

        jsonReply.clear();
        JsonObject root = incomingDoc.as<JsonObject>();

        // 3. Match Incoming IDs to Registry
        for (JsonPair kv : root) {
            const char* id = kv.key().c_str();

            // Loop through all registered modules (LED, Pump, etc.)
            for (auto* c : uiRegistry) {
                if (strcmp(c->id, id) == 0) {
                    MultiControl* mc = static_cast<MultiControl*>(c);

                    // Update internal C++ variables
                    mc->updateFromNested(kv.value());

                    // Update jsonMaster & prepare the Delta for other clients
                    mc->sync(jsonReply.to<JsonObject>());
                }
            }
        }

        // 4. Return Delta if changes occurred
        if (jsonReply.size() > 0) {
            String response;
            serializeJson(jsonReply, response);
            return response;
        }

        return "";
    }

private:
    static void task(void* pv) {
        auto* self = static_cast<Module_WiFi*>(pv);
        self->runLoop();
    }

    void runLoop() {
        for (;;) {
            bool connected = (wf != nullptr && wf->isConnected());

            if (!connected) {
                debugln("WiFi: Connection lost. Reconnecting...");
                if (wf) wf->reconnect();
                if (rssi) *(rssi) = 0;
                if (ip) *(ip) = "DISCONNECTED";
            } else {
                // Update pointers directly for high speed
                if (rssi) *(rssi) = wf->signalStrength();
                if (ip) *(ip) = wf->ipAddess();
            }

            // WiFi monitoring doesn't need to be fast. 10s is plenty.
            vTaskDelay(pdMS_TO_TICKS(10000));
        }
    }
};