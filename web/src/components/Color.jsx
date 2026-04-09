import { useState } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import "../css/Color.css";
import '../css/App.css';
/* takes json as below:
{
    "value": {
        "color": {"r": 255, "g": 0, "b": 187}
    },
}
*/


function Color({ data, setValue }) {
    // 1. Defensive Extraction
    // Ensure r, g, b are within 0-255 range to prevent bitwise overflow
    const { 
        r = 0, 
        g = 0, 
        b = 0 
    } = data?.value?.color || {};

    // 2. Hardened Hex to RGB
    const hexToRgb = (hex) => {
        if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0 };
        
        const r = parseInt(hex.slice(1, 3), 16) || 0;
        const g = parseInt(hex.slice(3, 5), 16) || 0;
        const b = parseInt(hex.slice(5, 7), 16) || 0;
        
        return { r, g, b };
    };

    // 3. Hardened RGB to Hex
    const rgbToHex = (r, g, b) => {
        // Clamp values 0-255 to prevent the bitwise shift from creating invalid hex
        const clamp = (val) => Math.min(255, Math.max(0, Math.floor(Number(val) || 0)));
        const cr = clamp(r);
        const cg = clamp(g);
        const cb = clamp(b);
        
        return "#" + ((1 << 24) + (cr << 16) + (cg << 8) + cb).toString(16).slice(1);
    };

    const onColorChange = (e) => {
        if (typeof setValue === 'function') {
            const rgb = hexToRgb(e.target.value);
            // 4. IMPORTANT: Wrap in 'color' key to match your ESP32 JSON structure
            // This ensures you update the sub-object, not the whole 'value'
            setValue({ color: rgb }); 
        }
    };

    return (
        <div className="color-row">
            <label className="app-label color-label font-base">
                {data?.name || "Color"}
            </label>
            <input
                className="color-picker"
                type="color"
                // Always returns a valid string like "#000000"
                value={rgbToHex(r, g, b)}
                onChange={onColorChange}
            />
        </div>
    );
}

export default Color