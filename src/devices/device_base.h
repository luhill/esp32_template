#pragma once
#include <Arduino.h>
#include <vector>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <helpers.h>
#include <secrets.h>
#include <registry.h>


// 2. DEFINE THE ENGINE STRUCTURE
class DeviceBase {
protected:
    Preferences _prefs;
    JsonDocument _jsonMaster;
    uint32_t _loopStack = 4096; 
    uint32_t _uiStack = 2560;

    static void task_module_loop(void* param);
    static void task_ui_monitor(void* param);
    

    TaskHandle_t _hLoop = nullptr;
    TaskHandle_t _hUI = nullptr;
    static TaskHandle_t hExternalTask;

public:
    DeviceBase() {}
    virtual ~DeviceBase() {}

    virtual void makeSafe(){};//First function call. Override this to immediately set pin states on boot
    virtual void setup_hardware() = 0;

    virtual void loop10ms() {};
    virtual void loop20ms() {};
    virtual void loop50ms() {};
    virtual void loop100ms() {};
    virtual void loop1s() {};
    virtual void loop10s() {};

    virtual void onSettingsLoaded() {};

    inline void begin() {
        makeSafe();
        Registry::masterJson = &_jsonMaster;
        setup_hardware();//In setup modules initialize setup the controls it owns
        loadSettings();//Controls can load persistant values from the NVS
        onSettingsLoaded();//Devices can override this to share settings between controls (i.e. set pump module auto off time to the value in a slider module)
        buildControlsJson();//finally the json document describing the ui is built (used to send and receive websocket ui updates)

        xTaskCreatePinnedToCore(task_module_loop, "ModLoop", _loopStack, this, 1, &_hLoop, 1);
        xTaskCreatePinnedToCore(task_ui_monitor, "UIMon", _uiStack, this, 1, &_hUI, 0);
    }
    void loadSettings();
    void buildControlsJson();
};

// 3. NOW INCLUDE THE FULL MODULE DEFINITIONS
// This is where 'Module' and 'Module_Base' are fully defined.
#include <modules/module_base.h> 
#include <Control/Control.h>
#include <modules/module_wifi.h>

inline TaskHandle_t DeviceBase::hExternalTask = nullptr;

/** @brief Devices and Modules can override various periodic tick functions that are called here
 *  @note  Additional module tick functions can be added in module_base.h
 *  @note  Additional device tick functions can be added above
 */
inline void DeviceBase::task_module_loop(void* parameter) {
    DeviceBase* self = static_cast<DeviceBase*>(parameter);
    uint32_t tick_count = 0;
    uint32_t seconds_count = 0;

    for (;;) {
        bool t20ms  = (tick_count % 2 == 1);
        bool t50ms  = (tick_count % 5 == 2);
        bool t100ms = (tick_count % 10 == 8);
        bool t1s    = (tick_count % 100 == 7);
        bool t10s   = (seconds_count % 10 == 0 && tick_count == 9);

        for (Module* m : Registry::modules) {
            if (!m) continue;
            m->tick10ms();
            if (t20ms)  m->tick20ms();
            if (t50ms)  m->tick50ms();
            if (t100ms) m->tick100ms();
            if (t1s)    m->tick1s();
            if (t10s)   m->tick10s();
        }

        self->loop10ms();
        if (t20ms)  self->loop20ms();
        if (t50ms)  self->loop50ms();
        if (t100ms) self->loop100ms();
        if (t1s)    self->loop1s(); 
        if (t10s)   self->loop10s();


        #if DEBUGGING
        if (t10s) {
            uint32_t hl = uxTaskGetStackHighWaterMark(self->_hLoop);
            uint32_t hu = uxTaskGetStackHighWaterMark(self->_hUI);
            
            if (hExternalTask) {
                uint32_t hExt = uxTaskGetStackHighWaterMark(hExternalTask);
                debugfln("Headroom (min 400) - Loop:%u | UI:%u | DMA: %u", hl, hu,hExt);
            } else {
                debugfln("Headroom (min 400) - Loop:%u | UI:%u", hl, hu);
            }
        }
        #endif

        tick_count++;
        if (tick_count >= 100) {
            tick_count = 0;
            seconds_count++;
            if (seconds_count >= 3600) seconds_count = 0;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

/** @brief Store changes to NVS and update web ui
 *  @note 1: Changes made to values flaged to persist will be saved to NVS after a settle period. Saved values are reloaded when the device restarts
 *        2. Changes to controls that are registered for web update will be pushed to all open websockets to update the webpage ui
 */
inline void DeviceBase::task_ui_monitor(void* parameter) {
    DeviceBase* self = static_cast<DeviceBase*>(parameter);
    const uint32_t SETTLE_TIME_MS = 3000; // Wait 3s after last move

    // 1. Pre-allocate the memory buffers outside the loop
    // Reusing these prevents Heap Fragmentation
    static JsonDocument deltaDoc; 
    static String outputBuffer;
    outputBuffer.reserve(1024); // Pre-size to avoid reallocations

    for (;;) {
        deltaDoc.clear();
        JsonObject delta = deltaDoc.to<JsonObject>();
        //JsonObject delta = jsonReply.to<JsonObject>();

        for (auto* c : Registry::controls) {
            MultiControl* mc = static_cast<MultiControl*>(c);
            
            // 1. Handle Web Sync (Same as yesterday)
            mc->sync(delta);

            // 2. Handle NVS Auto-Save
            if (mc->isDirty && (millis() - mc->lastChangeTime > SETTLE_TIME_MS)) {
                
                debugfln("NVS: Settled. Saving %s to Flash...", mc->id);
                
                self->_prefs.begin("app_nvs", false);
                mc->save(self->_prefs);
                self->_prefs.end();

                mc->isDirty = false;  // Reset the flag
            }
        }

        static unsigned long lastPing = 0;
        if (Module_WiFi::getSocket() && Module_WiFi::getSocket()->hasActiveClients()) {
            // Update high-frequency data only when a user is looking
            //send entire ui if flag is set
            if(deltaDoc.size()>0){
                serializeJson(deltaDoc, outputBuffer);
                Module_WiFi::getSocket()->updateClients(outputBuffer.c_str());
                lastPing = millis();
            //make sure at least on message is sent every 2 seconds
            }else if(millis()-lastPing >2000){
                debugln("♥");
                Module_WiFi::getSocket()->updateClients("{\"h\":1}");  // "h" for heartbeat
                lastPing = millis();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

/** @brief Load settings that were stored to the NVS */
inline void DeviceBase::loadSettings() {
    debugln("NVS: Loading settings from Flash...");
    
    // Open in Read-Only mode (true)
    if (!_prefs.begin("app_nvs", true)) {
        debugln("NVS: Namespace not found (First boot). Skipping load.");
        return; 
    }

    for (auto* control : Registry::controls) {
        if (control != nullptr) { // <--- CRITICAL SAFETY CHECK
            MultiControl* mc = static_cast<MultiControl*>(control);
            mc->load(_prefs);
        }
    }
    _prefs.end();
    debugln("end load settings");

    for (Module* m : Registry::modules) {
        m->onBegin();//onBegin method allows modules to access the nvs data after the settings have loaded
    }
}
/** @brief Generate the json document describing the ui 
 * @note optionally 
*/
inline void DeviceBase::buildControlsJson() {
    /** @brief src/config/app.json allows you to add custom json content to be sent to the front end
     * @note The json file gets turned into string via the jsonFileToString.py script that is setup in platformio_base.ini
     */
    #ifdef USE_APP_JSON
    #ifndef APP_JSON_STRING
    #define APP_JSON_STRING "{\"extra\":\"Default extra JSON is in sec/config/app.json\"}"
    #endif
    DeserializationError error = deserializeJson(jsonMaster, APP_JSON_STRING);
    if (error) {
        debugfln("Failed to parse APP_JSON_STRING: %s", error.c_str());
        //return;
    }
    #endif

    (*Registry::masterJson).clear();
    JsonObject root = (*Registry::masterJson).to<JsonObject>();
    /** @note update FIRMWARE_VERSION in platformio_base.ini */
    root["ver"] = FIRMWARE_VERSION;
    for (auto* control : Registry::controls) {
        MultiControl* mc = static_cast<MultiControl*>(control);
        mc->build(root);
    }
}