#include <device_base.h>

#include <module_brushed_motor.h>
Module_Brushed_Motor module_pump;

#include <module_led.h>
Module_Led module_led_strip;
#define PIN_LED_STRIP_DATA 7

#include <modules/module_wifi.h>
Module_WiFi module_wifi;

#include <modules/module_switch-slider.h>
Module_Switch_Slider module_auto_off;

//------------------------------Rotary Encoder----------------------------------//
#include <Rotary_Encoder/rotary.h>
#define PIN_ROTARY_A 11  ///< iBUS data in.
#define PIN_ROTARY_B 12  ///< Not required for iBUS (disabled).
#define PIN_ROTARY_S 13  ///< Button pin of encoder (sw)
rotary encoder_pump;

#define RELEASE //Uncomment to disable debugging for release mode (Save device cycles by not printing to serial)

void setPumpAutoOff(){
    uint32_t off_sec = *module_auto_off.on ? *module_auto_off.sliderValue : -1;
    module_pump.setSafetyOffDuration_sec(off_sec);
}

/** @brief Main setup area. Build and begin the modules here
 * @note setup is called before NVS is loaded. Modules requiring access to their stored values
 * such as the module_log should override the onBegin method
  */
class MyDevice : public DeviceBase {
   public:
    void setup_hardware() override;

    //void loop1s() override {}

    void onSettingsLoaded() override {setPumpAutoOff();}
   private:
};
void MyDevice::setup_hardware(){
    /*-------------------------Home Tab-----------------------*/
    module_pump
        .setId("pump")
        .setLabel("Water Pump")
        .setTab("home")
        .setPersist(true)
        .setPins(6)
        .setFrequency(20000)
        .begin();

    encoder_pump
        .setPins(PIN_ROTARY_A, PIN_ROTARY_B, PIN_ROTARY_S)
        .setCallback([&](int s, int r) { module_pump.updateFromRotary(s, r); })
        .begin();

    module_led_strip
        .setId("tank_leds")
        .setLabel("LED")
        .setTab("Home")
        .setPersist(true)
        .addHardware<WS2811Controller800Khz, PIN_LED_STRIP_DATA, GRB>(2)
        .begin();
    /*---------------------Settings Tab-----------------------*/
    module_auto_off
        .setId("auto_off")
        .setLabel("Auto Off")
        .setTab("settings")
        .setPersist(true)
        .setSwitchValue(true)
        .setSliderValue(10)
        .setRange(5,30)
        .setAppend("sec")
        .onUpdate([](){setPumpAutoOff();})
        .begin();
    /*-------------------------Info Tab-----------------------*/
    module_wifi
        .setId("wifi")
        .setLabel("WiFi Status")
        .setTab("Info")
        .setCredentials(WIFI_SSID, WIFI_PASSWORD, HOSTNAME)
        .begin();
}