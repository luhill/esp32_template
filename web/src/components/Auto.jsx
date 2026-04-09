import { useState } from "react";

import Switch from "./Switch";
import "../css/Auto.css";
import '../css/App.css';

/* takes json as below:
{
    "id": 2,
    "name": "Auto",
    "type": "autoOnOff",
    "value": {
        "date_time_now": "2026-02-24T17:38:38",
        "on": 1,
        "start": "32400",
        "stop": "58800"
    }
}
*/

function Auto({ data, setValue }) {
    const { on = false, start = 0, stop = 0 } = data?.value || {};
    const labelName = data?.name || "Auto";

    // 1. HELPER: Format seconds into "14h 15m"
    const getDurationLabel = (t1, t2) => {
        let diff = Number(t2) - Number(t1);
        
        // Handle wraparound (e.g., Start 10pm, Stop 2am)
        if (diff < 0) diff += 86400; 
        if (diff === 0) return "0m";

        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        
        return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
    };

    const secondsToTime = (seconds) => {
        const totalSeconds = Number(seconds) || 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const timeToSeconds = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return "0";
        const parts = timeStr.split(':');
        if (parts.length < 2) return "0";
        return String((Number(parts[0]) * 3600) + (Number(parts[1]) * 60));
    };

    return (
        <div className="auto-container">
            <Switch
                data={{ name: labelName, value: !!on }}
                setValue={(v) => setValue({ on: v })}
            />

            {!!on && (
                <div className="auto-settings-area">
                    <div className="auto-row time-row">
                        <label className="app-label auto-label font-base">Start</label>
                        <input
                            type="time"
                            className="time-input"
                            value={secondsToTime(start)}
                            onChange={(e) => setValue({ start: timeToSeconds(e.target.value) })}
                        />
                    </div>

                    {/* SUBTLE DURATION INDICATOR */}
                    <div className="duration-divider">
                        <span className="duration-text">
                            Active for {getDurationLabel(start, stop)}
                        </span>
                    </div>

                    <div className="auto-row time-row">
                        <label className="app-label auto-label font-base">Stop</label>
                        <input
                            type="time"
                            className="time-input"
                            value={secondsToTime(stop)}
                            onChange={(e) => setValue({ stop: timeToSeconds(e.target.value) })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
export default Auto;