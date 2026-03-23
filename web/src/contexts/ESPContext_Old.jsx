import { getDummyData } from "../services/espService";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const ESPContext = createContext();

const ESPProvider = ({ children }) => {
    // Inside your ESPProvider.jsx
    const [globalSettings, setGlobalSettings] = useState(() => {
        const saved = localStorage.getItem("global_settings");
        return saved ? JSON.parse(saved) : { remoteDomain: '', haSubdomain: '' };
    });

    const updateGlobalSettings = (newSettings) => {
        setGlobalSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem("global_settings", JSON.stringify(updated));
            return updated;
        });
    };
    const [isInitialized, setIsInitialized] = useState(false);
    const [masterList, setMasterList] = useState(() => {
        const saved = localStorage.getItem("esp_fleet_config");
        let list = saved ? JSON.parse(saved) : [];

        const hostname = window.location.hostname;
        const currentHost = hostname.replace('.local', '').replace('.drnadiaelahi.com', '');

        // 2. IGNORE "localhost", "127.0.0.1", AND your external domain
        const isRealHardware =
            currentHost !== 'localhost' &&
            currentHost !== '127.0.0.1' &&
            currentHost !== 'home' && // Ignores the "home" part of your domain
            !hostname.includes('drnadiaelahi.com');

        if (isRealHardware && list.length === 0) {
            //const exists = list.find(d => d.host === currentHost);

            //if (!exists) {
            console.log(`🆕 New Device Detected: Auto-registering ${currentHost}`);
            list.push({
                host: currentHost,
                name: currentHost,  // Default name
                tab: currentHost,   // Default tab = Host name
                remote: "",
                visible: true
            });
            //}
        } else if (list.length === 0) {
            console.log("🛠️ Dev Mode: Injecting Mock Device");
            list.push({
                host: "test", name: "Test", tab: "Test", remote: "", visible: true
            });
        }

        return list;
    });

    // Sync to LocalStorage on every change
    useEffect(() => {
        // 1. Persist the current list to storage
        localStorage.setItem("esp_fleet_config", JSON.stringify(masterList));

        // 2. Only mark as initialized if we actually have a list to work with
        // This "holds" the redirect until the fleet is ready.
        if (masterList && masterList.length > 0) {
            setIsInitialized(true);
        }
    }, [masterList]);
    // 1. FILTER: Only devices marked 'visible: true' are in the active DEVICE_LIST
    const DEVICE_LIST = masterList.filter(d => d.visible);
    // Group visible devices by their 'tab' property
    const TABS = useMemo(() => {
        const groups = {};
        masterList.filter(d => d.visible).forEach(device => {
            const tabName = device.tab || "General";
            if (!groups[tabName]) groups[tabName] = { name: tabName, devices: [] };
            groups[tabName].devices.push(device);
        });
        return Object.values(groups);
    }, [masterList]);



    // 3. Reordering Logic
    const moveDevice = (host, direction) => {
        setMasterList(prev => {
            const index = prev.findIndex(d => d.host === host);
            if (index < 0) return prev;
            const next = [...prev];
            const newIndex = index + direction;
            if (newIndex >= 0 && newIndex < next.length) {
                [next[index], next[newIndex]] = [next[newIndex], next[index]];
            }
            return next;
        });
    };
    // 2. CRUD Functions for the UI
    const addDevice = (newDevice) => {
        if (!newDevice.host) return;
        setMasterList(prev => [...prev, {
            ...newDevice,
            tab: newDevice.tab || "General", // Default if empty
            visible: true
        }]);
    };
    const deleteDevice = (host) => {
        // 1. Get the current socket for this host
        const socket = devices[host]?.socket;

        // 2. If it exists, kill it immediately
        if (socket) {
            console.log(`🛑 Closing connection for deleted device: ${host}`);

            // Remove the onclose listener so the watchdog doesn't 
            // think this was an "accidental" disconnect and try to reconnect
            socket.onclose = null;
            socket.close();
        }

        // 3. Remove the device data from the live 'devices' object
        setDevices(prev => {
            const newDevices = { ...prev };
            delete newDevices[host];
            return newDevices;
        });

        // 4. Finally, remove it from the masterList (the UI list)
        setMasterList(prev => prev.filter(d => d.host !== host));
    };
    const toggleDeviceVisibility = useCallback((host) => {
        setMasterList(prev => {
            const newList = prev.map(d => d.host === host ? { ...d, visible: !d.visible } : d);
            return newList;
        });
    }, []);
    const updateDeviceConfig = (oldHost, newData) => {
        setMasterList(prev => prev.map(device => {
            if (device.host === oldHost) {
                // 💡 THE FIX: Only spread the NEW data onto the OLD device.
                // If newData is { name: "New Name" }, it won't touch the 'host' key.
                return { ...device, ...newData };
            }
            return device;
        }));
    };
    // Initialise state with these defaults
    const [devices, setDevices] = useState(() => {
        const initial = {};
        DEVICE_LIST.forEach(d => {
            initial[d.host] = { ...d, status: "loading", connection: "disconnected" };
        });
        return initial;
    });

    // 2. Aggregate Status Function (Returns 'online', 'partial', or 'offline')
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

    const sockets = useRef({});
    // --- FIX: Store multiple watchdogs, one per deviceId ---
    const watchdogs = useRef({});
    const isDev = import.meta.env.DEV;

    const stopWatchdog = useCallback((host) => {
        if (watchdogs.current[host]) {
            clearTimeout(watchdogs.current[host]);
            delete watchdogs.current[host];
        }
    }, []);

    const startWatchdog = useCallback((host, isInitial = false) => {
        stopWatchdog(host);
        const timeout = isInitial ? 10000 : 5000;
        watchdogs.current[host] = setTimeout(() => {
            console.warn(`Watchdog: Heartbeat lost for ${host}`);
            setDevices(prev => ({
                ...prev,
                [host]: { ...prev[host], connection: "disconnected" }
            }));
            sockets.current[host]?.close();
        }, timeout);
    }, [stopWatchdog]);

    const sendMessage = useCallback((host, id, value) => {
        if (isDev) {
            // --- EMULATE ESP32 MESSAGE ---
            const payload = { [id]: value };
            console.log(
                `%c[OUTGOING to ${host.toUpperCase()}] %c${JSON.stringify(payload)}`,
                "color: #007bff; font-weight: bold;", // Blue for "Outgoing"
                "color: #28a745; font-weight: normal;" // Green for the JSON
            );
            return;
        }

        const ws = sockets.current[host];
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ [id]: value }));
        }
    }, [isDev]);

    const updateEspControl = useCallback((host, idToUpdate, newValueOrObject, updateHost = true) => {
        setDevices(prev => {
            const device = prev[host];
            if (!device || device.status !== "loaded") return prev;

            // Find group logic (Home, Settings, etc)
            const groupName = Object.keys(device).find(group =>
                device[group] && typeof device[group] === 'object' && device[group][idToUpdate]
            );

            if (!groupName) return prev;

            const currentControl = device[groupName][idToUpdate];
            const isObjectMerge = typeof newValueOrObject === 'object' &&
                newValueOrObject !== null &&
                typeof currentControl.value === 'object';

            return {
                ...prev,
                [host]: {
                    ...device,
                    lastUpdate: Date.now(),
                    [groupName]: {
                        ...device[groupName],
                        [idToUpdate]: {
                            ...currentControl,
                            value: isObjectMerge ? { ...currentControl.value, ...newValueOrObject } : newValueOrObject
                        }
                    }
                }
            };
        });

        if (updateHost) sendMessage(host, idToUpdate, newValueOrObject);
    }, [sendMessage]);

    const [pulseData, setPulseData] = useState({ ids: [], ts: 0 });
    const lockedControls = useRef({}); // { "pump": true, "led2": true }

    const setControlLock = useCallback((id, isLocked) => {
        if (isLocked) {
            lockedControls.current[id] = true;
        } else {
            delete lockedControls.current[id];
        }
    }, []);

    const connectToDevice = useCallback((device) => {
        // --- FIX: Guard to prevent WebSocket attempts in Dev Mode ---
        if (isDev) return;

        // --- THE CRITICAL GUARD ---
        const existingSocket = sockets.current[device.host];
        if (existingSocket) {
            if (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING) {
                console.log(`🔌 Already connecting/connected to ${device.host}, skipping.`);
                return;
            }
        }

        // 1. Check if the host is an IP address (e.g., contains 4 groups of numbers)
        const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(device.host);

        // 2. Build the correct target (don't append .local if it's already an IP)
        const targetHost = isIp ? device.host : `${device.host}.local`;

        // 3. Construct the URL based on Remote vs Local
        const hostname = window.location.hostname;
        const isRemote = hostname === "home.drnadiaelahi.com";
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        let url;
        if (isRemote) {
            // REMOTE: /esp_proxy/10.0.0.50/ws OR /esp_proxy/test2.local/ws
            url = `${protocol}//${hostname}/esp_proxy/${targetHost}/ws`;
            console.log(`🌍 Remote Proxy: ${url}`);
        } else {
            // LOCAL: ws://10.0.0.50/ws OR ws://test2.local/ws
            url = `${protocol}//${targetHost}/ws`;
            console.log(`🏠 Local Direct: ${url}`);
        }

        const ws = new WebSocket(url);

        ws.onopen = () => {
            setDevices(prev => ({
                ...prev,
                [device.host]: { ...prev[device.host], connection: "connected" }
            }));
            startWatchdog(device.host, true);
        };

        ws.onmessage = (e) => {
            startWatchdog(device.host);
            const data = JSON.parse(e.data);

            // 1. SCENARIO A: Full State (Initial/Sync)
            if ("home" in data || "settings" in data || "info" in data) {
                setDevices(prev => ({
                    ...prev,
                    [device.host]: {
                        ...prev[device.host],
                        ...data, // Merges top-level keys
                        lastUpdate: Date.now(),
                        status: "loaded"
                    }
                }));

                const allIds = [];
                ['home', 'settings', 'info'].forEach(group => {
                    if (data[group]) {
                        allIds.push(...Object.keys(data[group]));
                    }
                });

                if (allIds.length > 0) {
                    setPulseData({ ids: allIds, ts: Date.now() });
                }
                return; // Exit Scenario A
            }

            // 2. SCENARIO B: Partial Updates
            Object.keys(data).forEach(id => {
                setPulseData({ ids: [id], ts: Date.now() });
                if (lockedControls.current[id]) {
                    console.log(`🛡️ Collision blocked for: ${id}`);
                    return;
                }
                updateEspControl(device.host, id, data[id], false);
            });
        };

        ws.onclose = () => {
            stopWatchdog(device.host);
            setDevices(prev => ({ ...prev, [device.host]: { ...prev[device.host], connection: "disconnected" } }));

            if (sockets.current[device.host] === ws) {
                console.log(`♻️ Socket for ${device.host} closed, retrying in 3s...`);
                setTimeout(() => connectToDevice(device), 3000);
            }
        };

        sockets.current[device.host] = ws;
    }, [isDev, startWatchdog, stopWatchdog, updateEspControl]); // Added updateEspControl to dependencies        
    // const connectToDevice = useCallback((device) => {
    //     // --- FIX: Guard to prevent WebSocket attempts in Dev Mode ---
    //     if (isDev) return;

    //     // --- THE CRITICAL GUARD ---
    //     const existingSocket = sockets.current[device.host];
    //     if (existingSocket) {
    //         // If it's already open or currently trying to connect, DO NOT start a new one.
    //         if (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING) {
    //             console.log(`🔌 Already connecting/connected to ${device.host}, skipping.`);
    //             return;
    //         }
    //     }

    //     //const host = isDev ? device.host : device.remote;
    //     const host = `${device.host}.local`;n
    //     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    //     const url = `${protocol}//${host}/ws`;

    //     console.log(`Connecting to ${device.host} at ${url}`);
    //     const ws = new WebSocket(url);

    //     ws.onopen = () => {
    //         setDevices(prev => ({
    //             ...prev,
    //             [device.host]: { ...prev[device.host], connection: "connected" /*, name: device.name*/ }
    //         }));
    //         startWatchdog(device.host, true);
    //     };

    //     ws.onmessage = (e) => {
    //         startWatchdog(device.host);
    //         const data = JSON.parse(e.data);

    //         // 1. SCENARIO A: Full State (Initial/Sync)
    //         // If the JSON has the high-level 'home' or 'settings' keys
    //         setDevices(prev => ({
    //             ...prev,
    //             [device.host]: {
    //                 ...prev[device.host],
    //                 ...data, // Merges top-level keys
    //                 lastUpdate: Date.now(),
    //                 status: "loaded"
    //             }
    //         }));

    //         // --- 2. SCENARIO A: Full State (Initial/Sync) ---
    //         // --- 2. SCENARIO A: Full State (Initial/Sync) ---
    //         if ("home" in data || "settings" in data || "info" in data) {
    //             const allIds = [];

    //             // Extract IDs from each group to trigger the "ripple" on every control
    //             ['home', 'settings', 'info'].forEach(group => {
    //                 if (data[group]) {
    //                     allIds.push(...Object.keys(data[group]));
    //                 }
    //             });

    //             if (allIds.length > 0) {
    //                 setPulseData({ ids: allIds, ts: Date.now() });
    //             }

    //             return; // Exit Scenario A
    //         }

    //         // 2. SCENARIO B: Partial Updates (Reusing updateEspControl)
    //         // Loop through flat keys like {"pump": {"on": true}}
    //         Object.keys(data).forEach(id => {
    //             // A. Trigger the 'Inward Ripple' animation for this specific control
    //             setPulseData({ ids: [id], ts: Date.now() });
    //             if (lockedControls.current[id]) {
    //                 console.log(`🛡️ Collision blocked for: ${id}`);
    //                 return;
    //             }
    //         // B. Call the established helper to find the group and patch the state.
    //             // IMPORTANT: 'false' as the last argument prevents an infinite loop
    //             // (don't send the command back to the hardware that just sent it to us).
    //             updateEspControl(device.host, id, data[id], false);
    //         });
    //     };

    //     ws.onclose = () => {
    //         stopWatchdog(device.host);
    //         setDevices(prev => ({ ...prev, [device.host]: { ...prev[device.host], connection: "disconnected" } }));

    //         // Check if THIS specific socket is still the one we care about
    //         // If we've already replaced it during a 'wake-up', don't trigger the timeout
    //         if (sockets.current[device.host] === ws) {
    //             console.log(`♻️ Socket for ${device.host} closed, retrying in 3s...`);
    //             setTimeout(() => connectToDevice(device), 3000);
    //         }
    //     };

    //     sockets.current[device.host] = ws;
    // }, [isDev, startWatchdog, stopWatchdog]);
    useEffect(() => {
        const wakeUpApp = () => {
            // Only trigger if we are now visible
            if (document.visibilityState === 'visible') {
                console.log("📱 iPhone Wake-up: Resetting connections...");

                masterList.forEach(device => {
                    const currentSocket = sockets.current[device.host];

                    // 1. Force-close any existing socket to clear 'zombie' states
                    if (currentSocket) {
                        currentSocket.onclose = null; // Prevent the old onclose from firing
                        currentSocket.close();
                        delete sockets.current[device.host];
                    }

                    // 2. Immediately attempt a fresh connection
                    if (device.visible) {
                        connectToDevice(device);
                    }
                });
            }
        };

        // Listen for both visibility change AND focus for maximum reliability on iOS
        document.addEventListener('visibilitychange', wakeUpApp);
        window.addEventListener('pageshow', wakeUpApp); // Specific for iOS back/forward cache
        //window.addEventListener('focus', wakeUpApp);

        return () => {
            document.removeEventListener('visibilitychange', wakeUpApp);
            window.removeEventListener('pageshow', wakeUpApp);
            //window.removeEventListener('focus', wakeUpApp);
        };
    }, [masterList, connectToDevice]);
    const visibleHosts = masterList
        .filter(d => d.visible)
        .map(d => d.host)
        .join(',');

    useEffect(() => {
        if (isDev) return;

        const activeHostsSet = new Set(masterList.filter(d => d.visible).map(d => d.host));

        // 2. CLOSE logic
        Object.keys(sockets.current).forEach(host => {
            if (!activeHostsSet.has(host)) {
                const ws = sockets.current[host];
                if (ws) {
                    ws.onclose = null;
                    ws.close();
                }
                delete sockets.current[host];
                stopWatchdog(host);
            }
        });

        // 3. OPEN logic
        masterList.forEach(device => {
            if (device.visible && !sockets.current[device.host]) {
                connectToDevice(device);
            }
        });

        // Now 'visibleHosts' is in scope and correctly prevents re-runs on slider moves
    }, [visibleHosts, isDev, connectToDevice, stopWatchdog]);

    // --- Dummy Data Handling ---
    useEffect(() => {
        if (!isDev) return;

        const loadDevData = async () => {
            try {
                const data = await getDummyData(); // Fetches your dummy JSON

                setDevices(prev => {
                    const next = { ...prev };

                    // Merge each device from the dummy JSON into the state
                    Object.keys(data).forEach(id => {
                        if (next[id]) {
                            next[id] = {
                                ...next[id],    // Keep initial DEVICE_LIST properties
                                ...data[id],    // Overwrite with Dummy JSON (including name)
                                status: "loaded",
                                connection: "connected",
                                lastUpdate: Date.now()
                            };
                        }
                    });
                    return next;
                });
            } catch (err) {
                console.error("Dev: Failed to load dummy data", err);
            }
        };
        loadDevData();
    }, [isDev]);

    const bulkRefresh = useCallback(() => {
        console.log("🚀 Sending bulk refresh to all connected devices...");

        // Iterate through all active WebSocket instances
        Object.entries(sockets.current).forEach(([host, ws]) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ cmd: "refresh" }));
            }
        });
    }, []);

    const value = {
        masterList,
        isInitialized,
        addDevice,
        moveDevice,
        deleteDevice,
        toggleDeviceVisibility,
        updateDeviceConfig,
        devices,
        DEVICE_LIST,
        updateEspControl,
        sendMessage,
        TABS,
        getTabStatus,
        bulkRefresh,
        pulseData,
        setPulseData,
        setDevices,
        setControlLock,
        globalSettings,
        updateGlobalSettings
    };

    return <ESPContext.Provider value={value}>{children}</ESPContext.Provider>;
};

const useESPContext = () => useContext(ESPContext);
export { ESPProvider, useESPContext };