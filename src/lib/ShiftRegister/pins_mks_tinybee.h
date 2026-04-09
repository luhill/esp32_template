#pragma once

/**
* MKS TinyBee pin definitions
 */


//
#define SERVO0_PIN                             2

//
// Limit Switches
//
#define X_STOP_PIN                            33
#define Y_STOP_PIN                            32
#define Z_STOP_PIN                            22
//#define FIL_RUNOUT_PIN                      35

/*
 * The tinybee uses an I2S-DMA driven shift register setup (3x 74hc595D chips) to achieve high pin counts and precise timing for peripherals like stepper drivers, heaters, and fans.
 * The following pins are hardwired for the I2S communication with the shift registers:
 */
#define I2S_WS 26
#define I2S_BCK 25
#define I2S_DATA 27

//
// Steppers
//
#define X_ENABLE_PIN                         128
#define X_STEP_PIN                           129
#define X_DIR_PIN                            130

#define Y_ENABLE_PIN                         131
#define Y_STEP_PIN                           132
#define Y_DIR_PIN                            133

#define Z_ENABLE_PIN                         134
#define Z_STEP_PIN                           135
#define Z_DIR_PIN                            136

#define E0_ENABLE_PIN                        137
#define E0_STEP_PIN                          138
#define E0_DIR_PIN                           139

#define I_ENABLE_PIN                        140
#define I_STEP_PIN                          141
#define I_DIR_PIN                           142

#define Z2_ENABLE_PIN                        140
#define Z2_STEP_PIN                          141
#define Z2_DIR_PIN                           142

//pint 143 has not been routed to an accessible output on the tinybee
//
// Heaters / Fans
//
#define HEATER_BED_PIN                       144
#define HEATER_0_PIN                         145
#define HEATER_1_PIN                         146
#define FAN_PIN                              147
#define FAN1_PIN                             148
//EXP1_01_PIN                                149//defined elsewhere
#define PIN_BONUS_A                          150
#define PIN_BONUS_B                          151

//
// Temperature Sensors
//
#define TEMP_0_PIN                            36  // Analog Input
#define TEMP_1_PIN                            34  // Analog Input, you need set R6=0Ω and R7=NC
#define TEMP_BED_PIN                          39  // Analog Input

/**
 *                ------                                 ------
 *  (BEEPER) 149 | 1  2 | 13 (BTN_ENC)    (SPI MISO) 19 | 1  2 | 18 (SPI SCK)
 *  (LCD_EN)  21 | 3  4 |  4 (LCD_RS)      (BTN_EN1) 14 | 3  4 |  5 (SPI CS)
 *  (LCD_D4)   0   5  6 | 16 (LCD_D5)      (BTN_EN2) 12   5  6 | 23 (SPI MOSI)
 *  (LCD_D6)  15 | 7  8 | 17 (LCD_D7)      (SPI_DET) 34 | 7  8 | RESET
 *           GND | 9 10 | 5V                        GND | 9 10 | 3.3V
 *                ------                                 ------
 *                 EXP1                                   EXP2
 */

#define EXP1_01_PIN                          149
#define EXP1_02_PIN                           13
#define EXP1_03_PIN                           21
#define EXP1_04_PIN                            4
#define EXP1_05_PIN                            0
#define EXP1_06_PIN                           16
#define EXP1_07_PIN                           15
#define EXP1_08_PIN                           17

#define EXP2_01_PIN                           19
#define EXP2_02_PIN                           18
#define EXP2_03_PIN                           14
#define EXP2_04_PIN                            5
#define EXP2_05_PIN                           12
#define EXP2_06_PIN                           23
#define EXP2_07_PIN                           34
#define EXP2_08_PIN                           -1  // RESET

//
// MicroSD card
//
//#define SD_MOSI_PIN                EXP2_06_PIN  // uses esp32 default 23
//#define SD_MISO_PIN                EXP2_01_PIN  // uses esp32 default 19
//#define SD_SCK_PIN                 EXP2_02_PIN  // uses esp32 default 18
#define SDSS                         EXP2_04_PIN
#define SD_DETECT_PIN                EXP2_07_PIN  // IO34 default is SD_DET signal (Jump to SDDET)
#define USES_SHARED_SPI                           // SPI is shared by SD card with TMC SPI drivers

#if HAS_WIRED_LCD
  #define BEEPER_PIN                 EXP1_01_PIN
  #define LCD_PINS_ENABLE            EXP1_03_PIN
  #define LCD_PINS_RS                EXP1_04_PIN
  #define BTN_ENC                    EXP1_02_PIN
  #define BTN_EN1                    EXP2_03_PIN
  #define BTN_EN2                    EXP2_05_PIN
  #define LCD_BACKLIGHT_PIN                   -1

  #if ENABLED(MKS_MINI_12864)
    // MKS MINI12864 and MKS LCD12864B; If using MKS LCD12864A (Need to remove RPK2 resistor)
    #define DOGLCD_CS                EXP1_06_PIN
    #define DOGLCD_A0                EXP1_07_PIN
    #define LCD_RESET_PIN                     -1
  #elif ENABLED(FYSETC_MINI_12864_2_1)
    // MKS_MINI_12864_V3, BTT_MINI_12864_V1, FYSETC_MINI_12864_2_1
    #define DOGLCD_CS                EXP1_03_PIN
    #define DOGLCD_A0                EXP1_04_PIN
    #define LCD_RESET_PIN            EXP1_05_PIN
    #define NEOPIXEL_PIN             EXP1_06_PIN
    #if SD_CONNECTION_IS(ONBOARD)
      #define FORCE_SOFT_SPI
    #endif
    #if BOTH(MKS_MINI_12864_V3, SDSUPPORT)
      #define PAUSE_LCD_FOR_BUSY_SD
    #endif
  #else
   #define LCD_PINS_D4               EXP1_05_PIN
    #if ENABLED(REPRAP_DISCOUNT_SMART_CONTROLLER)
      #define LCD_PINS_D5            EXP1_06_PIN
      #define LCD_PINS_D6            EXP1_07_PIN
      #define LCD_PINS_D7            EXP1_08_PIN
    #endif
    #define BOARD_ST7920_DELAY_1              96
    #define BOARD_ST7920_DELAY_2              48
    #define BOARD_ST7920_DELAY_3             600
  #endif
#endif // HAS_WIRED_LCD