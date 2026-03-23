import React, { useEffect, useState } from 'react';
import { useESPContext } from '../contexts/ESPContext';
import { Activity, Zap, Play, Square } from 'lucide-react';
import '../css/DevPulseHelper.css';

/**
 * DevPulseHelper Component
 * 
 * Purpose: Simulates a "Live" hardware environment during local development.
 * 1. Heartbeat: Pulses the WiFi icons for connected devices every 2 seconds.
 * 2. Control Pulse: Triggers the 'inward ripple' animation on random controls.
 * 3. Connection Toggle: Quickly brings all visible devices online for testing.
 */
const DevPulseHelper = () => {
    const {
        masterList,
        devices,
        setDevices,
        setPulseData
    } = useESPContext();

    const [isRunning, setIsRunning] = useState(false);
    const [showPanel, setShowPanel] = useState(true);

    // --- EFFECT 1: HEARTBEAT SIMULATOR (Every 2s) ---
    useEffect(() => {
        if (!isRunning || !import.meta.env.DEV) return;

        const heartbeatInterval = setInterval(() => {
            setDevices(prev => {
                const next = { ...prev };
                let changed = false;
                masterList.forEach(dev => {
                    // Only pulse devices that are visible and marked connected
                    if (dev.visible && prev[dev.host]?.connection === 'connected') {
                        next[dev.host] = {
                            ...prev[dev.host],
                            lastUpdate: Date.now(),
                            status: 'loaded'
                        };
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 2000);

        return () => clearInterval(heartbeatInterval);
    }, [isRunning, masterList, setDevices]);

    // --- EFFECT 2: CONTROL RIPPLE SIMULATOR (Every 4s) ---
    useEffect(() => {
        if (!isRunning || !import.meta.env.DEV) return;

        const rippleInterval = setInterval(() => {
            // Find hosts that are actually "online" in the simulator
            const activeHosts = masterList.filter(d => 
                d.visible && devices[d.host]?.connection === 'connected'
            );
            
            if (activeHosts.length === 0) return;

            // Pick a random host from the active ones
            const randomHost = activeHosts[Math.floor(Math.random() * activeHosts.length)].host;
            
            // Pick a random ID (matching common keys in your dummy data)
            const testIds = ['led', 'pump', 'relay1', 'temp'];
            const randomId = testIds[Math.floor(Math.random() * testIds.length)];
            
            console.log(`🚀 Dev Mode: Pulsing [${randomHost}] -> ${randomId}`);

            // UPDATED: Use the new Host-Aware object structure
            setPulseData(prev => ({
                ...prev,
                [randomHost]: { id: randomId, ts: Date.now() }
            }));

            // Optional: Clear the pulse after 600ms (matches CSS animation duration)
            setTimeout(() => {
                setPulseData(prev => {
                    const next = { ...prev };
                    delete next[randomHost];
                    return next;
                });
            }, 600);
            
        }, 600); // 4 seconds is plenty for a background "live" feel

        return () => clearInterval(rippleInterval);
    }, [isRunning, masterList, devices, setPulseData]);

    // --- HELPER: Force all visible devices Online ---
    const forceAllOnline = () => {
        setDevices(prev => {
            const next = { ...prev };
            masterList.forEach(dev => {
                if (dev.visible) {
                    next[dev.host] = {
                        ...prev[dev.host],
                        connection: 'connected',
                        lastUpdate: Date.now(),
                        status: 'loaded',
                        name: dev.name,
                        info: { ver: "v1.0.4-DEV", ip: "192.168.1.10" },
                        // Simulate common control groups
                        home: {
                            led: { type: 'switch', value: false, label: 'LED' },
                            temp: { type: 'slider', value: 22, label: 'Threshold' }
                        },
                        settings: {
                            pump: { type: 'switch', value: true, label: 'Water Pump' }
                        }
                    };
                }
            });
            return next;
        });
    };

    if (!import.meta.env.DEV) return null;

    return (
        <div className={`dev-pulse-helper ${showPanel ? 'expanded' : 'collapsed'}`}>
            <div className="dev-header" onClick={() => setShowPanel(!showPanel)}>
                <Activity size={16} className={isRunning ? 'pulse-green' : ''} />
                {showPanel && <span>Hardware Simulator</span>}
            </div>

            {showPanel && (
                <div className="dev-content">
                    <div className="dev-row">
                        <button
                            className={`btn-dev ${isRunning ? 'stop' : 'start'}`}
                            onClick={() => setIsRunning(!isRunning)}
                        >
                            {isRunning ? <Square size={14} /> : <Play size={14} />}
                            {isRunning ? 'Stop Simulation' : 'Start Heartbeats'}
                        </button>
                    </div>

                    <div className="dev-row">
                        <button className="btn-dev-outline" onClick={forceAllOnline}>
                            <Zap size={14} /> Force All Online
                        </button>
                    </div>

                    <div className="dev-status">
                        <small>Visible: {masterList.filter(d => d.visible).length}</small>
                        <small>Connected: {Object.values(devices).filter(d => d.connection === 'connected').length}</small>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevPulseHelper;