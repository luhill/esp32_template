#include "wifi_socket.h"
#include <LittleFS.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <helpers.h>
// Initialize the static callback pointer
OnTimeSync wifi_socket::onTimeSynced = nullptr;

wifi_socket::wifi_socket(JSONProcessor processor, const char* hostname, const char* ssid, const char* password, bool createAP)
    : _server(80), _ws("/ws"), _processor(processor), 
      _hostname(hostname), _ssid(ssid), _password(password), _createAP(createAP) {
}

void wifi_socket::start() {
    if (!LittleFS.begin(true)) {
        debugln("LittleFS Mount Failed");
        return;
    }

    WiFi.mode(WIFI_STA);
    WiFi.hostname(_hostname);
    WiFi.begin(_ssid, _password);

    // 5-second connection attempt
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
        delay(100);
        debug(".");
    }

    if (WiFi.status() != WL_CONNECTED) {
        if (!_createAP) {
            debugln("\nWiFi Failed. AP Disabled.");
            return;
        } 
        debugln("\nCreating Access Point...");
        WiFi.mode(WIFI_AP);
        WiFi.softAP(_hostname, "12345678");
    } else {
        debugfln("\nConnected! IP: %s", getIPAddress().c_str());
        syncTimeWithNTP();
    }

    
    
    _server.onNotFound([](AsyncWebServerRequest *request){
        request->send(LittleFS, "/index.html", "text/html");
    });

    // --- CUSTOM HANDLERS ---
    _server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "text/plain", "OK");
    });

    // --- CORS SETUP ---
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type, X-File-Type");

    // --- OTA UPDATE ---
    _server.on("/do-update", HTTP_POST, 
        [this](AsyncWebServerRequest *request) { this->handleUpdateResponse(request); }, 
        NULL, 
        [this](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            this->handleUpdateBody(request, data, len, index, total);
        }
    );

    // --- STATIC FILES & REACT ROUTER ---
    _server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
    // --- WEBSOCKET SETUP ---
    _ws.onEvent([this](AsyncWebSocket* s, AsyncWebSocketClient* c, AwsEventType t, void* a, uint8_t* d, size_t l) {
        this->onWsEvent(s, c, t, a, d, l);
    });
    _server.addHandler(&_ws);

    // --- MDNS ---
    startMDNS();

    _server.begin();
}
void wifi_socket::startMDNS() {
    if (MDNS.begin(_hostname)) {
        MDNS.addService("http", "tcp", 80);
        debugfln("mDNS: http://%s.local", _hostname);
    }
    mdnsStarted = true;
}
// --- WEBSOCKET LOGIC ---

void wifi_socket::onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
                          AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            // Send initial state on connect
            debugfln("WebSocket client #%u connected from %s\n",client->id(), client->remoteIP().toString().c_str());
            if (_processor) client->text(_processor(nullptr));
            break;
         case WS_EVT_DISCONNECT:
            debugfln("WebSocket client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA: {
            AwsFrameInfo* info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                data[len] = 0;
                if (_processor) {
                    String response = _processor((char*)data);
                    if (response.length() > 0) _ws.textAll(response);
                }
            }
        } break;
        case WS_EVT_PONG:{
            debugln("WS_EVT_PONG");
        }break;
        case WS_EVT_ERROR:{
            debugln("WS_EVT_ERROR");
        }
        default: break;
    }
}

void wifi_socket::updateClients(const char* msg) {
    _ws.textAll(msg);
}

// --- API OVERLOADS ---

void wifi_socket::on(const char* uri, SimpleCallback callback) {
    _server.on(uri, HTTP_GET, [callback](AsyncWebServerRequest* request) {
        request->send(204); 
        if(callback) callback();
    });
}

// 1. Ensure the prefix is present and the arguments match the header
void wifi_socket::handleUpdateResponse(AsyncWebServerRequest *request) {
    if (!Update.hasError() && Update.isFinished()) {
        request->send(200, "text/plain", "OK");

        xTaskCreate([](void*){
            vTaskDelay(pdMS_TO_TICKS(1000)); 
            // Note: Since this is a static task, you'll need a way to access 'ws' 
            // if it's no longer global. For now, let's focus on the linker error.
            ESP.restart();
        }, "reboot_task", 2048, NULL, 1, NULL);
    } else {
        request->send(500, "text/plain", "Update Failed");
    }
}

// 2. Ensure the types (uint8_t*, size_t) match the header exactly
void wifi_socket::handleUpdateBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    if (index == 0) {
        int command = (request->hasHeader("X-File-Type") && request->getHeader("X-File-Type")->value() == "fs") 
                      ? U_SPIFFS : U_FLASH;
        if (!Update.begin(total, command)) {
            Update.printError(Serial);
        }
    }

    if (Update.write(data, len) != len) {
        Update.printError(Serial);
    }

    if (index + len == total) {
        if (!Update.end(true)) {
            Update.printError(Serial);
        }
    }
}
// --- TIME & HELPERS ---

void wifi_socket::syncTimeWithNTP() {
    // 10*60*60 = Brisbane/AEST. Consider making this configurable later!
    configTime(10 * 3600, 0, "time.google.com", "au.pool.ntp.org");
    sntp_set_time_sync_notification_cb([](struct timeval *tv) {
        if (wifi_socket::onTimeSynced) wifi_socket::onTimeSynced();
    });
}

void wifi_socket::reconnect() {
    mdnsStarted = false; // Force mDNS to restart on next successful connection
    // 1. Check if we are already connected or in the process of connecting
    wl_status_t status = WiFi.status();
    
    if (status == WL_CONNECTED) {
        return; // Already good!
    }

    // 2. If we are currently "IDLE" or "DISCONNECTED", trigger a fresh start
    // We use a static timestamp to prevent "spamming" the router
    static uint32_t lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt < 10000) {
        return; // Don't try more than once every 10 seconds
    }
    lastReconnectAttempt = millis();

    debugln("WiFi: Connection lost. Attempting background reconnect...");

    // 3. Instead of a full start(), just trigger the STA reconnect
    if (WiFi.getMode() == WIFI_STA) {
        WiFi.disconnect(); 
        WiFi.begin(_ssid, _password);
    } else if (WiFi.getMode() == WIFI_AP) {
        // If we are in AP mode, we usually don't "reconnect" 
        // unless you want to try switching back to Station mode.
        debugln("WiFi: Device is currently in Access Point mode.");
    }
}

String wifi_socket::getIPAddress() {
    return (WiFi.getMode() == WIFI_AP) ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
}

int8_t wifi_socket::getRSSI() { return WiFi.RSSI(); }
bool wifi_socket::isConnected() { return WiFi.status() == WL_CONNECTED; }
bool wifi_socket::hasActiveClients() { return _ws.count() > 0; }
