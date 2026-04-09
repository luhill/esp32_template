#pragma once
#include <module_base.h>
#include <wifi_socket/wifi_socket.h> // Your renamed class
#include <nvs_flash.h>

#define HAS_WIFI

class Module_WiFi : public Module_Base<Module_WiFi> {
private:
    wifi_socket* _socket = nullptr;
    static Module_WiFi* _instance;
    // static wifi_socket* _instance;
    // Configuration stored before .begin()
    const char* _ssid = "";
    const char* _pass = "";
    const char* _hostname = "ESP32-Device";
    
    // Cached pointers for UI
    int* _rssiPtr = nullptr;
    String* _ipPtr = nullptr;
    JsonDocument jsonReply;
public:
    Module_WiFi() {_type = "display";}

    // Singleton Accessor: Allows other modules to reach the socket via Module_WiFi::getSocket()
    static wifi_socket* getSocket() {
        return (_instance) ? _instance->_socket: nullptr;
    }

    // --- CONFIGURATION CHAIN ---

    Module_WiFi& setCredentials(const char* ssid, const char* pass, const char* hostname = "ESP32-Device") {
        _ssid = ssid;
        _pass = pass;
        _hostname = hostname;
        return *this;
    }

    // --- LIFECYCLE ---
    void tick10s() override {
        // WiFi monitoring is slow (every 10 seconds)

        if (_socket) {
            if (_socket->isConnected()) {
                if (_socket->mdnsStarted == false) {
                    _socket->startMDNS();
                }
                // Update UI Pointers
                if (_rssiPtr) *_rssiPtr = _socket->getRSSI();
                if (_ipPtr) *_ipPtr = _socket->getIPAddress();
                this->control->forceUiUpdate();//by default the ui will only receive an update if one of these values changes. I prefer to see a 10s rssi update regardless of change.
            } else {
                // Connection is down!
                if (_rssiPtr) *_rssiPtr = 0;
                if (_ipPtr) *_ipPtr = String("DISCONNECTED");
                // Trigger the smart reconnect
                _socket->reconnect();
            }
        }
    }
    void setup() override {
        // 3. Set the Singleton instance
        _instance = this;

        // 1. Create the UI Control
        _rssiPtr = this->control->addValue("rssi", 0, false);
        _ipPtr = this->control->addValue("ip", "0.0.0.0", false);

        this->control->setMeta("thresholds.rssi", -80);

        // 2. Initialize the internal Socket
        _socket = new wifi_socket(Module_WiFi::jsonFromWeb, _hostname, _ssid,
                                  _pass, false);
        auto timeSyncCallback = [](){
            //broadcase time change to all modules
            for (Module* m : Registry::modules) {
                if (m) {m->onTimeChange();}
            }
        };
        wifi_socket::onTimeSynced = timeSyncCallback;
    }
    void onBegin() override {
        // grab shortcuts from all modules and register them with the socket
        for (Module* m : Registry::modules) {
            auto* shortcuts = m->getShortcuts();
            if (shortcuts) {
                for (auto const& [url, entry] : *shortcuts) {
                    debugfln("WiFi: Registering %s -> %s", entry.name.c_str(), url.c_str());
                    _socket->on(url.c_str(), entry.cb_shortcut);
                }
            }
        }
        _socket->start();
    }
    void clearNVS() {
        Serial.println("Erasing ALL NVS Partitions...");

        // 1. Release the NVS handle
        nvs_flash_deinit();

        // 2. Erase the partition labeled "nvs"
        esp_err_t err = nvs_flash_erase();

        if (err == ESP_OK) {
            Serial.println("Success! All namespaces and keys are gone.");
            // 3. Re-initialize so the ESP32 can use it again immediately
            nvs_flash_init();
            Serial.println("NVS Re-initialized. Rebooting recommended.");
            delay(1000);
            // esp_restart();
        } else {
            Serial.printf("Erase failed: %s\n", esp_err_to_name(err));
        }
    }
    // --- CENTRAL JSON PROCESSOR ---
    // This remains static so the wifi_socket can call it without an instance
    static String jsonFromWeb(char* jsonString) {
        if(!_instance)return "";

        if (jsonString == nullptr) {
            String c;
            serializeJson((*Registry::masterJson), c);
            return c;
        }

        debugfln("web cmd: %s", jsonString);

        JsonDocument incomingDoc;
        if (deserializeJson(incomingDoc, jsonString)) return "";

        if(incomingDoc["cmd"] == "refresh"){
            String c; serializeJson((*Registry::masterJson), c); return c;
        }
        if(incomingDoc["cmd"] == "clearNVS"){
            _instance->clearNVS();
            return "Nvs cleared";
        }

        _instance->jsonReply.clear();
        JsonObject root = incomingDoc.as<JsonObject>();

        for (JsonPair kv : root) {
            const char* targetId = kv.key().c_str();
            for (auto* c : Registry::controls) {
                if (strcmp(c->id, targetId) == 0) {
                    MultiControl* mc = static_cast<MultiControl*>(c);
                    mc->updateFromNested(kv.value());
                    mc->sync(_instance->jsonReply.to<JsonObject>());
                }
            }
        }

        if (_instance->jsonReply.size() > 0) {
            String response; serializeJson(_instance->jsonReply, response);
            return response;
        }
        return "";
    }
};
Module_WiFi* Module_WiFi::_instance = nullptr;