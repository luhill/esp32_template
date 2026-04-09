

export const getDummyDataError = async () => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject("ESPService.js: ERROR, cannot connect to ESP"); // Reject the promise with the provided error after the delay
    }, 500);
  });
};

export const getDummyData = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
        //const response = '{"controls":[{"id":0, "name":"Power", "type":"switch", "value":0},{"id":1, "name":"Duty", "type":"slider", "value":69}]}';
        const response = `{
    "testdevice": {
        "name": "Garage",
        "version": "v1.0.1",
        "home": {
            "myButton1":{
                "type":"button",
                "name":"Garage",
                "shortcuts":{
                    "Open Garage": "/garage/open",
                    "Close Garage": "/garage/close"
                },
                "value":{"click":false}
            },
            "myButton2":{
                "type":"button",
                "name":"Gate",
                "shortcuts":{
                    "Open Gate": "/gate/open",
                    "Close Gate": "/gate/close"
                },
                "value":{"click":false}
            }
        },
        "info":{
            "wifi":{
                "name":"Wifi",
                "type":"display",
                "value":{
                    "rssi":-55, "ip":"10.0.0.test"
                }
            },
            "log":{
                "type": "list",
                "name": "System Log",
                "value": {
                    "entries":[\"[2026-03-26 10:02:01] Restart (Other)\",\"[2026-03-26 09:29:59] Restart (Other)\",\"[2026-03-26 09:28:42] Restart (Other)\",\"[2026-03-26 09:26:46] Restart (Other)\",\"[2026-03-26 09:21:39] Restart (Other)\",\"[2026-03-26 09:17:47] Restart (Other)\",\"[2026-03-26 09:07:24] Restart (Other)\",\"[2026-03-26 09:05:48] Restart (Other)\",\"[2026-03-26 09:00:16] Restart (Other)\",\"[2026-03-26 08:50:06] Restart (Power On)\",\"[2026-03-26 08:49:51] Restart (Software)\",\"[2026-03-26 08:16:46] Restart (Power On)\",\"[2026-03-26 08:16:08] Restart (Other)\",\"[2026-03-26 08:15:21] Restart (Power On)\",\"[2026-03-26 08:14:10] Restart (Other)\"]
                }  
            }
        }
    }, 
    "bidet": {
        "name": "Bidet",
        "ver": "v1.0.1",
        "home": {
            "pinTester":{
                "type":"pinTester",
                "name":"Pin Tester",
                "pin": -1,
                "duty": 0,
                "pwmTicks": 250,
                "pwm":{
                    "minTicks": 2,
                    "maxTicks": 250000
                }
            },
            "gateOpen":{
                "type":"button",
                "name":"Open Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "gateOpenPartial":{
                "type":"button",
                "name":"Crack Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "gateClose":{
                "type":"button",
                "name":"Close Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "temp":{
                "name":"Temp",
                "type":"textIO",
                "value":{
                    "temp": "23.5"
                },
                "prepend":"",
                "append":"°C",
                "readonly": true
            },
            "time":{
                "name":"My Time",
                "type":"dateTime",
                "value":{
                    "date_time_now":"2026-03-26T10:02:01"
                }
            },
            "auto":{
                "name":"My Auto",
                "type":"autoStartStop",
                "value":{
                    "on": 1,
                    "start": 28800,
                    "stop": 55800
                }
            },
            "pump":{
                "type":"switchSlider",
                "value":{
                    "on": 0,
                    "duty": 0
                },
                "name":"Pump",
                    "append":"%",
                    "shortcuts":{
                        "Test": "/test",
                        "Test": "/test"
                    }
                },
            "led":{
                "type":"led",
                "value":{
                    "on": 1,
                    "brightness": 255,
                    "color": { "r": 255, "g": 0, "b": 187 },
                    "mode": 1,
                    "speed": 50
                },
                "name":"My Led",
                "max_brightness": 255,
                "modes":[
                    "solid",
                    "rainbow",
                    "breath"
                ],
                "shortcuts":{
                    "Test": "/test",
                    "Test": "/test"
                }
            },
            "switch1":{
                "name":"My Switch",
                "shortcuts":{
                    "Test": "/test",
                    "Test": "/test"
                },
                "type":"switch",
                "value":0
            },
            "switch2":{
                "name":"My Switch2",
                "type":"switch",
                "value":{
                    "on":1
                }
            },
            "slider1":{
                "name":"My Slider",
                "shortcuts":{
                    "Test": "/test",
                    "Test": "/test"
                },
                "type":"slider",
                "value":50,
                "append":"%"
            },
            "slider2":{
                "name":"My Slider2",
                "shortcuts":{
                    "Test": "/test",
                    "Test": "/test"
                },
                "min": 1,
                "max": 250000,
                "type":"slider",
                "value":{
                    "duty": 69
                },
                "append":"#"
            },
            "button":{
                "name":"My Button",
                "type":"button",
                "shortcuts":{
                    "Test": "/test",
                    "Test": "/test"
                },
                "value":{"clicked":false}
            }
        },
        "settings":{
            "switch3":{
                "name":"My Switch",
                "type":"switch",
                "value":0
            }
        }
    },
    "garage": {
        "ver": "v1.0.0",
        "home": {
             "garageOpen":{
                "type":"button",
                "name":"Open Garage",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "garageClose":{
                "type":"button",
                "name":"Close Garage",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            }
        },
        "settings":{
            "wifi":{
                "name":"Wifi",
                "type":"display",
                "value":{
                    "rssi":-55, "ip":"10.0.0.test"
                }
            }
        }
    },
    "gate": {
        "ver": "v1.0.0",
        "home": {
             "gateOpen":{
                "type":"button",
                "name":"Open Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "gateCrack":{
                "type":"button",
                "name":"Crack Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            },
            "gateClose":{
                "type":"button",
                "name":"Close Gate",
                "shortcuts":{
                    "Shortcut Name": "/shortcut-url"
                },
                "value":{"click":false}
            }
        },
        "settings":{
            "wifi":{
                "name":"Wifi",
                "type":"display",
                "value":{
                    "rssi":-55, "ip":"10.0.0.test"
                }
            }
        }
    }
}`;
      resolve(response); // Resolve the promise with the provided data after the delay
    }, 100);
  });
};

