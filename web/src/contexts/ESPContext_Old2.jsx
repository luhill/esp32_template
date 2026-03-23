import { getDummyData } from "../services/espService";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

const ESPContext = createContext();

const ESPProvider = ({ children }) => {
    const isDev = import.meta.env.DEV;
    // Vite injects this at build time
    const isESP32 = import.meta.env.VITE_PLATFORM === 'ESP32';

    // --- 1. GLOBAL SETTINGS & ENVIRONMENT ---
    const [globalSettings, setGlobalSettings] = useState(() => {
        const saved = localStorage.getItem("global_settings");
        // Default to empty. If empty, HA features are hidden.
        return saved ? JSON.parse(saved) : { haHost: '' };
    });

    const updateGlobalSettings = (newSettings) => {
        setGlobalSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem("global_settings", JSON.stringify(updated));
            return updated;
        });
    };
        // --- FIX: Store multiple watchdogs, one per deviceId ---
    const watchdogs = useRef({});
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
    // Environment Detection
    const hostname = window.location.hostname;
    const isRemote = globalSettings.remoteDomain && hostname === globalSettings.remoteDomain;
    
    // An ESP32 usually serves from its own IP or a single hostname without a complex domain

    const [isInitialized, setIsInitialized] = useState(false);

    // --- 2. MASTER LIST (With Auto-Registration Logic) ---
    const [masterList, setMasterList] = useState(() => {
        const saved = localStorage.getItem("esp_fleet_config");
        let list = saved ? JSON.parse(saved) : [];

        if (list.length === 0) {
            if (isESP32) {
                // If served by ESP, it adds itself
                const currentHost = hostname.replace('.local', '');
                console.log(`🚀 ESP32 Mode: Auto-registering self (${currentHost})`);
                list.push({
                    host: currentHost,
                    name: currentHost,
                    tab: currentHost,
                    remote: "",
                    visible: true
                });
            } else {
                // Pi local dev/access: Leave empty or add a test
                console.log("🖥️ Pi/Local Mode: Waiting for user to add hardware.");
            }
        }
        return list;
    });
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

    // --- 3. DYNAMIC CONNECTION LOGIC ---
    const connectToDevice = useCallback((device) => {
        if (import.meta.env.DEV) return;

        const currentHost = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // 1. Determine if we are using the Pi Proxy
        // (We assume if the URL is your domain and NOT an ESP-specific build, it's the Pi)
        const isPiProxy = currentHost.includes('drnadiaelahi.com') && !isESP32;

        // 2. Format the target address
        const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(device.host);
        const target = isIp ? device.host : `${device.host}.local`;

        let url;
        if (isPiProxy) {
            // Use the Pi's Nginx Proxy tunnel
            url = `${protocol}//${currentHost}/esp_proxy/${target}/ws`;
        } else {
            // Direct connection (Works for Local Pi or Direct ESP access)
            url = `${protocol}//${target}/ws`;
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

            if ("home" in data || "settings" in data || "info" in data) {
                setDevices(prev => ({
                    ...prev,
                    [device.host]: { ...prev[device.host], ...data, status: "loaded", lastUpdate: Date.now() }
                }));
            } else {
                Object.keys(data).forEach(id => {
                    updateEspControl(device.host, id, data[id], false);
                });
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
    }, [isRemote, isESP32, globalSettings.remoteDomain, startWatchdog, stopWatchdog, updateEspControl]);

    // --- EXISTING HELPER FUNCTIONS (Persisted) ---
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
        // document.addEventListener('visibilitychange', wakeUpApp);
        // window.addEventListener('pageshow', wakeUpApp); // Specific for iOS back/forward cache
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
        consol.log("Loading dev data");
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

    const deleteDevice = (id) => {
        // 1. Find the device in the masterList to get its hostname
        const deviceToDelete = masterList.find(d => d.id === id);
        if (!deviceToDelete) return;

        const host = deviceToDelete.host;

        // 2. Kill the active WebSocket using the hostname
        const socket = sockets.current[host];
        if (socket) {
            console.log(`🛑 Closing connection for deleted device: ${host}`);
            socket.onclose = null; // Prevent watchdog from auto-restarting
            socket.close();
            delete sockets.current[host];
        }

        // 3. Stop the watchdog timer
        stopWatchdog(host);

        // 4. Remove from live devices state
        setDevices(prev => {
            const next = { ...prev };
            delete next[host];
            return next;
        });

        // 5. Remove from Master List (Persistence)
        setMasterList(prev => {
            const newList = prev.filter(d => d.id !== id);
            localStorage.setItem("esp_fleet_config", JSON.stringify(newList));
            return newList;
        });
    };

    const moveDevice = useCallback((oldIndex, newIndex) => {
    // 1. Functional update ensures we ALWAYS have the latest array, 
    // even if a WebSocket update just arrived.
    setMasterList((prevList) => {
        // Validation check
        if (newIndex < 0 || newIndex >= prevList.length) return prevList;

        const newList = Array.from(prevList);
        const [movedItem] = newList.splice(oldIndex, 1);
        newList.splice(newIndex, 0, movedItem);

        // 2. We move the heavy LocalStorage write 'outside' the main thread 
        // using a timeout. This prevents the 'Jumping' glitch on the iPhone 
        // by letting the DND animation finish first.
        setTimeout(() => {
            try {
                localStorage.setItem('esp_fleet_config', JSON.stringify(newList));
                
                // 3. Optional: Trigger your sync to the ESP32 here
                // syncToHardware(newList); 
            } catch (e) {
                console.error("Failed to save fleet config:", e);
            }
        }, 50);

        return newList;
    });
}, []); // Wrapped in useCallback if this is in a Context
    // 2. CRUD Functions for the UI
    const addDevice = (newDevice) => {
        // 1. Prevent empty or whitespace-only hosts
        if (!newDevice.host || !newDevice.host.trim()) return;

        setMasterList(prev => [
            ...prev,
            {
                ...newDevice,
                id: `dev-${Date.now()}`, // NEW: Permanent unique ID
                tab: newDevice.tab || "Home",
                visible: true
            }
        ]);
    };
    const toggleDeviceVisibility = useCallback((host) => {
        setMasterList(prev => {
            const newList = prev.map(d => d.host === host ? { ...d, visible: !d.visible } : d);
            return newList;
        });
    }, []);
    const updateDeviceConfig = (id, newData) => {
    setMasterList(prev => prev.map(device => {
        if (device.id === id) {
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



    const [pulseData, setPulseData] = useState({ ids: [], ts: 0 });
    const lockedControls = useRef({}); // { "pump": true, "led2": true }

    const setControlLock = useCallback((id, isLocked) => {
        if (isLocked) {
            lockedControls.current[id] = true;
        } else {
            delete lockedControls.current[id];
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("esp_fleet_config", JSON.stringify(masterList));
        if (masterList.length > 0) setIsInitialized(true);
    }, [masterList]);

    // Provide everything to the app
    const value = {
        masterList,
        setMasterList,
        isInitialized,
        isESP32,
        globalSettings,
        updateGlobalSettings,
        devices,
        // ... include all other existing functions ...
        connectToDevice,
        updateEspControl,
        sendMessage,
        TABS,
        getTabStatus,
        bulkRefresh,
        toggleDeviceVisibility,
        updateDeviceConfig,
        DEVICE_LIST,
        pulseData,
        setPulseData,
        setDevices,
        setControlLock,
        isDev,

    };

    return <ESPContext.Provider value={value}>{children}</ESPContext.Provider>;
};
const useESPContext = () => useContext(ESPContext);
export { ESPProvider, useESPContext };