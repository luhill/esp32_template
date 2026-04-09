#include <device_base.h>

#include <ShiftRegister/pins_mks_tinybee.h>
#include <ShiftRegister/ShiftRegisterDMA.h>

#define PIN_PUMP_POWER          EXP1_01_PIN
#define PIN_PUMP2_POWER         EXP1_03_PIN
#define PIN_CHLORINE_DUTY_FWD   EXP1_04_PIN
#define PIN_CHLORINE_DUTY_REV   EXP1_05_PIN
#define PIN_ION_DUTY_FWD        EXP1_06_PIN
#define PIN_ION_DUTY_REV        EXP1_07_PIN
#define PIN_POWER_SUPPLY_ON     EXP1_08_PIN

#define PIN_ACID                HEATER_0_PIN
#define PIN_FLOC                HEATER_1_PIN
#define PIN_12V_PUMP            HEATER_BED_PIN
#define PIN_INPUT_ON_BTN_1      Y_STOP_PIN
#define PIN_INPUT_ON_BTN_2      Z_STOP_PIN

//#define PIN_LED_PUMP          FAN_PIN //The main power button led is just connected to the 12v supply.
#define PIN_LED_BOOSTER         FAN1_PIN
#define PIN_FAN_CASE            147// FAN_PIN
#define DUTY_FAN_CASE           225 //0-255
#define FREQ_FAN_CASE           10000UL
#define PIN_TEMP_OUTLET         TEMP_0_PIN
#define PIN_TEMP_INLET          TEMP_1_PIN
#define PIN_TEMP_BOX            TEMP_BED_PIN

static int FOUR_HOURS_SEC = 4*60*60;
static unsigned long FOUR_HOURS_MS = FOUR_HOURS_SEC*1000;
static volatile bool invert_chlorinator_ionizer = false;
static int ISR_TIMER_INVERT = -1;

#include <module_time.h>
Module_Time module_time;

#include <modules/module_auto.h>
Module_Auto module_auto_pump1;
Module_Auto module_auto_pump2;

#include <modules/module_button_switch.h>
Module_Button_Switch module_switch_pump1(false);
Module_Button_Switch module_switch_pump2(false);

#include <module_switch-slider.h>
Module_Switch_Slider module_pump_12v;
Module_Switch_Slider module_acid_doser;
Module_Switch_Slider module_floc_doser;

#include <modules/module_pool_hardware.h>
Module_Pool_Hardware module_chlorinator;
Module_Pool_Hardware module_ionizer;

#include <modules/module_analog_read.h>
Module_Analog_Read module_outlet_temp;
Module_Analog_Read module_inlet_temp;
Module_Analog_Read module_box_temp;

#include <modules/module_pin_tester.h>
Module_Pin_Tester module_pin_tester;

#include <modules/module_log.h>
Module_Log module_log;

#include <modules/module_wifi.h>
Module_WiFi module_wifi;

void hardwareOff() {
    dWrite(PIN_PUMP_POWER, LOW);
    dWrite(PIN_PUMP2_POWER, LOW);
    dWrite(PIN_LED_BOOSTER, LOW);
    dWrite(PIN_CHLORINE_DUTY_FWD, LOW);
    dWrite(PIN_CHLORINE_DUTY_REV, LOW);
    dWrite(PIN_ION_DUTY_FWD, LOW);
    dWrite(PIN_ION_DUTY_REV, LOW);
    dWrite(PIN_12V_PUMP, LOW);
    dWrite(PIN_FAN_CASE, LOW);
    dWrite(PIN_ACID, LOW);
    dWrite(PIN_FLOC, LOW);
    dWrite(PIN_POWER_SUPPLY_ON, LOW);
}
/** @brief Called when the physical button is pressed or from the web
 * @note this is executed outside of the interrupt
*/
void powerOff(){
    *module_switch_pump1.on = false;
    *module_switch_pump2.on = false;
    //*module_chlorinator.on = false;
    *module_ionizer.on = false;

    dWrite(PIN_PUMP_POWER, LOW);
    dWrite(PIN_PUMP2_POWER, LOW);
    dWrite(PIN_LED_BOOSTER, LOW);
    dWrite(PIN_ACID, LOW);
    dWrite(PIN_FLOC, LOW);
    //setChlorinator();
    //setIonizer();

    //some items might remain on if the 12v pump is being used
    bool psuOn = *module_pump_12v.on;
    dWrite(PIN_POWER_SUPPLY_ON, psuOn); //leave the psu on
    //dWrite(PIN_FAN_CASE, psuOn);      //probably dont need the case fan for just the 12v pump
}
void pump1_power_toggled() {
    if(*module_switch_pump1.on){//if on, turn the pump on
         dWrite(PIN_PUMP_POWER, HIGH);//turn on the pump
         dWrite(PIN_POWER_SUPPLY_ON, HIGH);// turn on the 12v supply
         aWrite(PIN_FAN_CASE, DUTY_FAN_CASE);//turn on the case fan
    }else{//Turn it all off
        powerOff();
    }
}
//pump2 handles its own interlocks
void pump2_power_toggled() {
    dWrite(PIN_PUMP2_POWER, *module_switch_pump2.on ? HIGH : LOW);
    dWrite(PIN_LED_BOOSTER, *module_switch_pump2.on ? HIGH : LOW);
}
void pump12v_power_toggled() {
    bool psuOn = *module_pump_12v.on || *module_switch_pump1.on;
    dWrite(PIN_POWER_SUPPLY_ON, psuOn);
    dWrite(PIN_12V_PUMP, *module_pump_12v.on? HIGH : LOW);
    //Fan only stays on if the main pump is on
    aWrite(PIN_FAN_CASE, *module_switch_pump1.on? DUTY_FAN_CASE : 0);
}
void acid_power_toggled() {
    dWrite(PIN_ACID, *module_acid_doser.on ? HIGH : LOW);
}
void floc_power_toggled() {
    dWrite(PIN_FLOC, *module_floc_doser.on ? HIGH : LOW);
}
/** @brief If auto is enabled this timer based event is triggered 
 * @note this is executed outside of the interrupt
*/
void pump1_auto_start() {
    //Turn on the pump, chorinator and ionizer
    *module_switch_pump1.on = true;
    *module_chlorinator.on = true;
    *module_ionizer.on = true;
}
/** @brief If auto is enabled this timer based event is triggered 
 * @note this is executed outside of the interrupt
*/
void pump1_auto_stop(){
    powerOff();
}
/** @brief pump2 should only be turned on if pump1 is running */
void pump2_auto_start(){
    //turn pump2 on only if pump1 is on
    if(*module_switch_pump1.on){
        *module_switch_pump2.on = true;
        dWrite(PIN_PUMP2_POWER, HIGH);
    }else{
        //Cannot be used without pump 1 being on
        *module_switch_pump2.on = false;
    }
}
void pump2_auto_stop(){
     *module_switch_pump2.on = false;
     dWrite(PIN_PUMP2_POWER, LOW);
}


/** @brief The chlorinator and ionizer swap polarites periodically to stay clean and wear evenly
 * default to invert halfway through the auto duration, or every four hours
 */
void setInversionTime(){
    if(!*module_auto_pump1.on)return;
    int invertTime = module_auto_pump1.onDurationSec()/2;
    if(invertTime){
        module_chlorinator.setInvertTime(invertTime);
        module_ionizer.setInvertTime(invertTime);
    }
}

//#define RELEASE //Uncomment to disable debugging for release mode (Save device cycles by not printing to serial)

/** @brief Main setup area. Build and begin the modules here
 * @note setup is called before NVS is loaded. Modules requiring access to their stored values
 * such as the module_log should override the onBegin method
  */
 class MyDevice : public DeviceBase {
   public:
    void makeSafe() override{
        hardwareOff();
    }
    void setup_hardware() override;

    void loop1s() override {}
    void onSettingsLoaded() override{
        setInversionTime();
    }
   private:
};
void MyDevice::setup_hardware(){
    initShiftRegisterDMA(I2S_BCK, I2S_WS, I2S_DATA);//start the shift register with the MKS Tinybee i2s pins
    DeviceBase::hExternalTask = handle_dma;
    //----------------Home Tab------------------------------------
    module_switch_pump1
        .setId("pump1_power")
        .setLabel("Pump")
        .setTab("home")
        .setLatching(true)
        .setPhysical(PIN_INPUT_ON_BTN_1, false)
        .onUpdate(pump1_power_toggled)
        .begin()
        .addSiriShortcut("Turn Pump On", "/pump1/on", []() {
            /** @todo logic to set pump state and switch off */
            debugfln("callback for /pump1/on");
        })
        .addSiriShortcut("Turn Pump Off", "/pump1/off", []() {
            /** @todo logic to set pump state and switch off */
            debugfln("callback for /pump1/off");
        });

    module_switch_pump2
        .setId("pump2_power")
        .setLabel("Heater")
        .setTab("home")
        .setLatching(true)
        .setPhysical(PIN_INPUT_ON_BTN_2, false)
        .onUpdate(pump2_power_toggled)
        .addInterlock(module_switch_pump1.on)//pump2 (booster) requires pump 1 to be running
        .begin()
        .addSiriShortcut("Turn Heater On", "/pump2/on", []() {
            /** @todo logic to set pump state and switch off */
            debugfln("callback for /pump2/on");
        })
        .addSiriShortcut("Turn Heater Off", "/pump2/off", []() {
            /** @todo logic to set pump state and switch off */
            debugfln("callback for /pump2/off");
        });

    module_chlorinator
        .setId("chlorinator")
        .setLabel("Chlorine")
        .setTab("home")
        .setPersist(true)
        .setPins(PIN_CHLORINE_DUTY_FWD, PIN_CHLORINE_DUTY_REV)
        /** @warning Make sure to add interlock before deploying */
        //.addInterlock(module_switch_pump1.on) 
        .setInvertTime(30)  // 14400 = 4 hours
        .setPWMCycleTime(10)
        .begin();

    module_ionizer
        .setId("ionizer")
        .setLabel("Ionizer")
        .setTab("home")
        .setPersist(true)
        .setPins(PIN_ION_DUTY_FWD, PIN_ION_DUTY_REV)
        /** @warning Make sure to add interlock before deploying */
        //.addInterlock(module_switch_pump1.on)
        .setInvertTime(30)  // 600 = 10 min
        .setPWMCycleTime(10)
        .begin();
    
    module_outlet_temp
        .setId("outlet_temp")
        .setLabel("Outlet Temp")
        .setTab("home")
        .setAppend("C")
        .setPrecision(2)
        .setSmoothing(0.05)
        .setVRef(2601)//Unplug thermistor and look at console for this value, or measure the pins manually
        .setPin(PIN_TEMP_OUTLET)
        .begin();
    
    module_inlet_temp
        .setId("inlet_temp")
        .setLabel("Inlet Temp")
        .setTab("home")
        .setAppend("C")
        .setPrecision(2)
        .setSmoothing(0.05)
        .setVRef(2601)//Unplug thermistor and look at console for this value, or measure the pins manually
        .setPin(PIN_TEMP_INLET)
        .begin();
    
    module_box_temp
        .setId("case_temp")
        .setLabel("Enclosure Temp")
        .setTab("home")
        .setAppend("C")
        .setPrecision(2)
        .setSmoothing(0.05)
        .setVRef(2601)//Unplug thermistor and look at console for this value, or measure the pins manually
        .setPin(PIN_TEMP_BOX)
        .begin();

    //---------------Settings tab----------
    module_time
        .setId("time")
        .setLabel("Time")
        .setTab("settings")
        .setPersist(true)
        .begin();

    module_auto_pump1
        .setId("auto_pump")
        .setLabel("Pump Schedule")
        .setTab("settings")
        .setPersist(true)
        .setCallbacks(pump1_auto_start, pump1_auto_stop)
        .onUpdate(setInversionTime)
        .setInitialTimes(timeToSec(8, 30), timeToSec(22, 45))
        .begin();
    
    module_auto_pump2
        .setId("auto_heater")
        .setLabel("Heater Schedule")
        .setTab("settings")
        .setPersist(true)
        .setCallbacks(pump2_auto_start, pump2_auto_stop)
        .setInitialTimes(timeToSec(8, 30), timeToSec(22, 45))
        .begin();
    
    module_pump_12v
        .setId("pump12v_power")
        .setLabel("Fill Pump")
        .setTab("settings")
        .onUpdate(pump12v_power_toggled)
        .makeTimer(3600)  // units in hours
        .setRange(0, 8)
        .setStep(0.5)
        .setAppend("hrs")
        .begin();

    module_acid_doser
        .setId("acid_doser")
        .setLabel("Acid Doser")
        .setTab("settings")
        .onUpdate(acid_power_toggled)
        .makeTimer(60)//units in min
        .setRange(0,10)
        .setStep(0.5)
        .setAppend("min")
        .addInterlock(module_switch_pump1.on)
        .begin();
    
    module_floc_doser
        .setId("floc_doser")
        .setLabel("Floc Doser")
        .setTab("settings")
        .onUpdate(floc_power_toggled)
        .makeTimer(60)//units in min
        .setRange(0,10)
        .setStep(0.5)
        .setAppend("min")
        .addInterlock(module_switch_pump1.on)
        .begin();

    module_pin_tester
        .setId("pin_tester")
        .setLabel("Pin Tester")
        .setTab("settings")
        .setPin(128)
        .setPwmRange(2, 250000)
        .begin();
    
    //------------------Info Tab---------------------
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