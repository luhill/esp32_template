
#pragma once
#include <simple_base.h>
#include <registry.h>
#include <helpers.h>
#include <map>
#include <functional>

typedef std::function<void()> VoidCallback;

struct ShortcutEntry {
    String name;
    VoidCallback cb_shortcut;
};

class Module {
public:
    virtual void onBegin() {}      // Called AFTER NVS/Settings are loaded
    /** @brief Called when a control value is changed via the set(ptr, value) method (mainly from web ui interactions) 
     * @note If true is returned a modules _onUpdate method is called (if it has been set). Otherwise the _onUpdate is ignored
    */
    virtual bool onUpdate_internal() {return true;}
    virtual void tick10ms() {}       // Called every 10ms in the task loop
    virtual void tick20ms() {}
    virtual void tick50ms() {}
    virtual void tick100ms() {}
    virtual void tick1s() {}
    virtual void tick10s() {}
    virtual void onTimeChange() {} // Called whenever the time is updated, either via NTP or manual set
    //Allow the WiFi module to "pull" shortcuts from any module
    virtual std::map<String, ShortcutEntry>* getShortcuts() { return nullptr; }
    virtual ~Module() {}
};
//Forward declarations
class wifi_socket;
class Module_WiFi;
class DeviceBase;

template <typename Derived>
class Module_Base : public SimpleBase, public Module {
protected:
    const char* _type = "not_specified";
    const char* _id = "control_id";
    const char* _label = "Label";
    String _tab = "Home";
    bool _persist = false;
    std::map<String, ShortcutEntry> _shortcuts;
    VoidCallback _onUpdate = nullptr;

public:
    std::map<String, ShortcutEntry>* getShortcuts() override {
        return &_shortcuts;
    }
    // Temporary storage for configuration before .begin()

    // --- SHARED CHAINING METHODS ---
    // We return 'Derived&' so the chain stays on the specific module type
    Derived& setId(const char* id) { _id = id; return *static_cast<Derived*>(this); }
    Derived& setLabel(const char* label) { _label = label; return *static_cast<Derived*>(this); }
    Derived& setTab(const char* tab) {
        _tab = tab;
        _tab.toLowerCase(); // Ensure tab names are lower case, as the front end expects this
        return *static_cast<Derived*>(this); }
    
    /** @brief Function to be called when the control values are updated. */
    Derived& onUpdate(VoidCallback cb) { _onUpdate = cb; return *static_cast<Derived*>(this); }
    //Derived& setType(const char* type) { _type = type; return *static_cast<Derived*>(this); }
    
    /** @brief Enable/Disable NVM flash persistence. */
    Derived& setPersist(bool p) {_persist = p; return *static_cast<Derived*>(this);}
    
    Derived& begin() {
        // Creat the json based control
        this->control = new MultiControl(this->_tab, this->_id, this->_type, this->_label);
        
        // Call the specific setup logic for this module
        static_cast<Derived*>(this)->setup();

        // Setup internal and external update callbacks
        this->control->onUpdate = [this](const char* id, const char* key, JsonVariant val) {
            /*return false in onUpdate_internal to ignore _onUpdate*/
            if(onUpdate_internal()){          // modules can overide this to perform internal actions when the control is updated
                if (_onUpdate) _onUpdate();  // if an external callback was provided also call it
            }
            this->control->forceUiUpdate();//controls that override the ui change must be manually flagged for an update.
        };
        // Sync any pre-registered shortcuts to the UI metadata
        for (auto const& [url, entry] : _shortcuts) {
            this->control->setMeta(entry.name.c_str(), url.c_str(), "shortcuts");
        }
        // 2. AUTOMATION: Push the control to the registry automatically
        if (this->control != nullptr) {
            Registry::controls.push_back(this->control);
            debugfln("Registry: Auto-registered control for %s", _id);
        }
        return *static_cast<Derived*>(this);
    }

    /**
     * @brief Adds a web-triggerable shortcut for Siri or external APIs. !! Must
     * be called after begin() !!
     * @param name Label for the shortcut (sent to React meta).
     * @param url The endpoint (e.g., "/gate/open").
     * @param cb The callback function to execute.
     */
    Derived& addSiriShortcut(const char* name, const char* url,std::function<void()> cb) {
        _shortcuts[String(url)] = { String(name), cb };
        //if (this->control) {
            // 1. Always update UI Metadata
            //this->control->setMeta(name, url, "shortcuts");

            // 2. Store the callback in the local map
            //_shortcuts[String(url)] = cb;

        //}
        return *static_cast<Derived*>(this);
    }
    virtual void setup() {}
    //Module_Base() { getModuleRegistry().push_back(static_cast<Module*>(this)); }
   // Module_Base() {DeviceBase::moduleRegistry.push_back(this);}
   Module_Base(){Registry::modules.push_back(this);}; 
   virtual ~Module_Base() {}
};
