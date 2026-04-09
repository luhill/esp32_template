#pragma once
#include <module_base.h>

#if defined(CONFIG_IDF_TARGET_ESP32S3)
// S3: Use the modern RMT driver (Native & Fast)
#define FASTLED_ESP32_RAW_RMT
#else
#endif
#include <FastLED.h>

class Module_Led : public Module_Base<Module_Led> {
   private:
    int _numLeds = 0;
    float _gHue = 0.0f;
    float _hueStep = 0.0f;
    float _currentBright = 0.0f;
    float _fadeSpeed = 8.0f;  // Slightly faster default fade
    bool _isDirty = true;     // Force at least one draw on boot

   public:
    Module_Led() { _type = "led"; }
    
    int* bright = nullptr;
    int* r = nullptr;
    int* g = nullptr;
    int* b = nullptr;
    bool* isOn = nullptr;
    int* mode = nullptr;
    int* speed = nullptr;

    CLEDController* controller = nullptr;
    CRGB* leds = nullptr;

    template <template <uint8_t PIN, EOrder RGB_ORDER> class CHIPSET,
              uint8_t DATA_PIN, EOrder RGB_ORDER>
    Module_Led& addHardware(int numLeds) {
        _numLeds = numLeds;
        leds = new CRGB[_numLeds];
        controller =
            &FastLED.addLeds<CHIPSET, DATA_PIN, RGB_ORDER>(leds, _numLeds)
                 .setCorrection(TypicalLEDStrip);
        return *this;
    }
    void calcHueStep() { _hueStep = (*speed / 40.0f); }
    // --- EXECUTION ---

    void setup() override {
        isOn = this->control->addValue("on", true, this->_persist);
        bright = this->control->addValue("brightness", 255, this->_persist);
        mode = this->control->addValue("mode", 0, this->_persist);
        speed = this->control->addValue("speed", 25, this->_persist);
        r = this->control->addValue("color.r", 255);
        g = this->control->addValue("color.g", 0);
        b = this->control->addValue("color.b", 187);

        this->control->setMeta("max_brightness", 255);
        this->control->addArray("modes", "Solid", "Rainbow", "Breathe", "Fire");

        calcHueStep();  // Initial calculation based on default speed
    }

    // When UI changes, mark the module as "Dirty" so the task knows to
    bool onUpdate_internal() override { _isDirty = true; calcHueStep(); return true;}

    /**
     * @brief Smart Update Logic.
     * Only runs heavy code if fading or animating.
     */
    void tick10ms() override {
        if (!isOn || !leds || !controller) return;

        // 1. Calculate Target & Fading
        float target = (*isOn) ? (float)(*bright) : 0.0f;
        bool isFading = (abs(_currentBright - target) > 0.1f);

        // Mode 0 is "Solid". Anything else is dynamic.
        bool isDynamicMode = (*mode != 0);

        // Early Exit: Don't waste SPI/RMT cycles if nothing is moving
        if (!isFading && !isDynamicMode && !_isDirty) return;

        // 2. Adjust Master Fader
        if (isFading) {
            if (_currentBright < target)
                _currentBright = fmin(_currentBright + _fadeSpeed, target);
            else
                _currentBright = fmax(_currentBright - _fadeSpeed, target);
        }

        // 3. The "Painter" Switch
        // This defines WHAT is on the LEDs, regardless of brightness
        switch (*mode) {
            case 0:  // SOLID
                fill_solid(leds, _numLeds, CRGB(*r, *g, *b));
                break;

            case 1:  // RAINBOW
                _gHue += (*speed / 20.0f) + 0.1f;
                fill_rainbow(leds, _numLeds, (uint8_t)_gHue, 7);
                break;

            case 2:  // BREATHE (Pulsing the existing color)
                fill_solid(leds, _numLeds, CRGB(*r, *g, *b));
                nscale8_video(leds, _numLeds, beatsin8((*speed / 4) + 5, 60, 255));
                break;

            case 3:  // FIRE
                for (int i = 0; i < _numLeds; i++) {
                    uint8_t noise = inoise8(i * 50, millis() * (*speed / 10));
                    leds[i] = ColorFromPalette(HeatColors_p, noise);
                }
                break;

            case 4:  // GLITTER
                fadeToBlackBy(leds, _numLeds, 20);
                if (random8() < (*speed / 2)) {
                    leds[random16(_numLeds)] += CRGB::White;
                }
                break;

            default:  // Fallback to Solid
                fill_solid(leds, _numLeds, CRGB(*r, *g, *b));
                break;
        }

        // 4. Final Hardware Push
        controller->showLeds((uint8_t)_currentBright);

        // Reset dirty flag if we aren't fading anymore
        if (!isFading) _isDirty = false;
    }
};