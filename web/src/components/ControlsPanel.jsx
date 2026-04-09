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
import TextIO from "./TextIO";
import PinTester from "./PinTester";
import '../css/App.css';
import "../css/ControlsPanel.css";
import ShortcutTrigger from './ShortcutTrigger';
import { useESPContext } from '../contexts/ESPContext';

// --- SUB-COMPONENT: CONTROLROW ---
const ControlRow = ({ host, id, config, onUpdate, renderControl }) => {
    const rowRef = useRef(null);
    const throttleTimer = useRef(null);
    const lastValue = useRef(null);
    const hasMounted = useRef(false); // To skip the initial pulse on first render
    const { pulseData } = useESPContext();
    const pulseInfo = pulseData[host];
    const isPulsing = pulseInfo?.id === id || pulseInfo?.ids?.includes(id);
    const pulseTs = pulseData[host]?.ts;

    const availableShortcuts = config.shortcuts || null;

    // const handleInteraction = (isStarting) => {
    //     // LOCK: Prevents incoming WebSocket data from jumping the UI 
    //     // while the user is physically touching the control.
    //     if (typeof setControlLock === 'function') {
    //         setControlLock(id, isStarting); 
    //     }
    // };

    // 1. PULSE FEEDBACK (Visual confirmation of hardware ACK)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;
            return; 
        }
        if (isPulsing && rowRef.current) {
            rowRef.current.classList.remove('pulse-feedback');
            void rowRef.current.offsetWidth; 
            rowRef.current.classList.add('pulse-feedback');
        }
    }, [isPulsing, pulseTs]);

    // 2. THE THROTTLE ENGINE
    // 50ms is perfect for ESP32—fast enough to feel "live," slow enough not to crash the heap.
    const throttledUpdate = (newValue) => {
        lastValue.current = newValue;

        if (!throttleTimer.current) {
            // Leading Edge: Send immediately on first touch
            onUpdate(id, newValue, true);

            throttleTimer.current = setTimeout(() => {
                // Trailing Edge: If the user stopped at a different value, send that final state
                if (lastValue.current !== newValue) {
                    onUpdate(id, lastValue.current, true);
                }
                throttleTimer.current = null;
            }, 50); 
        }
        
        // Optimistic UI update (Instant local change)
        onUpdate(id, newValue, false);
    };
    const soloButton = config.type === 'button' || config.transparent === true;
    return (
        <div
            ref={rowRef}
            className={`controlRow ${soloButton? 'controlRow-button' : ''} ${config.shortcuts ? 'has-shortcuts' : ''}`}
            // onMouseDown={() => handleInteraction(true)}
            // onMouseUp={() => handleInteraction(false)}
            // onTouchStart={() => handleInteraction(true)}
            // onTouchEnd={() => handleInteraction(false)}
            // onMouseLeave={() => handleInteraction(false)}
        >
            <ShortcutTrigger host={host} shortcuts={availableShortcuts} />
            {renderControl(id, config, throttledUpdate)}
        </div>
    );
};

// --- MAIN COMPONENT ---
function ControlsPanel({ host, props, onUpdate }) {
    const { globalSettings } = useESPContext();

    const renderControl = (id, config, throttledOnUpdate) => {
        // Every component now receives 'data={config}' and 'setValue={throttledOnUpdate}'
        const components = {
            slider: () => <Slider data={config} setValue={throttledOnUpdate} />,
            switch: () => <Switch data={config} setValue={throttledOnUpdate} />,
            led: () => <Led data={config} setValue={throttledOnUpdate} />,
            dateTime: () => <Time data={config} setValue={throttledOnUpdate} />,
            autoStartStop: () => <Auto data={config} setValue={throttledOnUpdate} />,
            switchSlider: () => <SwitchSlider data={config} setValue={throttledOnUpdate} />,
            display: () => <Display data={config} />,
            button: () => <Button data={config} setValue={throttledOnUpdate} />,
            list: () => <List data={config}/>,
            textIO: () => <TextIO data={config} setValue={throttledOnUpdate} />,
            pinTester:() => <PinTester data={config} setValue={throttledOnUpdate} />
        };

        const ControlComponent = components[config.type];
        return ControlComponent ? ControlComponent() : <p className="error-text">Unknown type: {config.type}</p>;
    };
    return (
        <div className={`controlsPanel font-base ${globalSettings.showShortcuts ? 'show-shortcuts' : 'hide-shortcuts'}`}>
            {props.status !== "loaded" ? (
                <div className="controlRow status-row">
                    <p className="status-msg loading-dots">{props.status || "Connecting"}...</p>
                </div>
            ) : props.controls && Object.keys(props.controls).length > 0 ? (
                Object.entries(props.controls).map(([id, config]) => (
                    <ControlRow
                        key={`${host}-${id}`} 
                        host={host}
                        id={id}
                        config={config}
                        onUpdate={onUpdate}
                        renderControl={renderControl}
                    />
                ))
            ) : (
                <p className="status-msg empty">No controls found for {host}.</p>
            )}
        </div>
    );
}
export default ControlsPanel;