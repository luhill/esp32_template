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


function Color({ props, setValue }) {

    const onColorChange = (e) => {
        if (setValue) {
            // Send three separate integers to C++ instead of one string
            const rgb = hexToRgb(e.target.value);
            setValue(rgb); 
        }
    };

    // Helper to convert Hex (#ff00bb) to an Object {r: 255, g: 0, b: 187}
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };

    // Helper to convert RGB Object back to Hex for the color picker display
    const rgbToHex = (r, g, b) => {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    return (
        <div className="color-row">
            <label className="color-label font-base">Color:</label>
            <input
                className="color-picker"
                type="color"
                value={rgbToHex(props.value.color.r, props.value.color.g, props.value.color.b)}
                // value={pickerValue} 
                onChange={onColorChange}
            />
        </div>
    );
}

export default Color