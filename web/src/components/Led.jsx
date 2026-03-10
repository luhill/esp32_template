import { useState } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import Color from "./Color";
import "../css/Color.css";
import '../css/App.css';
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


function Led({ props, setValue }) {
    const { name, max_brightness, modes, value = {} } = props || {};
    const { on, brightness, color, mode, speed } = value;

    const onPowerChange = (v) => setValue({ on: v });
    const onBrightnessChange = (v) => setValue({ brightness: v });
    const onColorChange = (v) => setValue && setValue({ color: v });
    const onModeChange = (e) => setValue && setValue({ mode: e.target.selectedIndex });
    const onSpeedChange = (v) => setValue({ speed: v });

    return (
        <>
            <Switch props={{ name, value: on }} setValue={onPowerChange} />

            {brightness != null && (
                <Slider
                    props={{ name: "Brightness", value: brightness, max: max_brightness, useIcon: true }}
                    setValue={onBrightnessChange}
                />
            )}

            {Array.isArray(modes) && mode != null && (
                <div className="color-row">
                    <label className="color-label font-base">Mode:</label>
                    <select className="color-select color-base" value={mode} onChange={onModeChange}>
                        {modes.map((m, i) => (
                            <option key={i} value={i} className="font-base">
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {mode === 0 && color != null && <Color props={props} setValue={onColorChange} />}
            {mode !== 0 && speed != null && <Slider props={{ name: "Speed", value: speed }} setValue={onSpeedChange} />}
        </>
    );
}

export default Led