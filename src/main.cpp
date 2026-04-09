
#define STRINGIFY(x) #x
#define TOSTRING(x) STRINGIFY(x)

#ifdef PROJECT_HEADER
    #include TOSTRING(PROJECT_HEADER)
#endif


 #ifdef RELEASE
    #if DEBUGGING
    #undef DEBUGGING
    #define DEBUGGING false
    #endif
 #endif
/** @note no need to edit the main.cpp
 * use platformio.ini to add your device and link it to a header file
 * Add the device header file to the devices folder, then build / upload to your device by selecting your project in the project tasks on the platforio menu
 * Leave the class name in your header to MyDevice and you should not need to change this file 
 */
MyDevice device;

void setup() {
    #if DEBUGGING
    Serial.begin(115200);
    delay(200);  // delay to allow serial monitor to start before printing
    #endif
    debugln("===== Startup =====");
    device.begin();
}
/**
 * @brief Main Arduino loop.
 * @note Not used because all code is handled via RTOS tasks. This function
 * simply deletes itself.
 */
void loop() {
    vTaskDelete(NULL);  ///< Delete this task.
}