

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
  "bidet": {
    "name": "Bidet",
    "ver": "v1.0.1",
    "home": {
      "auto":{
            "type":"autoStartStop",
            "value":{
                "date_time_now":"2026-02-24T17:38:38",
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
            "append":"%"
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
            ]
        },
        "switch1":{
            "name":"My Switch",
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
            "type":"slider",
            "value":0,
            "append":"%"
        },
        "button":{
            "name":"My Button",
            "type":"button",
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
  "test": {
    "name": "Test32",
    "ver": "v1.0.0",
    "home": {
      "led2": { "type": "led", "name": "LED", "value":{"color":{"r":100}} },
      "power": { "type": "switch", "name": "Main Power", "value": true }
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
      resolve(JSON.parse(response)); // Resolve the promise with the provided data after the delay
    }, 100);
  });
};

