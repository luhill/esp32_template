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
    // const onDateTimeChange = (e) => {
    //     setValue({ date_time_now: e.target.value });
    // };

    const onAutoChange = (v) => {
        setValue({ on: v });
    };

    const onStartTimeChange = (e) => {
        setValue({ start: timeToSeconds(e.target.value) });
    };

    const onStopTimeChange = (e) => {
        setValue({ stop: timeToSeconds(e.target.value) });
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
            {/* Row 1: Current Date/Time (Editable)
            <div className="auto-row datetime-row">
                <label className="auto-label font-base">Date</label>
                <input
                    type="datetime-local"
                    className="datetime-input"
                    value={props.value.date_time_now}
                    onChange={onDateTimeChange}
                />
            </div> */}

            {/* Row 2: Auto Switch */}
            <Switch 
                props={{ name: "Auto", value: props.value.on}} 
                setValue={onAutoChange} 
            />

            {/* Row 3: Start Time (visible only if auto is enabled) */}
            {props.value.on && (
                <div className="auto-row time-row">
                    <label className="auto-label font-base">Start</label>
                    <input
                        type="time"
                        className="time-input"
                        value={secondsToTime(props.value.start)}
                        onChange={onStartTimeChange}
                    />
                </div>
            )}

            {/* Row 4: Stop Time (visible only if auto is enabled) */}
            {props.value.on && (
                <div className="auto-row time-row">
                    <label className="auto-label font-base">Stop</label>
                    <input
                        type="time"
                        className="time-input"
                        value={secondsToTime(props.value.stop)}
                        onChange={onStopTimeChange}
                    />
                </div>
            )}
        </div>
    );
}

export default Auto;