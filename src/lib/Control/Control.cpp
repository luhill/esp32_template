#include "Control.h"

extern JsonDocument jsonMaster;

JsonObject MultiControl::getTarget(JsonObject root, const char* fullKey, const char** outKey) {
    String k(fullKey);
    int dot = k.indexOf('.');
    if (dot != -1) {
        String folder = k.substring(0, dot);
        *outKey = fullKey + dot + 1;
        return root[folder].is<JsonObject>() ? root[folder].as<JsonObject>() : root[folder].to<JsonObject>();
    }
    *outKey = fullKey;
    return root;
}

bool SubValue::changed() {
    if (type == VT_INT) return val.i != lastI;
    if (type == VT_BOOL) return val.b != lastB;
    if (type == VT_FLOAT) return abs(val.f - lastF) > 0.001f;
    if (type == VT_STRING) return s != lastS;
    return false;
}

void SubValue::updateLast() {
    lastI = val.i; lastB = val.b; lastF = val.f; lastS = s;
}

MultiControl::MultiControl(const char* _group, const char* _id, const char* _type, const char* _name) {
    group = _group; id = _id; type = _type; name = _name;
    values.reserve(12);
}

// void MultiControl::markDirty() {
//     isDirty = true;
//     lastChangeTime = millis();
// }

void MultiControl::addValue(const char* k, int i, bool p) { values.push_back({k, VT_INT, {.i=i}, "", i, false, 0.0f, "", p}); }
void MultiControl::addValue(const char* k, bool b, bool p) { values.push_back({k, VT_BOOL, {.b=b}, "", 0, b, 0.0f, "", p}); }
void MultiControl::addValue(const char* k, float f, bool p) { values.push_back({k, VT_FLOAT, {.f=f}, "", 0, false, f, "", p}); }
void MultiControl::addValue(const char* k, String s, bool p) { values.push_back({k, VT_STRING, {0}, s, 0, false, 0.0f, s, p}); }
void MultiControl::addValue(const char* k, const char* s, bool p){
    if(s == nullptr){
        addValue(k, String("error:set to nullptr"),p);
    }else{
        addValue(k,String(s),p);//convert to string
    }
}

void MultiControl::build(JsonObject root) {
    JsonObject ctrl = root[group][id].to<JsonObject>();
    ctrl["type"] = type; ctrl["name"] = name;
    if (metadata.is<JsonObject>()) {
        for (JsonPair kv : metadata.as<JsonObject>()) ctrl[kv.key()] = kv.value();
    }
    JsonObject valObj = ctrl["value"].to<JsonObject>();
    for (auto& v : values) {
        const char* k; JsonObject t = getTarget(valObj, v.key, &k);
        if (v.type == VT_INT) t[k] = v.val.i;
        else if (v.type == VT_BOOL) t[k] = v.val.b;
        else if (v.type == VT_FLOAT) t[k] = v.val.f;
        else if (v.type == VT_STRING) t[k] = v.s;
    }
}

void MultiControl::sync(JsonObject delta) {
    bool first = true;
    for (auto& v : values) {
        if (v.changed()) {
            v.updateLast();
            if (first) { delta[id].to<JsonObject>(); first = false; }
            const char* k;
            JsonObject mT = getTarget(jsonMaster[group][id]["value"].as<JsonObject>(), v.key, &k);
            JsonObject dT = getTarget(delta[id].as<JsonObject>(), v.key, &k);
            if (v.type == VT_INT) { mT[k] = v.val.i; dT[k] = v.val.i; }
            else if (v.type == VT_BOOL) { mT[k] = v.val.b; dT[k] = v.val.b; }
            else if (v.type == VT_FLOAT) { mT[k] = v.val.f; dT[k] = v.val.f; }
            else if (v.type == VT_STRING) { mT[k] = v.s; dT[k] = v.s; }
            markDirtyIfPersistent(v); // If changed via pointer, only mark dirty for persistent values
        }
    }
}
template <typename T>
void MultiControl::updateInternal(const char* key, T val, bool triggerCallback) {
    for (auto& v : values) {
        if (strcmp(v.key, key) == 0) {
            // 1. Check for change based on type
            bool changed = false;
            if (v.type == VT_INT)   { if(v.val.i != (int)val)   { v.val.i = (int)val;   changed = true; } }
            else if (v.type == VT_BOOL)  { if(v.val.b != (bool)val)  { v.val.b = (bool)val;  changed = true; } }
            else if (v.type == VT_FLOAT) { if(abs(v.val.f - (float)val) > 0.001f) { v.val.f = (float)val; changed = true; } }

            if (changed) {
                markDirtyIfPersistent(v); 
                if (triggerCallback && onUpdate) {
                    JsonDocument d; d.set(val);
                    onUpdate(id, key, d.as<JsonVariant>());
                }
            }
            return;
        }
    }
}

// Separate implementation for String (since it uses v.s instead of v.val)
void MultiControl::updateInternal(const char* key, String val, bool triggerCallback) {
    for (auto& v : values) {
        if (strcmp(v.key, key) == 0 && v.type == VT_STRING) {
            if (v.s != val) {
                v.s = val;
                markDirtyIfPersistent(v);
                if (triggerCallback && onUpdate) {
                    JsonDocument d; d.set(val);
                    onUpdate(id, key, d.as<JsonVariant>());
                }
            }
            return;
        }
    }
}
// Setters (with ArduinoJson 7 Callback Fix)
// void MultiControl::set(const char* key, int val) {
//     for (auto& v : values) if (strcmp(v.key, key) == 0) {
//         if (v.val.i != val) { v.val.i = val; markDirtyIfPersistent(v); 
//             if (onUpdate) { JsonDocument d; d.set(val); onUpdate(id, key, d.as<JsonVariant>()); }
//         } return;
//     }
// }
// void MultiControl::set(const char* key, bool val) {
//     for (auto& v : values) if (strcmp(v.key, key) == 0) {
//         if (v.val.b != val) { v.val.b = val; markDirtyIfPersistent(v); 
//             if (onUpdate) { JsonDocument d; d.set(val); onUpdate(id, key, d.as<JsonVariant>()); }
//         } return;
//     }
// }
// void MultiControl::set(const char* key, float val) {
//     for (auto& v : values) if (strcmp(v.key, key) == 0) {
//         if (abs(v.val.f - val) > 0.001f) { v.val.f = val; markDirtyIfPersistent(v); 
//             if (onUpdate) { JsonDocument d; d.set(val); onUpdate(id, key, d.as<JsonVariant>()); }
//         } return;
//     }
// }
// void MultiControl::set(const char* key, String val) {
//     for (auto& v : values) if (strcmp(v.key, key) == 0) {
//         if (v.s != val) { v.s = val; markDirtyIfPersistent(v); 
//             if (onUpdate) { JsonDocument d; d.set(val); onUpdate(id, key, d.as<JsonVariant>()); }
//         } return;
//     }
// }

void MultiControl::set(const char* key, const char* val){
    if(val == nullptr){
        set(key, String("error:set to nullptr"));
    }else{
        set(key, String(val));
    }
}
void MultiControl::markDirty(){
    isDirty = true;
    lastChangeTime = millis();
}
void MultiControl::markDirtyIfPersistent(const SubValue& v) {
    if (!v.persist) return;
    isDirty = true;
    lastChangeTime = millis();
}

// Pointers
int* MultiControl::getIntPtr(const char* key) { for (auto& v : values) if (v.type == VT_INT && strcmp(v.key, key) == 0) return &v.val.i; return nullptr; }
bool* MultiControl::getBoolPtr(const char* key) { for (auto& v : values) if (v.type == VT_BOOL && strcmp(v.key, key) == 0) return &v.val.b; return nullptr; }
float* MultiControl::getFloatPtr(const char* key) { for (auto& v : values) if (v.type == VT_FLOAT && strcmp(v.key, key) == 0) return &v.val.f; return nullptr; }
String* MultiControl::getStringPtr(const char* key) { for (auto& v : values) if (v.type == VT_STRING && strcmp(v.key, key) == 0) return &v.s; return nullptr; }

void MultiControl::save(Preferences& prefs) {
    for (auto& v : values) {
        if (!v.persist) continue;
        // Use id[0] to keep key under 15-char NVS limit: "p_duty_target" (12 chars) vs "pump_duty_target" (16 chars)
        String pk = String(id[0]) + "_" + String(v.key); pk.replace('.', '_');
        if (v.type == VT_INT) prefs.putInt(pk.c_str(), v.val.i);
        else if (v.type == VT_BOOL) prefs.putBool(pk.c_str(), v.val.b);
        else if (v.type == VT_FLOAT) prefs.putFloat(pk.c_str(), v.val.f);
        else if (v.type == VT_STRING) prefs.putString(pk.c_str(), v.s);
    }
}

void MultiControl::load(Preferences& prefs) {
    for (auto& v : values) {
        if (!v.persist) continue;
        // Use id[0] to keep key under 15-char NVS limit: "p_duty_target" (12 chars) vs "pump_duty_target" (16 chars)
        String pk = String(id[0]) + "_" + String(v.key); pk.replace('.', '_');
        if (prefs.isKey(pk.c_str())) {
            if (v.type == VT_INT) v.val.i = prefs.getInt(pk.c_str(), v.val.i);
            else if (v.type == VT_BOOL) v.val.b = prefs.getBool(pk.c_str(), v.val.b);
            else if (v.type == VT_FLOAT) v.val.f = prefs.getFloat(pk.c_str(), v.val.f);
            else if (v.type == VT_STRING) v.s = prefs.getString(pk.c_str(), v.s);
            v.updateLast();
        }
    }
}

void MultiControl::updateFromNested(JsonVariant incoming, String path) {
    if (incoming.is<JsonObject>()) {
        for (JsonPair kv : incoming.as<JsonObject>()) {
            String newPath = (path == "") ? String(kv.key().c_str()) : path + "." + kv.key().c_str();
            updateFromNested(kv.value(), newPath);
        }
    } else {
        // --- TYPE SAFETY LOGIC ---
        // Instead of guessing from 'incoming', we check what OUR C++ variable expects
        for (auto& v : values) {
            if (strcmp(v.key, path.c_str()) == 0) {
                // We found the matching key in C++, now cast the JSON to OUR type
                if (v.type == VT_INT)         set(path.c_str(), incoming.as<int>());
                else if (v.type == VT_BOOL)   set(path.c_str(), incoming.as<bool>());
                else if (v.type == VT_FLOAT)  set(path.c_str(), incoming.as<float>());
                else if (v.type == VT_STRING) set(path.c_str(), incoming.as<String>());
                return; // Found and updated, exit loop
            }
        }
        // If the key wasn't found in C++, we ignore it (prevents web-bloat)
    }
}