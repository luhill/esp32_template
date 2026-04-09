import { useState } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import Color from "./Color";
import "../css/Color.css";
import '../css/App.css';
import '../css/Led.css';
/* takes json as below:
{
    "id": 2,
    "name": "Led",
    "type": "color",
    "max_brightness": 255,
    "value": {
        "on": 1,
        "brightness": 100,
        "color": {"r": 255, "g": 0, "b": 187},
        "mode": "solid"
    },
    "modes": [
        "solid",
        "rainbow",
        "flash"
    ]
}
*/


function Led({ data, setValue }) {
    // 1. Level 1 Extraction: The Config
    const config = data || {};
    const { 
        name = "LED Control", 
        max_brightness = 255, 
        modes = [], 
        value = {} 
    } = config;

    // 2. Level 2 Extraction: The State
    // !! ensures 'on' is always a strict boolean (handles 1/0 from ESP32)
    const isPowerOn = !!value?.on; 
    const brightness = value?.brightness ?? 0;
    const modeIndex = Number(value?.mode) || 0;
    const speed = value?.speed ?? 50;
    const currentColor = value?.color || { r: 0, g: 0, b: 0 };

    // 3. Expert "Solid" Check
    // Checks if the current mode name contains "solid" (resilient to reordering)
    const modesArray = Array.isArray(modes) ? modes : [];
    const currentModeName = modesArray[modeIndex] || "";
    const isSolidMode = currentModeName.toLowerCase().includes("solid");

    const safeUpdate = (key, val) => {
        if (typeof setValue === 'function') {
            setValue({ [key]: val });
        }
    };

    return (
        <div className="led-group-container">
            {/* Main Power Toggle */}
            <Switch 
                data={{ name, value: isPowerOn }} 
                setValue={(v) => safeUpdate('on', v)} 
            />

            {/* Sub-controls only visible when power is ON */}
            {isPowerOn && (
                <div className="led-settings-area fade-in">
                    
                    {/* Brightness Control */}
                    <Slider
                        data={{ 
                            name: "Brightness", 
                            value: brightness, 
                            max: max_brightness, 
                            useIcon: true 
                        }}
                        setValue={(v) => safeUpdate('brightness', v)}
                    />

                    {/* Mode Selector */}
                    {modesArray.length > 0 && (
                        <div className="color-row">
                            <label className="app-label color-label font-base">Pattern</label>
                            <select 
                                className="color-select color-base" 
                                value={modeIndex} 
                                onChange={(e) => safeUpdate('mode', Number(e.target.value))}
                            >
                                {modesArray.map((m, i) => (
                                    <option key={i} value={i} className="font-base">
                                        {m || `Mode ${i}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Contextual Logic Area */}
                    <div className="led-contextual-controls">
                        {isSolidMode ? (
                            <Color 
                                // Matches Color.jsx expectation: data.value.color
                                data={{ 
                                    name: "Fixed Color", 
                                    value: { color: currentColor } 
                                }} 
                                // Color returns {r, g, b}, we nest it back into 'color' key
                                setValue={(v) => safeUpdate('color', v.color)} 
                            />
                        ) : (
                            <Slider 
                                data={{ 
                                    name: "Speed", 
                                    value: speed, 
                                }} 
                                setValue={(v) => safeUpdate('speed', v)} 
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Led