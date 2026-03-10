#pragma once
#include "ESPAsyncWebServer.h"

//#include "app_config.h"
typedef void (*OnTimeSync)();
typedef std::function<void(AsyncWebServerRequest*)> RequestCallback;
typedef std::function<void(void)> SimpleCallback;

class MyWiFi_socket {
   public:
    MyWiFi_socket() = default;
    MyWiFi_socket(String (*reply)(char*),
                  const char* hostname = "bidet",
                  const char* ssid = "glitchy",
                  const char* password = "298Seven",
                  const bool create_network_on_failed_connection = false
                  );
    
    void start_wifi();

    void updateClients(const char* msg);
    // Check if currently connected to WiFi
    bool isConnected();
    // Attempt to reconnect to the configured WiFi network
    void reconnect();
    int8_t signalStrength();//return the rssi
    String ipAddess();//return the string ipAddress
    bool hasActiveClient(); //return how many websozket clients there are
    static OnTimeSync onTimeSynced;//register to this function for time sync callback
    
    static void handleUpdateResponse(AsyncWebServerRequest *request);

    static void handleUpdateBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total);

    // Version A: Full control (User handles the request/response)
    void on(const char* uri, RequestCallback callback);

    // Version B: Simple (Library handles the "OK" response)
    void on(const char* uri, SimpleCallback callback);
   private:

    const char* hostname_;
    const char* ssid_;
    const char* password_;
    const bool create_network_on_failed_connection_;
    
    //volatile bool wifi_connected = false;

    // Time synchronization
    //static char* getTimeString();
    void syncTimeWithNTP();
    static void onTimeSyncCallback(struct timeval *tv);
};
