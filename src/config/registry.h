#pragma once
#include <vector>
#include <ArduinoJson.h>

// Forward declare the classes so the vectors know the "shape" of the pointers
class Module;
class ControlBase;

namespace Registry {
    // 'inline' allows these to be defined in a header used by many files
    inline std::vector<Module*> modules;
    inline std::vector<ControlBase*> controls;
    inline JsonDocument* masterJson = nullptr;
}