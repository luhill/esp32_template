import { useState, useContext, useEffect, useRef } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import Led from "./Led";
import Time from "./Time";
import Auto from "./Auto";
import SwitchSlider from "./SwitchSlider";
import Display from "./Display";
import Button from "./Button";
import List from "./List";
import '../css/App.css';
import "../css/ControlsPanel.css";

import { useESPContext } from '../contexts/ESPContext';

const ControlRow = ({ id, config, onUpdate, pulseData, controlForTool }) => {
    const rowRef = useRef(null);
    const throttleTimer = useRef(null);
    const lastValue = useRef(null);
    const isPulsing = pulseData?.ids?.includes(id);

    const { setControlLock } = useESPContext();

    const handleInteraction = (isStarting) => {
        //setIsInteracting(isStarting);
        setControlLock(id, isStarting); // Tell the context to ignore hardware for this ID
    };


    // 1. ANIMATION LOGIC (Stays the same)
    useEffect(() => {
        if (isPulsing && rowRef.current) {
            rowRef.current.classList.remove('pulse-feedback');
            void rowRef.current.offsetWidth;
            rowRef.current.classList.add('pulse-feedback');
        }
    }, [isPulsing, pulseData.ts]);

    // 2. GLOBAL THROTTLE & OPTIMISTIC UPDATE
    const throttledUpdate = (newValue) => {
        // 1. Optimistic Update (Always immediate for the UI)
        onUpdate(id, newValue, false);
        lastValue.current = newValue;

        // 2. LEADING EDGE: If no timer is running, send to hardware IMMEDIATELY
        if (!throttleTimer.current) {
            onUpdate(id, newValue, true);

            // Start the lockout timer
            throttleTimer.current = setTimeout(() => {
                // 3. TRAILING EDGE: After 100ms, if the value changed again (like a slider move),
                // send the final 'resting' value to ensure hardware is in sync.
                if (lastValue.current !== newValue) {
                    onUpdate(id, lastValue.current, true);
                }
                throttleTimer.current = null;
            }, 50);
        }
    };

    return (
        <div
            ref={rowRef}
            className={`controlRow ${isPulsing ? 'pulse-feedback' : ''}`}
            onMouseDown={() => handleInteraction(true)}
            onMouseUp={() => handleInteraction(false)}
            onTouchStart={() => handleInteraction(true)}
            onTouchEnd={() => handleInteraction(false)}
            onMouseLeave={() => handleInteraction(false)}
        >
            {controlForTool(id, config, throttledUpdate)}
        </div>
    );
};

function ControlsPanel({ props, onUpdate }) {
    const { pulseData } = useESPContext();

    // Updated helper to accept the throttled function
    const renderControl = (id, config, throttledOnUpdate) => {
        switch (config.type) {
            case "slider":
                return <Slider props={config} setValue={throttledOnUpdate} />;
            case "switch": {
                const hasOnKey = config.value?.on !== undefined;
                const currentValue = hasOnKey ? config.value.on : config.value;
                return (
                    <Switch
                        props={{ ...config, value: !!currentValue }}
                        setValue={(v) => throttledOnUpdate(hasOnKey ? { on: v } : v)}
                    />
                );
            }
            case "led":
                return <Led props={config} setValue={throttledOnUpdate} />;
            case "dateTime":
                return <Time props={config} setValue={throttledOnUpdate} />;
            case "autoStartStop":
                return <Auto props={config} setValue={throttledOnUpdate} />;
            case "switchSlider":
                return <SwitchSlider props={config} setValue={throttledOnUpdate} />;
            case "display":
                return <Display props={config} />;
            case "button":
                return <Button props={config} setValue={throttledOnUpdate} />;
            case "list":
                return <List props={config} setValue={throttledOnUpdate} />;
            default:
                return <p>Unknown Control: {id}</p>;
        }
    };

    return (
        <div className="controlsPanel font-base">
            {props.status !== "loaded" ? (
                <div className="controlRow"><p className="status-msg">{props.status}</p></div>
            ) : props.controls && Object.keys(props.controls).length > 0 ? (
                Object.entries(props.controls).map(([id, config]) => (
                    <ControlRow
                        key={id}
                        id={id}
                        config={config}
                        onUpdate={onUpdate}
                        pulseData={pulseData}
                        controlForTool={renderControl}
                    />
                ))
            ) : (
                <p className="status-msg empty">No items available.</p>
            )}
        </div>
    );
}

export default ControlsPanel;

