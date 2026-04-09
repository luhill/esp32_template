import React, { useState, useEffect, useRef } from 'react';
import "../css/TextIO.css";
import "../css/App.css";

function TextIO({ data, setValue }) {
    const config = data || {};
    const name = config.name || "";
    const type = config.type_attr || "string"; 
    const isReadOnly = !!config.readonly;
    const prepend = config.prepend || "";
    const append = config.append || "";

    const isObject = config.value !== null && typeof config.value === 'object';
    const firstKey = useRef(isObject ? Object.keys(config.value)[0] : null);

    const getRawValue = () => {
        const val = firstKey.current ? config.value[firstKey.current] : config.value;
        return val ?? "";
    };

    const { min, max, precision, type_attr } = config;
    
    const [localValue, setLocalValue] = useState("");

    useEffect(() => {
        let val = getRawValue();
        
        // Handle Truncation/Precision for floats
        if (type_attr === 'float' && precision !== undefined && !isNaN(val)) {
            val = Number(val).toFixed(precision);
        }
        
        setLocalValue(val);
    }, [config.value]);

    const submitValue = () => {
        let finalValue = localValue;
        
        if (type_attr === 'int' || type_attr === 'float') {
            finalValue = parseFloat(localValue) || 0;

            // Clamping the value between min and max
            if (min !== undefined) finalValue = Math.max(min, finalValue);
            if (max !== undefined) finalValue = Math.min(max, finalValue);
            
            // Sync local UI to the clamped value
            setLocalValue(finalValue);
        }

        if (typeof setValue === 'function') {
            const dataToSend = firstKey.current ? { [firstKey.current]: finalValue } : finalValue;
            setValue(dataToSend);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
    };

    // Calculate width based on character count so units can "hug" the text
    const inputWidth = `${String(localValue).length || 1}ch`;

    return (
        <div className="text-io-row">
            {name && <label className="app-label slider-label font-base">{name}</label>}
            
            <div className={`text-io-content ${isReadOnly ? 'readonly' : 'interactable'}`}>
                <div className="text-io-value-group">
                    {prepend && <span className="text-io-unit">{prepend}</span>}
                    
                    <input
                        className="text-io-input font-base"
                        type="text"
                        readOnly={isReadOnly}
                        inputMode={type === 'int' ? 'numeric' : type === 'float' ? 'decimal' : 'text'}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={submitValue}
                        onKeyDown={handleKeyDown}
                        style={{ width: inputWidth }} /* Dynamics to allow hugging */
                    />

                    {append && <span className="text-io-unit">{append}</span>}
                </div>
            </div>
        </div>
    );
}

export default TextIO;