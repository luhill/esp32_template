import { useState } from "react";

import "../css/Auto.css";
import '../css/App.css';

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

function Time({
    props: {
        name = "Time",
        value: { date_time_now }
    },
    setValue
}) {
    const onDateTimeChange = (e) => {
        setValue({ date_time_now: e.target.value });
    };

    return (
        <div className="auto-container">
            {/* Row 1: Current Date/Time (Editable) */}
            <div className="auto-row datetime-row">
                <label className="auto-label font-base">{name}</label>
                <input
                    type="datetime-local"
                    className="datetime-input"
                    value={date_time_now}
                    onChange={onDateTimeChange}
                />
            </div>
        </div>
    );
}

export default Time;