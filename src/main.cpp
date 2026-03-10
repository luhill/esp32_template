
#include <helpers.h>
#include <ArduinoJson.h>
#include <vector>
#include <Control/Control.h>


//#include <Preferences.h>
#ifndef APP_JSON_STRING
#define APP_JSON_STRING "{\"app_name\":\"Update App name in app.json\"}"
#endif
/*
Garage
Board:??
Pin open/close 13
*/
/*
Gate
board = esp32doit-devkit-v1
pin_open 18
pin_close 19
pin_touch_open 13
pin_touch_partial_open 12
pin_touch_close 14
full open time 20s
partial open% 15
server.on("/openPartial", HTTP_GET, [](AsyncWebServerRequest *request){
    unsigned int percent =-1;
    if(request->hasParam("p")){
      percent = request->getParam("p")->value().toInt(); 
    }
    if(percent < 0 || percent > 100){percent=DEFAULT_PARTIAL_OPEN_PERCENT;}
    openGate_partial(percent);
    memset(reply, 0, sizeof reply);
    sprintf(reply,"opened %u%%",percent);
    request->send(200,"text/plain",reply);
  });
*/
//---------------------------------Global Variables---------------------------------//
JsonDocument jsonMaster;
JsonDocument jsonReply;

Preferences preferences;
std::vector<ControlBase*> uiRegistry;

bool flag_update_ui = false;
//------------------------------Modules-----------------------------------------//
#define HAS_BRUSHED_MOTOR
#ifdef HAS_BRUSHED_MOTOR
#include <module_brushed_motor.h>
    Module_Brushed_Motor module_pump("home", "pump", "Pump");
#endif
#define HAS_LED
#ifdef HAS_LED
#include <module_led.h>
    Module_Led module_led_status("home", "status_led", "Onboard LED");
    //Module_Led module_led_strip("home", "strip", "Led");
#endif
#define HAS_TIME
#ifdef HAS_TIME
    #include <module_time.h>
    Module_Time module_time("home", "time", "Time");
#endif
#define HAS_AUTO
#ifdef HAS_AUTO
#include <modules/module_auto.h>
    Module_Auto module_auto_led("home", "auto_led","Auto");
#endif
#define HAS_BUTTON
#ifdef HAS_BUTTON
#include <modules/module_button.h>
#include <modules/module_switch.h>
    //MultiControl control_enable_buttons("settings","enable_bts","switch","Enable Buttons");
    Module_Switch module_switch_enable_touch("settings","enable_bts","Enable Buttons");
    Module_Button module_button("home","touch","Pin1");
#endif
#define HAS_LOG
#ifdef HAS_LOG
    #include <modules/module_log.h>
    Module_Log module_log("settings","log","Log");
#endif
#define HAS_WIFI
#ifdef HAS_WIFI
#include <Wifi_socket/myWifi_socket.h>
#include <modules/module_wifi.h>
    MyWiFi_socket wifi(Module_WiFi::jsonFromWeb, "test", "glitchy", "298Seven", false);
    Module_WiFi module_wifi("settings", "wifi", "Network Status");
#endif

//------------------------------Rotary Encoder----------------------------------//
#define HAS_ROTARY_ENCODER
#ifdef HAS_ROTARY_ENCODER
#include <Rotary_Encoder/rotary.h>
#define PIN_ROTARY_A 11  ///< iBUS data in.
#define PIN_ROTARY_B 12  ///< Not required for iBUS (disabled).
#define PIN_ROTARY_S 13  ///< Button pin of encoder (sw)
    rotary encoder_pump(PIN_ROTARY_A, PIN_ROTARY_B, PIN_ROTARY_S);
#endif

//------------------------------Base Timer------------------------------------------//
//#define USE_ISR_TIMER
#if defined(USE_ISR_TIMER) || defined(HAS_AUTO)
#define BASE_TIMER
#include <ESP32TimerInterrupt.h>
ESP32Timer base_timer(3); //The timer library will use hardware timer 3
ESP32_ISRTimer shared_isr_timer;
//ISR_timer ticks 
bool IRAM_ATTR hwTimerHandler(void * timerNo){
	shared_isr_timer.run();
	return true;
}
//handle case when auto-on is triggered
void IRAM_ATTR alarm_start(){
    // ! NO serial output or floating point calcs allowed in interrupt handlers
    if (module_led_status.isOn != nullptr) {
        *module_led_status.isOn = true; // Instant memory toggle
    }
    shared_isr_timer.changeInterval(module_auto_led.handle_on, MS_PER_DAY);//reschedule for 24hrs (time in ms)
}
//handle case when auto-off is triggered
static int ISR_HANDLE_AUTO_OFF =-1;//handle to stop timer
void IRAM_ATTR alarm_stop(){
    // ! NO serial output or floating point calcs allowed in interrupt handlers
    if (module_led_status.isOn != nullptr) {
        *module_led_status.isOn = false; // Instant memory toggle
    }
    shared_isr_timer.changeInterval(module_auto_led.handle_off, MS_PER_DAY);//reschedule for 24hrs (time in ms)
}
#endif

//------------------------------------------Setup methods-------------------------------------
void task_controls_update(void* parameter);
void setupControls(){
    #ifdef HAS_BRUSHED_MOTOR
        module_pump.setup(6);
        #ifdef HAS_ROTARY_ENCODER
        encoder_pump.onRotaryInput = [&](int s,int r){
            module_pump.updateFromRotary(s,r);
        };
        encoder_pump.start();
        #endif
    #endif
    #ifdef HAS_LED
        module_led_status.setup<WS2811Controller800Khz, 48, GRB>(1);
        //module_led_strip.setup<WS2811Controller800Khz, 7, GRB>(2);
    #endif
    #ifdef HAS_TIME
        module_time.setup();
    #endif
    #ifdef HAS_AUTO
        module_auto_led.setup(&shared_isr_timer, alarm_start, alarm_stop, timeToSec(8, 30),timeToSec(22, 45));
    #endif
    #ifdef HAS_BUTTON
        module_switch_enable_touch.setup();
        module_button.setup(1,true,[](){debugfln("double tap");},module_switch_enable_touch.on);
    #endif
    #ifdef HAS_WIFI
        #ifdef HAS_TIME
        MyWiFi_socket::onTimeSynced= [](){
            module_time.refreshSystemTime();
            module_log.logRebootReason();
            #ifdef HAS_AUTO
            module_auto_led.updateTimers();
            #endif
        };
        #endif
        wifi.on("/open",[](){debugln("open called");});
        wifi.on("/close",[](){debugln("close called");});
        module_wifi.setup(&wifi);
        
    #endif
        #ifdef HAS_LOG
        module_log.setup();
    #endif
    //web update pushes any changes to the web ui
    configASSERT(xTaskCreatePinnedToCore(task_controls_update, "Controls", 2048,nullptr, 1, nullptr, 0) == pdPASS);
    delay(50);
}
void loadSettings() {
    debugln("NVS: Loading settings from Flash...");
    
    // Open in Read-Only mode (true)
    if (!preferences.begin("bidet_app", true)) {
        debugln("NVS: Namespace not found (First boot). Skipping load.");
        return; 
    }

    for (auto* base : uiRegistry) {
        if (base != nullptr) { // <--- CRITICAL SAFETY CHECK
            MultiControl* mc = static_cast<MultiControl*>(base);
            mc->load(preferences);
        }
    }
    preferences.end();
}
void buildControlsJson() {
    // First, deserialize the APP_JSON_STRING to initialize jsonMaster
    // This allows the base structure (app_name, etc.) to be defined in app.json
    DeserializationError error = deserializeJson(jsonMaster, APP_JSON_STRING);
    if (error) {
        debugfln("Failed to parse APP_JSON_STRING: %s", error.c_str());
        //return;
    }
    
    //JsonObject root = jsonMaster["controls"].to<JsonObject>();
    JsonObject root = jsonMaster.as<JsonObject>();
    for (auto* base : uiRegistry) {
        MultiControl* mc = static_cast<MultiControl*>(base);
        mc->build(root);
    }
}
void initSystem(){
    //order of these operations must be kept
    setupControls();// Build our controls and the master JSON document, and register them for web updates
    loadSettings(); // Load saved settings from Flash into our controls
    #ifdef HAS_LOG
    module_log.begin();//must be called after load settings
    #endif
    buildControlsJson(); // Rebuild the master JSON. Must be called after loadSettings() to reflect loaded settings
}
void setup() {
    // ---- Start serial monitor ---- //
    Serial.begin(115200);
    delay(200);//delay to allow serial monitor to start before printing

    debugln("===== Startup =====");
    initSystem();
    
    //base_timer uses the ESP32TimerInterrupt.h library to host up to 16 ISR timers using a single hardware timer
    #ifdef BASE_TIMER
    if (base_timer.attachInterruptInterval(1000,hwTimerHandler)){//set hardware timer to run at 1ms (1000 us)
    }else{
        debugfln("Error: Failed to start hardware timer");
    }
    #endif

    delay(50);
}

/*task_controls_update:
    1. Changes made to values flaged to persist will be saved to NVS after a settle period. Saved values are reloaded when the device restarts
    2. Changes to controls that are registered for web update will be pushed to all open websockets to update the webpage ui
*/
void task_controls_update(void* parameter) {
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

        for (auto* c : uiRegistry) {
            MultiControl* mc = static_cast<MultiControl*>(c);
            
            // 1. Handle Web Sync (Same as yesterday)
            mc->sync(delta);

            // 2. Handle NVS Auto-Save
            if (mc->isDirty && (millis() - mc->lastChangeTime > SETTLE_TIME_MS)) {
                
                debugfln("NVS: Settled. Saving %s to Flash...", mc->id);
                
                preferences.begin("bidet_app", false);
                mc->save(preferences);
                preferences.end();

                mc->isDirty = false;  // Reset the flag
            }
        }
#ifdef HAS_WIFI
        bool hasClients = wifi.hasActiveClient();
        static unsigned long lastPing = 0;
        if (hasClients) {
            //send entire ui if flag is set
            if(flag_update_ui){
                serializeJson(jsonMaster, outputBuffer);//send entire document
                flag_update_ui = false;
                wifi.updateClients(outputBuffer.c_str());
                lastPing = millis();
            //otherwise just send any changes
            }else if(deltaDoc.size()>0){
                serializeJson(deltaDoc, outputBuffer);
                wifi.updateClients(outputBuffer.c_str());
                lastPing = millis();
            //make sure at least on message is sent every 2 seconds
            }else if(millis()-lastPing >2000){
                debugln("♥");
                wifi.updateClients("{\"h\":1}");  // "h" for heartbeat
                lastPing = millis();
            }
        }
#endif
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

/**
 * @brief Main Arduino loop.
 * @note Not used because all code is handled via RTOS tasks. This function
 * simply deletes itself.
 */
void loop() {
    vTaskDelete(NULL);  ///< Delete this task.
}