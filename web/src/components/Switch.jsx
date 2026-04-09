
import {useRef } from "react";
import "../css/Switch.css"
import "../css/App.css"

function Switch({ data, setValue }) {
    const config = data || {};
    const name = config.name || "Toggle";

    // 1. Detect and remember the "Shape" of the data on the first render
    const isObjectValue = config.value !== null && typeof config.value === 'object';
    const hasOnKey = useRef(isObjectValue && config.value.on !== undefined);

    // 2. Normalize the value for the UI (Boolean)
    const currentValue = hasOnKey.current ? config.value.on : config.value;
    const isChecked = !!currentValue;

    const handleChange = (e) => {
        const newValue = e.target.checked ? 1 : 0;
        
        if (typeof setValue === 'function') {
            // 3. Re-package based on the remembered shape
            const dataToSend = hasOnKey.current ? { on: newValue } : newValue;
            setValue(dataToSend);
        }
    };

    return (
        <div className="switch-container">
            <label className="app-label font-base slider-label">{name}</label>
            <label>
                <input type="checkbox" onChange={handleChange} checked={isChecked} />
                <span className="slider round"></span>
            </label>
        </div>
    );
}

export default Switch;