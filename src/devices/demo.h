#include <device_base.h>

#include <module_brushed_motor.h>
Module_Brushed_Motor module_pump;

#include <module_led.h>
Module_Led module_led_status;

#include <modules/module_led.h>
Module_Led module_led_strip;

#include <module_time.h>
Module_Time module_time;

#include <modules/module_auto.h>
Module_Auto module_auto_led;

#include <modules/module_button_switch.h>
Module_Button_Switch module_switch_enable_touch;
Module_Button_Switch module_button_open_garage;
Module_Button_Switch module_button_close_garage;

#include <modules/module_pin_tester.h>
Module_Pin_Tester module_pin_tester;

#include <modules/module_text_io.h>
Module_Text_IO<float> module_text_input_gate_duration;

#include <modules/module_log.h>
Module_Log module_log;

// #include <ShiftRegister/ShiftRegisterDMA.h>
#include <modules/module_switch-slider.h>
Module_Text_IO<int> module_dma_pin;
Module_Switch_Slider module_dma_duty;

#include <modules/module_wifi.h>
Module_WiFi module_wifi;

//------------------------------Rotary Encoder----------------------------------//

#include <Rotary_Encoder/rotary.h>
#define PIN_ROTARY_A 11  ///< iBUS data in.
#define PIN_ROTARY_B 12  ///< Not required for iBUS (disabled).
#define PIN_ROTARY_S 13  ///< Button pin of encoder (sw)
rotary encoder_pump;

//#define RELEASE //Uncomment to disable debugging for release mode (Save device cycles by not printing to serial)

/** @brief Main setup area. Build and begin the modules here
 * @note setup is called before NVS is loaded. Modules requiring access to their stored values
 * such as the module_log should override the onBegin method
  */
class MyDevice : public DeviceBase {
   public:
    void setup_hardware() override;

    void loop1s() override {
        //debugfln("loop1s, switch:%d", *module_led_status.isOn);
    }
   private:
};
void MyDevice::setup_hardware(){

    module_pump
        .setId("pump")
        .setLabel("Water Pump")
        .setTab("home")
        .setPersist(true)
        .setPins(6)
        .setSafetyOffDuration_sec(30)
        .setFrequency(20000)
        .begin();

    encoder_pump
        .setPins(PIN_ROTARY_A, PIN_ROTARY_B, PIN_ROTARY_S)
       .setCallback([&](int s, int r) { module_pump.updateFromRotary(s, r); })
        .begin();

    module_led_status
        .setId("led_status")
        .setLabel("Status LED")
        .setTab("Home")
        .setPersist(true)
        .addHardware<WS2811Controller800Khz, 48, GRB>(1)
        .begin();

    // module_led_strip
    //     .setId("led_strip")
    //     .setLabel("LED")
    //     .setTab("Home")
    //     .setPersist(true)
    //     .addHardware<WS2811Controller800Khz, 7, GRB>(2)
    //     .begin();

    module_time
        .setId("time")
        .setLabel("Time")
        .setTab("home")
        .setPersist(true)
        .begin();

    module_auto_led
        .setId("auto_led")
        .setLabel("Auto LED")
        .setTab("Home")
        .setPersist(true)
        .setCallbacks([](){*module_led_status.isOn = true;}, [](){*module_led_status.isOn = false;})
        .setInitialTimes(timeToSec(8, 30), timeToSec(22, 45))
        .begin();

    // module_pin_tester
    //     .setId("pin_tester")
    //     .setLabel("Pin Tester")
    //     .setTab("settings")
    //     .setPin(128)
    //     .setPwmRange(2, 250000)
    //     .begin();

    module_switch_enable_touch
        .setId("enable_bts")
        .setLabel("Enable Touch Buttons")
        .setTab("Settings")
        .setPersist(true)
        .setLatching(true)
        .begin();

    module_button_open_garage
        .setId("btn_open_garage")
        .setLabel("Open Garage")
        .setTab("Home")
        .setPersist(false)
        .setPhysical(3, false)

        .onUpdate([]() {
            debugfln("Garage Opening");
        })
        .begin()
        .addSiriShortcut("Open Garage", "/garage/open", []() {
            debugfln("callback for /garage/open");
            module_log.add("Garage Opened");
        });

    module_button_close_garage
        .setId("btn_close_garage")
        .setLabel("Close Garage")
        .setTab("Home")
        .setPersist(false)
        // .setPhysical(2, false)
        .addInterlock(module_switch_enable_touch.on)
        .onUpdate([]() {
            debugfln("Garage Closing");
        })
        .begin()
        .addSiriShortcut("Close Garage", "/garage/close", []() { 
            debugfln("callback for /garage/close");
        });

    module_text_input_gate_duration
        .setId("gate_duration")
        .setLabel("Gate Open Duration")
        .setTab("Settings")
        .setAppend("sec")
        .setRange(5, 40)
        .setPrecision(1)
        .setPersist(true)
        .setValue(22.5)
        .begin();

    module_wifi
        .setId("wifi")
        .setLabel("WiFi Status")
        .setTab("Info")
        .setCredentials(WIFI_SSID, WIFI_PASSWORD, HOSTNAME)
        .begin();

    module_log
        .setId("log")
        .setLabel("Log")
        .setTab("info")
        .setLogBoot(true)
        .setPersist(true)
        .begin();
}