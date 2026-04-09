import { useState, useMemo } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import TextIO from "./TextIO";
import "../css/Color.css";
import '../css/App.css';
import '../css/PinTester.css';

function PinTester({ data, setValue }) {
    const config = data || {};
    const { value = {} } = config;

    // 1. Extraction with Defaults
    const pin = value?.pin ?? 128;
    const on = !!value?.on;
    const isPwm = !!value?.isPwm; // New state for the PWM toggle
    const duty = value?.duty ?? 0;
    const pwmTicks = value?.pwmTicks ?? 250;

    const pwmRange = {
        min: config?.minTicks ?? 2,
        max: config?.maxTicks ?? 250000
    };

    // 2. Generate Pin Options (0-35, 128-176)
    // We use useMemo so this list isn't re-calculated on every slider move
    const pinOptions = useMemo(() => {
        const native = Array.from({ length: 36 }, (_, i) => i); // 0-35
        const expander = Array.from({ length: 49 }, (_, i) => i + 128); // 128-176
        return [...native, ...expander];
    }, []);

    const safeUpdate = (updateObj) => {
        if (typeof setValue === 'function') {
            setValue(updateObj);
        }
    };

    return (
        <div className="pin-tester-container">
            <div className="pin-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Pin Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label className="app-label slider-label">Pin</label>
                    <select
                        value={pin}
                        onChange={(e) => safeUpdate({ pin: parseInt(e.target.value) })}
                        className="pin-select"
                    >
                        {pinOptions.map(p => (
                            <option key={p} value={p}>
                                {p < 128 ? `GPIO ${p}` : `EXP ${p - 128} (ID: ${p})`}
                            </option>
                        ))}
                    </select>
                </div>

                {/* PWM Mode Toggle */}
                <Switch
                    data={{ name: "PWM", value: isPwm }}
                    setValue={(v) => safeUpdate({ isPwm: v })}
                />

            </div>
            {/* Main Power Toggle */}
            <Switch
                data={{ name: "On", value: on }}
                setValue={(v) => safeUpdate({ on: v })}
            />
            { }
            {isPwm && (
                <div className="pwm-controls" style={{ marginTop: '15px' }}>
                    <Slider
                        data={{
                            name: "Duty",
                            value: duty,
                            max: 100,
                            min: 0,
                            append: "%"
                        }}
                        setValue={(v) => safeUpdate({ duty: v })}
                    />
                    <Slider
                        data={{
                            name: "Freq",
                            value: pwmTicks,
                            max: pwmRange.max,
                            min: pwmRange.min,
                            append: " ticks",
                        }}
                        setValue={(v) => safeUpdate({ pwmTicks: v })}
                    />
                    {/* <Slider
                        data={{
                            name: "Freq",
                            value: pwmTicks,
                            max: pwmRange.max,
                            min: pwmRange.min,
                            append: " ticks"
                        }}
                        setValue={(v) => safeUpdate({ pwmTicks: v })}
                    /> */}
                </div>
            )}
        </div>
    );
}

export default PinTester;