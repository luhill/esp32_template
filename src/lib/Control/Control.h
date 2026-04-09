#pragma once
#include <ArduinoJson.h>
#include <Preferences.h>
#include <vector>
#include <functional>

enum ValType { VT_INT, VT_BOOL, VT_FLOAT, VT_STRING };

typedef std::function<void(const char* id, const char* key, JsonVariant val)> ControlCallback;

struct SubValue {
    const char* key;
    ValType type;
    union {
        int i;
        bool b;
        float f;
    } val;
    String s;

    int lastI; bool lastB; float lastF; String lastS;
    bool persist;

    bool changed();
    void updateLast();
};

//extern std::vector<ControlBase*> uiRegistry; 

class ControlBase {
public:
    String group;
    const char* id;
    virtual void build(JsonObject root) = 0;
    virtual void sync(JsonObject delta) = 0;
};

class MultiControl : public ControlBase {
public:
    const char* type;
    const char* name;
    std::vector<SubValue> values;
    JsonDocument metadata;
    ControlCallback onUpdate = nullptr;

    bool isDirty = false;
    bool requiresSend = false;
    unsigned long lastChangeTime = 0;

    MultiControl(String _group, const char* _id, const char* _type, const char* _name);

    // Initializers (persist defaults to false)
    // void addValue(const char* key, int initial, bool persist = false);
    // void addValue(const char* key, bool initial, bool persist = false);
    // void addValue(const char* key, float initial, bool persist = false);
    // void addValue(const char* key, String initial, bool persist = false);
    int* addValue(const char* key, int initial, bool persist = false);
    bool* addValue(const char* key, bool initial, bool persist = false);
    float* addValue(const char* key, float initial, bool persist = false);
    String* addValue(const char* key, String initial, bool persist = false);
    String* addValue(const char* key, const char* initial, bool persist = false);//catch const char* and route to String constructor

    template <typename T>
    void setMeta(const char* path, T metaValue, const char* parent = nullptr) {
        // 1. Get or create the root metadata object
        JsonObject metaObj = metadata.is<JsonObject>()
                                 ? metadata.as<JsonObject>()
                                 : metadata.to<JsonObject>();

        // 2. The "Context" starts at the root, but shifts if a parent is
        // provided
        JsonObject context = metaObj;

        if (parent != nullptr) {
            // Ensure the parent object exists (e.g., "shortcuts": {})
            context = metaObj[parent].is<JsonObject>()
                          ? metaObj[parent].as<JsonObject>()
                          : metaObj[parent].to<JsonObject>();
        }

        // 3. Now run your existing getTarget logic on the chosen context
        const char* shortKey;
        getTarget(context, path, &shortKey)[shortKey] = metaValue;
    }

    template <typename... Args>
    void addArray(const char* path, Args... args) {
        const char* shortKey;
        JsonObject metaObj = metadata.is<JsonObject>()
                                 ? metadata.as<JsonObject>()
                                 : metadata.to<JsonObject>();

        // 1. Get the target object (e.g. the "color" object in "color.modes")
        JsonObject target = getTarget(metaObj, path, &shortKey);

        // 2. Use the subscript operator and .to<JsonArray>() to create the
        // array
        JsonArray arr = target[shortKey].to<JsonArray>();

        // 3. Fold expression to fill the array
        (arr.add(args), ...);
    }

    void build(JsonObject root) override;
    void sync(JsonObject delta) override;
    void save(Preferences& prefs);
    void load(Preferences& prefs);
    void updateFromNested(JsonVariant incoming, String path = "");
    void markDirty();
    void markDirtyIfPersistent(const SubValue& v);
    void forceUiUpdate();
    // High-Speed Cached Pointers (O(1) Access)
    int* getIntPtr(const char* key);
    bool* getBoolPtr(const char* key);
    float* getFloatPtr(const char* key);
    String* getStringPtr(const char* key);

    // Standard Setters (with callbacks)
    void set(const char* key, int val)    { updateInternal(key, val, true); }
    void set(const char* key, bool val)   { updateInternal(key, val, true); }
    void set(const char* key, float val)  { updateInternal(key, val, true); }
    void set(const char* key, String val) { updateInternal(key, val, true); }
    void set(const char* key, const char* val);
    // Silent Setters (no callbacks)
    void setSilent(const char* key, int val)    { updateInternal(key, val, false); }
    void setSilent(const char* key, bool val)   { updateInternal(key, val, false); }
    void setSilent(const char* key, float val)  { updateInternal(key, val, false); }
    void setSilent(const char* key, String val) { updateInternal(key, val, false); }
private:
    static JsonObject getTarget(JsonObject root, const char* fullKey, const char** outKey);

    // The "Single Source of Truth" for updates
    template <typename T>
    void updateInternal(const char* key, T val, bool triggerCallback);
    
    // Specialize for String since it's not in the union
    void updateInternal(const char* key, String val, bool triggerCallback);
};