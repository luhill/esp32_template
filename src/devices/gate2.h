#include <helpers.h>
#include <secrets.h> //update your wifi ssid and pw in src/config/secrets.h
#include <Globals.h>

#define PIN_STATE_PRESSED HIGH //what state should output pin be in to simulate button is pressed down
#define PIN_OPEN 18
#define PIN_CLOSE 19
#define PIN_TOUCH_OPEN 13;
#define PIN_TOUCH_CLOSE 14;
#define PIN_TOUCH_PARTIAL_OPEN 12;
unsigned long DURATION_CLICK = 500; // Click duration in milliseconds
unsigned long DURATION_FULL_OPEN_SEC = 22; // Open duration in milliseconds
unsigned int DEFAULT_PARTIAL_OPEN_PERCENT = 15; // Partial open %
#define PIN_STATE_PRESSED HIGH //what state should output pin be in to simulate button is pressed down

#include <module_time.h>
    Module_Time module_time;

#include <modules/module_button_switch.h>
#include <modules/module_button_switch.h>
    Module_Button_Switch module_switch_enable_touch;
    Module_Button_Switch module_button_gate_open;
    Module_Button_Switch module_button_gate_crack;
    Module_Button_Switch module_button_gate_close;

#include <modules/module_text_io.h> 
    Module_Text_IO<int> module_text_input_gate_duration_full;

#include <modules/module_log.h>
    Module_Log module_log;

#include <modules/module_wifi.h>
    Module_WiFi module_wifi;


//------------------------------Base Timer------------------------------------------//
#define USE_ISR_TIMER


void onTimeSynced(){
    //refresh time on any module_time components i.e module_time.refreshSystemTime();
    module_time.refreshSystemTime();//
    //This is a good time to log a reboot reason if using logs (after a boot time is available)
    module_log.logRebootReason();
    //Update any module_auto components i.e. module_auto.updateTimers();
}

void emulate_open_pushed(){
  digitalWrite(PIN_OPEN, PIN_STATE_PRESSED);
  shared_isr_timer.setTimeout(DURATION_CLICK, [](){digitalWrite(PIN_OPEN,!PIN_STATE_PRESSED);} );
}
void emulate_close_pushed(){
  digitalWrite(PIN_CLOSE, PIN_STATE_PRESSED);
  shared_isr_timer.setTimeout(DURATION_CLICK, [](){digitalWrite(PIN_CLOSE,!PIN_STATE_PRESSED);} );
}
void openGate(){
    debugfln("Gate Opened");
    emulate_open_pushed();
}
void crackGate(unsigned int percent = DEFAULT_PARTIAL_OPEN_PERCENT){
    debugfln("Gate Cracked to %i%%",percent);
  //press open button, wait for open_duration then press again
  if(percent < 0 || percent > 100){percent = DEFAULT_PARTIAL_OPEN_PERCENT;}
  emulate_open_pushed();
  shared_isr_timer.setTimeout(DURATION_FULL_OPEN_SEC*percent/100, emulate_open_pushed);
}
void closeGate(){
    debugfln("Gate Close");
    emulate_close_pushed();
}
//------------------------------------------Setup methods-------------------------------------
void task_controls_update(void* parameter);
void setup_device(){
        //pinMode(PIN_OPEN, OUTPUT);
        //pinMode(PIN_CLOSE, OUTPUT);

        module_switch_enable_touch.setup();

        module_button_gate_open.setup(1,true,openGate,module_switch_enable_touch.on);
        module_button_gate_crack.setup(1,true,[](){crackGate(DEFAULT_PARTIAL_OPEN_PERCENT);},module_switch_enable_touch.on);
        module_button_gate_close.setup(1,true,closeGate,module_switch_enable_touch.on);

        module_button_gate_open.addSiriShortcut("Open Gate","/gate/open",openGate);
        module_button_gate_crack.addSiriShortcut("Crack Gate","/gate/crack",[](){crackGate(DEFAULT_PARTIAL_OPEN_PERCENT);});
        module_button_gate_close.addSiriShortcut("Close Gate","/gate/close",closeGate);

        module_text_input_gate_duration_full
            .setId("gate_duration_full")
            .setLabel("Gate Full Open Duration (s)")
            .setTab("settings")
            .setValue(DURATION_FULL_OPEN_SEC)
            .setPersist(true)
            .onUpdate([](int* v) { 
                debugfln("Gate full durations:%i",*v);
            })
            .begin()
            .addSiriShortcut("Gate Duration Full","/gate/duration/",[](){
                debugln("");
            });
        
        #ifdef HAS_TIME
        MyWiFi_socket::onTimeSynced = onTimeSynced;
        #endif

        module_wifi.setup(&wifi);
        module_log.setup();
}
