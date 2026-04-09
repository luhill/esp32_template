#pragma once
#include <Control/Control.h>

/**
 * @brief The absolute base. No templates, just the core pointer.
 */
class SimpleBase {
public:
    MultiControl* control = nullptr;
    virtual ~SimpleBase() {}
};