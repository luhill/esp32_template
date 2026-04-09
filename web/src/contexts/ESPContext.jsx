import { getDummyData } from "../services/espService";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const ESPContext = createContext();

const ESPProvider = ({ children }) => {
    const isDev = import.meta.env.DEV;
    const isESP32 = import.meta.env.VITE_PLATFORM === 'ESP32';
    const [isInitialized, setIsInitialized] = useState(false); // Make sure this is exported
    // --- 1. STATE & PERSISTENCE ---
    const [globalSettings, setGlobalSettings] = useState(() => {
        const saved = localStorage.getItem("global_settings");
        const defaultSettings = { haHost: '', showShortcuts: true };

        if (!saved) return defaultSettings;

        const parsed = JSON.parse(saved);
        // Use spread to ensure new defaults (like showShortcuts) exist 
        // even if the user has an old 'haHost' saved.
        return { ...defaultSettings, ...parsed };
    });

    // Helper to update settings
    const updateGlobalSettings = (newSettings) => {
        setGlobalSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem("global_settings", JSON.stringify(updated));
            return updated;
        });
    };

    const [masterList, setMasterList] = useState(() => {
        const saved = localStorage.getItem("esp_fleet_config");
        let list = saved ? JSON.parse(saved) : [];
        if (list.length === 0 && isESP32) {
            const currentHost = window.location.hostname.replace('.local', '');
            list.push({ host: currentHost, name: currentHost, tab: 'General', visible: true });
        }
        return list;
    });

    // devices state stores the dynamic data (IP, Version, Controls)
    const [devices, setDevices] = useState({});

    // pulseData tracks { [host]: { id: 'control_id', ts: Date.now() } }
    const [pulseData, setPulseData] = useState({});

    // --- 2. REFS ---
    const sockets = useRef({});
    const watchdogs = useRef({});
    // const lockedControls = useRef({});
    // const setControlLock = useCallback((id, isLocked) => {
    //     if (isLocked) {
    //         lockedControls.current[id] = true;
    //     } else {
    //         // Use a small delay before unlocking to catch any "stale" 
    //         // messages still in the WebSocket buffer
    //         setTimeout(() => {
    //             delete lockedControls.current[id];
    //         }, 100);
    //     }
    // }, []);
    // --- 3. CONNECTION HELPERS ---
    const stopWatchdog = useCallback((host) => {
        if (watchdogs.current[host]) {
            clearTimeout(watchdogs.current[host]);
            delete watchdogs.current[host];
        }
    }, []);

    const startWatchdog = useCallback((host, isInitial = false) => {
        stopWatchdog(host);
        watchdogs.current[host] = setTimeout(() => {
            console.warn(`Watchdog: Lost ${host}`);
            setDevices(prev => ({
                ...prev,
                [host]: { ...prev[host], connection: "disconnected" }
            }));
            sockets.current[host]?.close();
        }, isInitial ? 10000 : 5000);
    }, [stopWatchdog]);

    const sendMessage = useCallback((host, id, value) => {
        if (isDev) {
            console.log(`%c[OUTGOING to ${host}] %c${id}: ${JSON.stringify(value)}`, "color: #007bff", "color: #28a745");
            return;
        }
        const ws = sockets.current[host];
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ [id]: value }));
        }
    }, [isDev]);

    // --- 4. CORE LOGIC ---
    const updateEspControl = useCallback((host, idToUpdate, newValueOrObject, updateHost = true) => {
        // We use setDevices(prev => ...) to get the latest state without needing 'devices' in the dependency array
        setDevices(prev => {
            const device = prev[host];

            // Safety check inside the setter
            if (!device || device.status !== "loaded") {
                // Note: logging inside a setter is fine for debugging, but this is why it was failing before
                return prev;
            }

            // 1. Find the group using 'device' (which is now fresh from 'prev')
            let groupName = Object.keys(device).find(group =>
                device[group] &&
                typeof device[group] === 'object' &&
                Object.prototype.hasOwnProperty.call(device[group], idToUpdate)
            );

            if (!groupName && device[idToUpdate]) groupName = idToUpdate;
            if (!groupName) return prev;

            const currentControl = device[groupName][idToUpdate];
            if (!currentControl) return prev;

            const currentValue = currentControl.value;
            const isIncomingObject = typeof newValueOrObject === 'object' && newValueOrObject !== null;
            const isCurrentObject = typeof currentValue === 'object' && currentValue !== null;

            const finalValue = (isIncomingObject && isCurrentObject)
                ? { ...currentValue, ...newValueOrObject }
                : newValueOrObject;

            // 2. Return the new state object
            return {
                ...prev,
                [host]: {
                    ...prev[host],
                    lastUpdate: Date.now(),
                    [groupName]: {
                        ...prev[host][groupName],
                        [idToUpdate]: {
                            ...prev[host][groupName][idToUpdate],
                            value: finalValue
                        }
                    }
                }
            };
        });

        // 3. Trigger Animation (Outside the setter)
        setPulseData(prevPulse => ({
            ...prevPulse,
            [host]: { id: idToUpdate, ts: Date.now() }
        }));

        // 4. Update Hardware
        if (updateHost) {
            sendMessage(host, idToUpdate, newValueOrObject);
        }
    }, [sendMessage]); // REMOVED 'devices' from here!

    const connectToDevice = useCallback((device) => {
        if (import.meta.env.DEV) return;

        const windowHost = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = device.host;

        // --- THE CRITICAL GUARD (RE-INSTATED) ---
        const existingSocket = sockets.current[host];
        if (existingSocket) {
            // If it's already working, don't touch it!
            if (existingSocket.readyState === WebSocket.OPEN) {
                console.log(`📡 ${host} is already OPEN. Requesting refresh instead.`);
                existingSocket.send(JSON.stringify({ get: "all" })); // Optional: Sync data
                return;
            }
            // If it's currently handshaking, just wait.
            if (existingSocket.readyState === WebSocket.CONNECTING) {
                console.log(`⏳ ${host} is already connecting... skipping.`);
                return;
            }

            // If it's CLOSED or CLOSING, clean up the dead object before continuing
            try { existingSocket.close(); } catch (e) { }
            delete sockets.current[host];
        }
        // 1. Determine if we are using the Pi Proxy
        // (We assume if the URL is your domain and NOT an ESP-specific build, it's the Pi)

        // 2. Format the target address
        const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
        const target = isIp ? host: `${host}.local`;

        let url;
        if (isESP32) {
           // Direct connection (Works for Local Pi or Direct ESP access)
            url = `${protocol}//${target}/ws`; 
        } else {
            // Use the Pi's Nginx Proxy tunnel
            url = `${protocol}//${windowHost}/esp_proxy/${target}/ws`;
        }

        const ws = new WebSocket(url);
        sockets.current[host] = ws;
        ws.onopen = () => {
            setDevices(prev => ({
                ...prev,
                [device.host]: { ...prev[device.host], connection: "connected" }
            }));
            startWatchdog(device.host, true);
        };

        ws.onmessage = (e) => {
            // 1. Reset the watchdog immediately
            startWatchdog(device.host);

            let data;
            try {
                data = JSON.parse(e.data);
            } catch (err) {
                console.error("Malformed WS data:", e.data);
                return;
            }

            // 2. Handle the "Simple Heartbeat" or specialized signals
            // If it's just {"h":1}, we just update the timestamp and move on.
            if (data.h) {
                setDevices(prev => ({
                    ...prev,
                    [device.host]: { ...prev[device.host], lastUpdate: Date.now() }
                }));
                return;
            }

            // 3. Handle Full Config Sync (Initial connection or Refresh)
            // --- 2. FULL CONFIG SYNC ---
            if ("home" in data || "settings" in data || "info" in data) {
                // A. Update Device State
                setDevices(prev => ({
                    ...prev,
                    [device.host]: {
                        ...prev[device.host],
                        ...data,
                        ip: data.info?.ip || prev[device.host]?.ip,
                        status: "loaded",
                        lastUpdate: Date.now()
                    }
                }));

                // B. MASS PULSE: Extract all control IDs from the sync
                const allControlIds = [
                    ...Object.keys(data.home || {}),
                    ...Object.keys(data.settings || {}),
                    ...Object.keys(data.info || {})
                ];

                if (allControlIds.length > 0) {
                    setPulseData(prev => ({
                        ...prev,
                        [device.host]: {
                            ids: allControlIds, // Note: changed 'id' to 'ids' for mass pulse
                            ts: Date.now()
                        }
                    }));

                    // Auto-clear after animation
                    setTimeout(() => {
                        setPulseData(prev => {
                            const next = { ...prev };
                            delete next[device.host];
                            return next;
                        });
                    }, 800);
                }
            }
            // 4. Handle Partial Updates (User toggles, sensor changes)
            else {
                Object.keys(data).forEach(id => {
                    // 1. THE SHIELD CHECK
                    // if (lockedControls.current[id]) {
                    //     console.log(`🛡️ Shield: Denied hardware override for ${id}. Pulsing instead.`);

                    //     // Trigger the pulse even though we are rejecting the state change
                    //     setPulseData(prev => ({
                    //         ...prev,
                    //         [device.host]: { id: id, ts: Date.now() } // Use 'id' from the loop
                    //     }));

                    //     return; // Exit here so updateEspControl isn't called
                    // }

                    // 2. NORMAL UPDATE
                    // If not locked, update the React state with the hardware's value
                    updateEspControl(device.host, id, data[id], false);
                });

                // Ensure the device block itself shows a fresh timestamp even for partials
                setDevices(prev => ({
                    ...prev,
                    [device.host]: { ...prev[device.host], lastUpdate: Date.now() }
                }));
            }
        };

        ws.onclose = () => {
            stopWatchdog(device.host);
            setDevices(prev => ({ ...prev, [device.host]: { ...prev[device.host], connection: "disconnected" } }));
            if (sockets.current[device.host] === ws) {
                setTimeout(() => connectToDevice(device), 3000);
            }
        };
        sockets.current[device.host] = ws;
    }, [isDev, startWatchdog, stopWatchdog, updateEspControl]);

    // --- 5. EFFECTS ---
    // Lifecycle: Sync connections with masterList visibility
    useEffect(() => {
        const activeHosts = new Set(masterList.filter(d => d.visible).map(d => d.host));

        Object.keys(sockets.current).forEach(host => {
            if (!activeHosts.has(host)) {
                sockets.current[host].close();
                delete sockets.current[host];
                stopWatchdog(host);
            }
        });

        masterList.forEach(device => {
            if (device.visible && !sockets.current[device.host]) {
                connectToDevice(device);
            }
        });
    }, [masterList, connectToDevice, stopWatchdog]);

    const TABS = useMemo(() => {
        const groups = {};
        masterList.filter(d => d.visible).forEach(device => {
            const tabName = device.tab || "General";
            if (!groups[tabName]) groups[tabName] = { name: tabName, devices: [] };
            groups[tabName].devices.push(device);
        });
        return Object.values(groups);
    }, [masterList]);
    const getTabStatus = useCallback((tabName) => {
        const tab = TABS.find(t => t.name === tabName);
        if (!tab) return 'offline';

        const statuses = tab.devices.map(d => devices[d.host]?.connection || 'disconnected');

        const allConnected = statuses.every(s => s === 'connected');
        const someConnected = statuses.some(s => s === 'connected');

        if (allConnected) return 'online';   // All Green
        if (someConnected) return 'partial';  // Yellow (Mixed)
        return 'offline';                     // All Red
    }, [TABS, devices]);

    // --- 6. DEVELOPMENT DUMMY DATA ---
    useEffect(() => {
        if (!isDev) {
            // In Production, initialization happens when masterList is loaded
            if (masterList.length > 0) setIsInitialized(true);
            return;
        }

        const loadDevData = async () => {
            try {
                const stringData = await getDummyData();
                let data;
                try {
                    data = JSON.parse(stringData);
                } catch (err) {
                    console.error("Malformed Dev data:", stringData);
                    return;
                }
                setDevices(prev => {
                    const next = { ...prev };
                    // Map dummy data to the hosts in your masterList
                    masterList.forEach(dev => {
                        if (data[dev.host]) {
                            next[dev.host] = {
                                ...dev,
                                ...data[dev.host],
                                status: "loaded",
                                connection: "connected",
                                lastUpdate: Date.now()
                            };
                        }
                    });
                    return next;
                });
                // CRITICAL: Set initialized to true so the ControlsPage renders
                setIsInitialized(true);
            } catch (err) {
                console.error("🛠️ Dev Error:", err);
            }
        };

        if (masterList.length > 0) loadDevData();
        else setIsInitialized(true); // Allow empty state to show
    }, [isDev, masterList]);
    
    useEffect(() => {
        const handleWakeUp = () => {
            // Only run if the page is actually visible
            if (document.visibilityState === 'visible') {
                console.log("📱 App Wake-up: Checking connections...");

                masterList.forEach(device => {
                    const ws = sockets.current[device.host];

                    // Case 1: WebSocket exists and is OPEN
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        console.log(`🔄 ${device.host} is alive. Requesting refresh...`);
                        // Send a 'get' or empty config request to force a state sync
                        ws.send(JSON.stringify({ cmd: "refresh" }));
                    }
                    // Case 2: WebSocket is closed, broken, or missing
                    else {
                        console.log(`🔌 ${device.host} connection stale. Reconnecting...`);
                        // This will trigger your existing connection logic
                        connectToDevice(device);
                    }
                });
            }
        };

        // Listen for tab switching / phone unlocking
        document.addEventListener('visibilitychange', handleWakeUp);
        // Listen for window focus (good for desktop returning from other apps)
        window.addEventListener('focus', handleWakeUp);

        return () => {
            document.removeEventListener('visibilitychange', handleWakeUp);
            window.removeEventListener('focus', handleWakeUp);
        };
    }, [masterList, connectToDevice]);
    
    const value = {
        masterList, setMasterList,
        devices, setDevices,
        globalSettings,
        updateGlobalSettings,
        TABS,
        isInitialized,
        pulseData, setPulseData,
        updateEspControl,
        getTabStatus,
        sendMessage,
        bulkRefresh: () => {
            Object.values(sockets.current).forEach(ws => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ cmd: "refresh" })));
        },
        clearNVS: (targetHost) => {
            const ws = sockets.current[targetHost];
            ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ cmd: "clearNVS" }));
        }
    };

    return <ESPContext.Provider value={value}>{children}</ESPContext.Provider>;
};

const useESPContext = () => useContext(ESPContext);
export { ESPProvider, useESPContext };