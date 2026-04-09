import '../css/App.css';
import '../css/MyButton.css';
import React from 'react';
import Icon from '@mdi/react';
import { 
    mdiGarage, 
    mdiGarageOpen,
    mdiGate, 
    mdiPower, 
    mdiLightbulb, 
    mdiWaterPump, 
    mdiGateArrowLeft,
    mdiGateArrowRight,
    mdiGateOpen,
    mdiArrowUp,
    mdiArrowDownBold,
    mdiArrowUpBold,
    mdiArrowDown,
    mdiArrowLeftBold,
    mdiArrowRightBoldBox,
    mdiArrowRightBold
} from '@mdi/js';

function Button({ data, setValue, children }) {
    const name = data?.name || "Action";

    // 1. Define your mapping (C++ Name -> MDI Path)
    const iconMap = {
        "Close Garage": [mdiGarage,mdiArrowDownBold],
        "Open Garage": [mdiGarageOpen,mdiArrowUpBold],
        "Open Gate": [mdiArrowLeftBold,mdiGate],
        "Crack Gate": mdiGateOpen,
        "Close Gate": [mdiGate,mdiArrowRightBold],
        // Add more as your ESP32 project grows
    };

    // 2. Logic to find the best match

const matchKey = Object.keys(iconMap).find(k => 
        name.toLowerCase().includes(k.toLowerCase())
    );
    const matched = iconMap[matchKey];

    return (
        <div className="button-row centered-content" style={{ position: 'relative' }}>
            {children}
            <button className="lens-button-3d" onClick={() => setValue({click:true}) }>
                <div className="button-content">
                    {matched ? (
                        // Check if it's an array or a single string
                        Array.isArray(matched) ? (
                            matched.map((path, i) => (
                                <Icon key={i} path={path} size={1.5} color="currentColor" />
                            ))
                        ) : (
                            <Icon path={matched} size={1.5} color="currentColor" />
                        )
                    ) : (
                        <span className="font-base">{name}</span>
                    )}
                </div>
                <span className="lens-shine"></span>
            </button>
        </div>
    );
}

export default Button;