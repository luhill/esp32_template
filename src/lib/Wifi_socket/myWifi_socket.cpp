#include "myWifi_socket.h"

#include <AsyncTCP.h>
#include <ESPmDNS.h>  //for .local domain name support
#include <Update.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <time.h>
#include <sys/time.h>
#include <esp_sntp.h>
#include <helpers.h>

#include "ESPAsyncWebServer.h"

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

void initWebSocket();

String (*updateHost)(char*);
OnTimeSync MyWiFi_socket::onTimeSynced = nullptr;

MyWiFi_socket::MyWiFi_socket(String (*reply)(char*),
                             const char* hostname,
                             const char* ssid,
                             const char* password,
                             const bool create_network_on_failed_connection //flag to create access point if wifi connection fails
                             )
    : hostname_(hostname), ssid_(ssid), password_(password), create_network_on_failed_connection_(create_network_on_failed_connection) {

    updateHost = reply;
}

void MyWiFi_socket::start_wifi() {
    // LittleFS stores the webpage files, so we need to initialize it before starting the server
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS Mount Failed");
        return;
    }

    debugln("Starting WiFi...");
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();  // disconnect from any previous connection
    WiFi.begin(ssid_, password_);

    // Wait for connection
    // Try to connect for 5 seconds
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
        delay(100);
        debug(".");
    }
    if (WiFi.status() != WL_CONNECTED) {
        if (!create_network_on_failed_connection_) {//
            debugln("\nFailed to connect to WiFi. To enable access point change settings.");
            return;
        } else {
            debugln("\nFailed to connect. Creating Access Point...");
            WiFi.disconnect();
            WiFi.mode(WIFI_AP);

            // Create AP with hostname as SSID
            if (WiFi.softAP(hostname_,
                            "12345678")) {  // Default password: 12345678
                debugln("AP Created successfully");
                debugfln("AP SSID: %s", hostname_);
                debugfln("AP IP address: %s",ipAddess().c_str());
            } else {
                debugln("AP Creation failed!");
                return;
            }
        }
    } else {
        debugln("\nConnected to WiFi!");
        debugfln("Connected to %s, IP: %s", ssid_, ipAddess().c_str());
        
        // Start asynchronous time synchronization
        syncTimeWithNTP();//Fetch the current date and time
    }
    
    // server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *request){
    //     request->send(LittleFS, "/favicon.ico", "image/x-icon");
    // });

    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
    //server.serveStatic("/local", LittleFS, "/").setDefaultFile("index.html");
    // 2. Add the "Catch-All" handler for React Router
    server.onNotFound([](AsyncWebServerRequest *request){
        // If the browser asks for a page that doesn't exist, 
        // send them index.html so React can take over.
        request->send(LittleFS, "/index.html", "text/html");
    });
    server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "text/plain", "OK");
    });
    server.on("/test", HTTP_GET, [&](AsyncWebServerRequest* request) {
        if(request->hasParam("value",true)){
          auto on = request->getParam("value")->value();
          request->send(200, "text/plain", "test value: " + String(on));
        }
        request->send(200, "text/plain", "hello from test");
    });

    server.on("/do-update", HTTP_POST, MyWiFi_socket::handleUpdateResponse, NULL, MyWiFi_socket::handleUpdateBody);

    // ElegantOTA.begin(&server);  // Start ElegantOTA
    // // ElegantOTA callbacks
    // ElegantOTA.onStart(onOTAStart);
    // ElegantOTA.onProgress(onOTAProgress);
    // ElegantOTA.onEnd(onOTAEnd);

    if (!MDNS.begin(hostname_)) {
        debugln("Error setting up MDNS responder!");
    }else{
      debugfln("host:%s.local",hostname_);
    }
    MDNS.addService("http", "tcp", 80);

    initWebSocket();
    server.begin();
    debugln("HTTP server started");
}

void MyWiFi_socket::on(const char* uri, RequestCallback callback) {
    server.on(uri, HTTP_GET, [callback](AsyncWebServerRequest* request) {
        callback(request);
    });
}

// Version B: Simple (Library handles the "OK" response)
void MyWiFi_socket::on(const char* uri, SimpleCallback callback) {
    server.on(uri, HTTP_GET, [callback](AsyncWebServerRequest* request) {
        request->send(204);//send 204 (No Content)
        if(callback) callback();
    });
}

String MyWiFi_socket::ipAddess(){
    if(WiFi.getMode() == WIFI_STA){
        return WiFi.localIP().toString();
    }
    if(WiFi.getMode() == WIFI_AP){
        return WiFi.softAPIP().toString();
    }
    return "unknown";
}
/*-----------------------------Update OTA----------------------------------------------------*/
void MyWiFi_socket::handleUpdateResponse(AsyncWebServerRequest *request) {
    // Check if the update actually happened AND finished without error
    debugln("Inside: handleUpdateResponse");
    if (!Update.hasError() && Update.isFinished()) {
        // 1. Send the HTTP "OK" first. This triggers xhr.onload in React.
        request->send(200, "text/plain", "OK");

        // 2. Start a background task to handle the "Cleanup and Kill"
        xTaskCreate([](void*){
            // A. Wait 1 second for the HTTP "OK" to clear the buffer
            vTaskDelay(pdMS_TO_TICKS(1000)); 
            
            // B. Explicitly notify and close WebSockets
            // This triggers 'onclose' in React instantly
            ws.textAll("{\"status\":\"rebooting\"}");
            ws.closeAll();
            
            // C. Wait another second for the WS packets to clear
            vTaskDelay(pdMS_TO_TICKS(1000)); 

            debugln("Rebooting now...");
            ESP.restart();
        }, "reboot_task", 2048, NULL, 1, NULL);
    } else {
        request->send(500, "text/plain", "Update Failed or Never Started");
    }
}

void MyWiFi_socket::handleUpdateBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    // 1. Initialise on the first chunk
    //debugln("inside handleUpdateBody");
    if (index == 0) {
        int command = (request->hasHeader("X-File-Type") && request->getHeader("X-File-Type")->value() == "fs") 
                      ? U_SPIFFS : U_FLASH;

        debugfln("Update Started. Total Size: %u", total);
        if (!Update.begin(total, command)) {
            Update.printError(Serial);
        }
    }

    // 2. Write chunk
    if (Update.write(data, len) != len) {
        Update.printError(Serial);
    } else {
        // Progress Logic
        size_t currentProgress = index + len;
        int percent = (currentProgress * 100) / total;
        static int lastPercent = -1;
        if (percent % 5 == 0 && percent != lastPercent) {
            debugfln("Progress: %d%%", percent);
            lastPercent = percent;
        }
    }

    // 3. Finalize
    if (index + len == total) {
        if (!Update.end(true)) {
            Update.printError(Serial);
        } else {
            debugln("Update Complete!");
        }
    }
}
/*--------------------------Wifi Status------------------------------------------*/

int8_t MyWiFi_socket::signalStrength(){
    return WiFi.RSSI();
}
bool MyWiFi_socket::hasActiveClient(){
    return ws.count() > 0;
}

/*-----------------------------websocket---------------------------------------*/

void MyWiFi_socket::updateClients(const char* msg){
    ws.textAll(msg);
}
void handleWebSocketMessage(void* arg, uint8_t* data, size_t len) {
    AwsFrameInfo* info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len &&
        info->opcode == WS_TEXT) {
        data[len] = 0;
        debugln((char*)data);
        String response = updateHost((char*)data);//Websocket messages and commands are processed by the host
        // Broadcast the response (delta) to all connected clients so all tabs stay in sync
        if (response.length() > 0) {
            ws.textAll(response.c_str());
        }
    }
}

void onEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
             AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT: {
            Serial.printf("WebSocket client #%u connected from %s\n",
                          client->id(), client->remoteIP().toString().c_str());
            ws.textAll(updateHost(nullptr));//After connection the host is notified and responds with a json that the browser uses to build the UI
        } break;
        case WS_EVT_DISCONNECT:
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA:{
            handleWebSocketMessage(arg, data, len);
        }break;
        case WS_EVT_PONG:{
            debugln("WS_EVT_PONG");
        }break;
        case WS_EVT_ERROR:{
            debugln("WS_EVT_ERROR");
        }
        break;
    }
}

void initWebSocket() {
    ws.onEvent(onEvent);
    server.addHandler(&ws);
}

/*--------------------------Time Synchronization------------------------------------------*/

void MyWiFi_socket::onTimeSyncCallback(struct timeval *tv) {
    MyWiFi_socket::onTimeSynced();
}

void MyWiFi_socket::syncTimeWithNTP() {
    if(MyWiFi_socket::onTimeSynced){
        debugln("Starting asynchronous NTP time synchronization...");
        // Configure SNTP with callback
        configTime(10*60*60, 0,"time.google.com","au.pool.ntp.org","pool.ntp.org");//brisbane time 10hrs ahead , 0 daylight saving
        // Set callback to be invoked when time is synchronized
        sntp_set_time_sync_notification_cb((sntp_sync_time_cb_t)onTimeSyncCallback);
    }else{
        debugln("Skipping time sync. No registered callback");
    }
}

// Connection helper implementations
bool MyWiFi_socket::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void MyWiFi_socket::reconnect() {
    debugln("Wifi not connected. Attempting reconnect...");
    start_wifi();
}

