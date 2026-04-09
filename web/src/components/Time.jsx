import { useState } from "react";

import "../css/Auto.css";
import '../css/App.css';
import { MoveLeft } from "lucide-react";

/* takes json as below:
{
    "id": 2,
    "name": "Time",
    "type": "dateTime",
    "value": {
        "date_time_now": "2026-02-24T17:38:38",
    }
}
*/

function Time({ data, setValue }) {
    // 1. Defensive Extraction
    const config = data || {};
    const name = config.name || "System Time";
    const rawValue = config.value?.date_time_now;

    // 2. Format Normalizer
    // HTML datetime-local requires 'YYYY-MM-DDTHH:MM' 
    // We must ensure the 'T' is present and strip any seconds/milliseconds
    const formatDateTime = (val) => {
        if (!val || typeof val !== 'string') return "";
        
        // If your ESP32 sends "2026-03-26 12:53", replace space with 'T'
        let formatted = val.replace(' ', 'T');
        
        // datetime-local is picky: it hates seconds (e.g., :00) in some browsers
        // We slice to the first 16 characters: "YYYY-MM-DDTHH:MM"
        return formatted.length >= 16 ? formatted.substring(0, 16) : formatted;
    };

    const onDateTimeChange = (e) => {
        if (typeof setValue === 'function') {
            const newValue = e.target.value;
            // Send back to ESP32 (usually they prefer the 'T' removed or kept)
            setValue({ date_time_now: newValue });
        }
    };

    // 3. "Sync Now" Helper
    const syncWithPhone = () => {
        const now = new Date();
        // Adjust for local timezone offset to get an ISO-like string
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now - offset).toISOString().substring(0, 16);
        
        if (typeof setValue === 'function') {
            setValue({ date_time_now: localISOTime });
        }
    };

    return (
        <div className="auto-container">
            <div className="auto-row datetime-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'left'}}>
                <label className="app-label auto-label font-base">{name}</label>
                
                <div className="datetime-input-wrapper" style={{ display: 'flex', gap: '5px'}}>
                    <input
                        type="datetime-local"
                        className="datetime-input ui-color-major"
                        value={formatDateTime(rawValue)}
                        onChange={onDateTimeChange}
                        style={{ background: 'var(--ui-color-input)', border: '1px solid #444', color: 'inherit', padding: '4px' }}
                    />
                    
                    {/* 4. The "Expert" Touch: Quick Sync Button */}
                    <button 
                        type="button"
                        onClick={syncWithPhone}
                        title="Sync with Phone Time"
                        style={{ background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 8px' }}
                    >
                        🔄
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Time;