import {useRef } from "react";
import '../css/Slider.css';
import '../css/App.css';

import React, { useState, useEffect } from 'react';

function Slider({ data, setValue }) {
    const config = data || {};
    const name = config.name || "";
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const useIcon = !!config.useIcon;
    const append = config.append || "";

    // 1. Logic to identify and "lock in" the data structure
    const isObject = config.value !== null && typeof config.value === 'object';
    
    // We use a Ref to store the key name (e.g., "brightness" or "level")
    // so we can wrap the value correctly on the return trip.
    const firstKey = useRef(isObject ? Object.keys(config.value)[0] : null);

    // 1. New Ref to track user activity
    const lastUserAction = useRef(0);

    // 2. Local State for "Zero-Lag" Sliding
    // Extract the raw number from either the primitive or the first object property
    const getInitialValue = () => {
        const val = firstKey.current ? config.value[firstKey.current] : config.value;
        return Number(val) || 0;
    };

    const [localValue, setLocalValue] = useState(getInitialValue());

    
    useEffect(() => {
        const now = Date.now();
        // Only overwrite local UI state if the user hasn't touched it in 250ms
        // This allows the hardware "echoes" to settle while the thumb is active.
        if (now - lastUserAction.current > 250) {
            setLocalValue(getInitialValue());
        }
    }, [config.value]);

    const handleInput = (e) => {
        const val = parseFloat(e.target.value);
        if (isNaN(val)) return;

        setLocalValue(val); // Update UI instantly for the user's thumb

        if (typeof setValue === 'function') {
            // 4. If we detected an object originally, wrap the value back up
            const dataToSend = firstKey.current 
                ? { [firstKey.current]: val } 
                : val;
            
            setValue(dataToSend);
        }
    };

    return (
        <div className="slider-row">
            {name && (
                <label className="app-label slider-label" title={name}>
                    <span className={useIcon ? "visually-hidden" : "font-base"}>
                        {name}
                    </span>
                    {useIcon && (
                        <span className="slider-icon font-base" aria-hidden="true">
                            ☀
                        </span>
                    )}
                </label>
            )}

            <input
                className="slider-input color-base"
                type="range"
                min={min}
                max={max}
                step={config.step || 1}
                onInput={handleInput}
                value={localValue}
                style={{ cursor: 'pointer' }}
            />

            <div className="slider-value color-minor">
                <span className="color-minor">{Math.round(localValue)}</span>
                {append && <span className="slider-append color-minor">{append}</span>}
            </div>
        </div>
    );
}

export default Slider;
