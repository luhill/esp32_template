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

function Auto({ props, setValue }) {
    const { on, start, stop } = props.value;

    const onAutoChange = (v) => {
        setValue({ on: v });
    };

    // Convert seconds since midnight to HH:MM format
    const secondsToTime = (seconds) => {
        const sec = parseInt(seconds) || 0;
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    // Convert HH:MM format to seconds since midnight
    const timeToSeconds = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 3600 + minutes * 60).toString();
    };

    return (
        <div className="auto-container">
            {/* Row 1: Auto Switch */}
            <Switch
                props={{ name: props.Name || "Auto", value: !!on }}
                setValue={onAutoChange}
            />
            {!!on && (<>
                {/* Row 2: Start Time (visible only if auto is enabled) */}
                <div className="auto-row time-row">
                    <label className="auto-label font-base">Start</label>
                    <input
                        type="time"
                        className="time-input"
                        value={secondsToTime(start)}
                        onChange={(e) => setValue({ start: timeToSeconds(e.target.value) })}
                    />
                </div>
                {/* Row 3: Stop Time (visible only if auto is enabled) */}
                <div className="auto-row time-row">
                    <label className="auto-label font-base">Stop</label>
                    <input
                        type="time"
                        className="time-input"
                        value={secondsToTime(stop)}
                        onChange={(e) => setValue({ stop: timeToSeconds(e.target.value) })}
                    />
                </div>
            </>)}
        </div>
    );
}

export default Auto;