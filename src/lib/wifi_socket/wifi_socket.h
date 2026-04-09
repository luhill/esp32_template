#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <esp_sntp.h>
#include <functional>

// Clean type aliases for the Module-to-Socket bridge
using JSONProcessor = String (*)(char*);
using RequestCallback = std::function<void(AsyncWebServerRequest*)>;
using SimpleCallback = std::function<void(void)>;
using OnTimeSync = std::function<void(void)>;

class wifi_socket {
public:
    /**
     * @brief Constructor
     * @param processor The static function from Module_WiFi that handles JSON routing
     */
    wifi_socket(JSONProcessor processor, 
                const char* hostname = "hostname", 
                const char* ssid = "ssid", 
                const char* password = "password",
                bool createAPOnFailure = false);

    // --- Core Lifecycle ---
    void start();
    void reconnect();
    bool isConnected();
    void startMDNS();
    // --- Web & UI Services ---
    void updateClients(const char* msg);
    void on(const char* uri, RequestCallback callback);
    void on(const char* uri, SimpleCallback callback);

    // --- Status Getters ---
    int8_t getRSSI();
    String getIPAddress();
    bool hasActiveClients();
    bool mdnsStarted = false;
    // --- System Callbacks ---
    static OnTimeSync onTimeSynced;

private:
    // Members moved from global scope for encapsulation
    AsyncWebServer _server;
    AsyncWebSocket _ws;
    JSONProcessor _processor;

    // Configuration
    const char* _hostname;
    const char* _ssid;
    const char* _password;
    bool _createAP;

    // --- Internal Handlers (Now Private Members) ---
    void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, 
                   AwsEventType type, void* arg, uint8_t* data, size_t len);
    
    void handleUpdateResponse(AsyncWebServerRequest *request);
    void handleUpdateBody(AsyncWebServerRequest *request, uint8_t *data, 
                          size_t len, size_t index, size_t total);
    
    void syncTimeWithNTP();
};