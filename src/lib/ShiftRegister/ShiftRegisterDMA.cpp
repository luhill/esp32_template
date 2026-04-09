#include "ShiftRegisterDMA.h"
#include <driver/i2s.h>
#include "soc/i2s_struct.h"
#include "soc/i2s_reg.h"
#include <helpers.h>
// Fix for 'I2S_MODE_LCD' undefined in some ESP32 cores
#if !defined(I2S_MODE_LCD)
#define I2S_MODE_LCD (0x80000000)
#endif

// Ensure the parallel communication format is defined
#if !defined(I2S_COMM_FORMAT_I2S_MSB)
#define I2S_COMM_FORMAT_I2S_MSB (0x01)
#endif

#define DMA_BUF_COUNT 8
#define DMA_BUF_LEN   1024 // Samples per buffer

#define I2S_SAMPLE_RATE 250000

static PinConfig expander_pins[MAX_PINS];

static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

void initShiftRegisterDMA(uint8_t PIN_BCK, uint8_t PIN_WS, uint8_t PIN_DATA) {
    debugln(">>> Entering I2S Init...");

// 1. Setup I2S Configuration
//#ifdef CONFIG_IDF_TARGET_ESP32
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_LCD),
        //.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = 250000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,  // Forces 32-bit total frame
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S_MSB),
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = DMA_BUF_LEN,
        .use_apll = false,
        .bits_per_chan = I2S_BITS_PER_CHAN_16BIT};  // Total bits in one channel (including padding)};
// #elif defined(CONFIG_IDF_TARGET_ESP32S3)

//         #error "REQUIRED_MACRO is not defined. Stopping build."
//     i2s_config_t i2s_config = {
//     .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
//     .sample_rate = 250000,
//     .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // S3 loves 32-bit alignments
//     .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
//     .communication_format = I2S_COMM_FORMAT_STAND_I2S,
//     .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
//     .dma_buf_count = 4,   // Reduced count to save DMA bus bandwidth
//     .dma_buf_len = 512,   // Balanced length
//     .use_apll = false,    // APLL often interferes with Wi-Fi clocks on S3
//     .tx_desc_auto_clear = true,
//     .mclk_multiple = I2S_MCLK_MULTIPLE_128, // Forces a stable master clock
//     .bits_per_chan = I2S_BITS_PER_CHAN_32BIT
// };
    
// #endif

    i2s_pin_config_t pin_config = {
        .bck_io_num = PIN_BCK,
        .ws_io_num = PIN_WS,
        .data_out_num = PIN_DATA,
        .data_in_num = I2S_PIN_NO_CHANGE};

    debugln(">>> Installing I2S Driver...");
    esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        debugfln("I2S Install Fail: %d\n", err);
        return;
    }

    debugln(">>> Setting I2S Pins...");
    i2s_set_pin(I2S_NUM_0, &pin_config);
    
    for(int i=0; i<MAX_PINS; i++) {
        expander_pins[i].duty_ticks = 0;
        expander_pins[i].cycle_ticks = 250; 
        expander_pins[i].counter = 0;
    }

    debugln(">>> Creating DMA Task...");
    BaseType_t taskStatus = xTaskCreatePinnedToCore([](void* p) {
        // Use a smaller, faster buffer
        //const int bufLen = 256;
        uint32_t* buffer = (uint32_t*)heap_caps_malloc(DMA_BUF_LEN * sizeof(uint32_t), MALLOC_CAP_DMA);

        size_t bytes_written;
        while (1) {
            for (int s = 0; s < DMA_BUF_LEN; s++) {
                portENTER_CRITICAL(&mux);
                for (int p = 0; p < MAX_PINS; p++) {
                    if (expander_pins[p].cycle_ticks > 0) {
                        expander_pins[p].counter++;

                        // Toggle Logic (Marlin Style)
                        if (expander_pins[p].counter >= expander_pins[p].cycle_ticks) {
                            expander_pins[p].counter = 0;
                        }

                        if (expander_pins[p].counter < expander_pins[p].duty_ticks) {
                            // Set bit
                            i2s_port_data |= (1 << p);
                        } else {
                            // Clear bit
                            i2s_port_data &= ~(1 << p);
                        }
                    }
                }
                portEXIT_CRITICAL(&mux);

                // Push the pre-calculated 32-bit word
                buffer[s] = i2s_port_data;
            }
            i2s_write(I2S_NUM_0, buffer, DMA_BUF_LEN* sizeof(uint32_t), &bytes_written, portMAX_DELAY);
            // #if DEBUGGING
            // headroom_dma = uxTaskGetStackHighWaterMark(NULL);
            // #endif
            //vTaskDelay(1); // Give the Wi-Fi stack a millisecond to breathe
        }
    },
    "DMA_Feeder", 1024, NULL, 1, &handle_dma, CONFIG_ARDUINO_RUNNING_CORE);

    if (taskStatus != pdPASS) {
        debugln(">>> Task Creation Failed!");
    } else {
        debugln(">>> DMA Task Started Successfully.");
    }
    applyHardwareFixes();
}
void applyHardwareFixes() {
    #if defined(CONFIG_IDF_TARGET_ESP32) && !defined(CONFIG_IDF_TARGET_ESP32S3)
        debugln("Applying tinybee fixes...");
        // Fix for Original ESP32 (TinyBee)
        // Removes the 1-bit audio delay and aligns MSB correctly
        //I2S0.conf.tx_msb_right = 1; 
        I2S0.conf.tx_msb_shift = 0;
    #elif defined(CONFIG_IDF_TARGET_ESP32S3)
        // Fix for ESP32-S3 (Your Dev Target)
        // S3 uses a different register structure (tx_conf / tx_conf1)
        I2S0.tx_conf1.tx_msb_shift = 0;
        I2S0.tx_conf.tx_update = 1;
    #endif
}

void dWrite(uint8_t i, bool val){
    if(!IS_EXPANDER_PIN(i)){
        pinMode(i, OUTPUT);
        digitalWrite(i, val);
        return; // Invalid pin for expander write
    }
    uint8_t idx = GET_EXPANDER_INDEX(i);

    /* Do the math/logic first */ 
    uint32_t mask = (1UL << (idx)); 
    portENTER_CRITICAL(&mux); \
    expander_pins[idx].cycle_ticks = 0; //cycle_ticks must be 0 for pwm to stop
    if (val) i2s_port_data |= mask; 
    else i2s_port_data &= ~mask; 
    portEXIT_CRITICAL(&mux);
} 
bool dRead(uint8_t i){
    if(!IS_EXPANDER_PIN(i)) return false; // Invalid pin for expander read
    uint8_t idx = GET_EXPANDER_INDEX(i);
    return TEST_BIT_32(i2s_port_data, idx);
}
void aWrite(uint8_t pin, float duty_percent) {
    if(!IS_EXPANDER_PIN(pin)) return; // Invalid pin for expander write
    uint8_t idx = GET_EXPANDER_INDEX(pin);
    // 1. Perform all "heavy" logic and constraints OUTSIDE the lock
    constrain(duty_percent, 0.0f, 100.0f);
    expander_pins[idx].duty_percent = duty_percent; // Store the percentage for easier UI interaction
    // Calculate the new tick count
    uint32_t calculated_ticks = (uint32_t)((duty_percent / 100.0f) * expander_pins[idx].cycle_ticks);
    if(calculated_ticks >= expander_pins[idx].cycle_ticks){
        dWrite(pin, true); // If duty is 100% or more, just set the pin high and skip PWM logic
        return;
    }
    // 2. Only lock for the actual memory assignment
    portENTER_CRITICAL(&mux);
    expander_pins[idx].duty_ticks = calculated_ticks;
    portEXIT_CRITICAL(&mux);
}
void setPWMFrequency(uint8_t pin, uint32_t frequency_hz) {
    // 1. Calculate the new total cycle length
    uint32_t new_cycle = I2S_SAMPLE_RATE / frequency_hz;
    if (new_cycle == 0) new_cycle = 1;
    
    //scale the duty ticks to maintain the same duty cycle percentage
    uint32_t new_duty_ticks = new_cycle * expander_pins[pin].duty_percent / 100.0f;
    
    portENTER_CRITICAL(&mux);
    expander_pins[pin].duty_ticks = new_duty_ticks;
    expander_pins[pin].cycle_ticks = new_cycle;
    expander_pins[pin].counter = 0; 
    portEXIT_CRITICAL(&mux);
}
float getPWMDuty(uint8_t pin){
    if (!IS_EXPANDER_PIN(pin)) return -1.0f; // Invalid pin for duty retrieval
    uint8_t ex_pin = GET_EXPANDER_INDEX(pin);
    return expander_pins[ex_pin].duty_percent;
}

void setCycles(uint8_t pin, uint32_t cycle_ticks) {
    if(!IS_EXPANDER_PIN(pin)) return; // Invalid pin for expander write
    uint8_t idx = GET_EXPANDER_INDEX(pin);
    uint32_t new_duty_ticks = cycle_ticks * expander_pins[idx].duty_percent / 100.0f;
    portENTER_CRITICAL(&mux);
    expander_pins[idx].cycle_ticks = cycle_ticks;
    expander_pins[idx].duty_ticks = new_duty_ticks;
    expander_pins[idx].counter = 0; // Reset counter to avoid timing issues
    portEXIT_CRITICAL(&mux);
}
