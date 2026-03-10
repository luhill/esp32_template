
import { getDummyData } from "../services/espService";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const ESPContext = createContext();
//export const useESPContext = () => useContext(ESPContext);

const ESPProvider = ({ children }) => {
    const [espData, setEspData] = useState({ app_name: "App", connection: "disconnected", status: "loading" });
    const ws = useRef(null);
    const watchdog = useRef(null);

    // 1. STABLE SEND FUNCTION
    const sendMessage = useCallback((id, value) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ [id]: value }));
        }
    }, []);

    // 2. STABLE UPDATE FUNCTION (Moved UP, uses functional updates to avoid dependencies)
    const updateEspControl = useCallback((idToUpdate, newValueOrObject, updateHost = true) => {
        setEspData(prevData => {
            if (prevData.status !== "loaded") return prevData;

            const groupName = Object.keys(prevData).find(group =>
                prevData[group] && typeof prevData[group] === 'object' && prevData[group][idToUpdate]
            );

            if (!groupName) return prevData;

            const currentControl = prevData[groupName][idToUpdate];
            const isObjectMerge = typeof newValueOrObject === 'object' &&
                newValueOrObject !== null &&
                typeof currentControl.value === 'object';

            return {
                ...prevData,
                [groupName]: {
                    ...prevData[groupName],
                    [idToUpdate]: {
                        ...currentControl,
                        value: isObjectMerge ? { ...currentControl.value, ...newValueOrObject } : newValueOrObject
                    }
                }
            };
        });

        if (updateHost) sendMessage(idToUpdate, newValueOrObject);
    }, [sendMessage]); // Only depends on sendMessage which is now stable

    // 3. WEBSOCKET EFFECT
    useEffect(() => {
        const isDev = import.meta.env.DEV;
        if (ws.current) return;
        if (isDev) {
            console.log("DEV MODE: WebSocket connection skipped. Using dummy data.");
            // Set connection to "connected" immediately so UI doesn't show "Disconnected"
            setEspData(prev => ({ ...prev, connection: "connected" }));
            return;
        }
        const stopWatchdog = () => {
            if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
        };

        const startWatchdog = (isInitial = false) => {
            stopWatchdog();
            watchdog.current = setTimeout(() => {
                console.log("Heartbeat lost. Attempting reconnect in 2sec...")
                setEspData(prev => ({ ...prev, connection: "disconnected" }));
                ws.current?.close();
            }, isInitial ? 10000 : 5000);
        };

        const handleMessage = (e) => {
            startWatchdog();
            const data = JSON.parse(e.data);

            if ("home" in data || "settings" in data) {
                setEspData(prev => ({ ...prev, connection: "connected", status: "loaded", ...data }));
                return;
            }

            Object.keys(data).forEach(key => {
                if (typeof data[key] === 'object') {
                    updateEspControl(key, data[key], false); // No loop: updateHost is false
                }
            });
        };

        const connect = () => {
            console.log("Attempting connection");
            stopWatchdog();
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws.current = new WebSocket(`${protocol}//${window.location.hostname}/ws`);

            ws.current.onopen = () => {
                console.log("Websocket opened");
                setEspData(prev => ({ ...prev, connection: "connected" }));
                startWatchdog(true);
            };

            ws.current.onclose = () => {
                stopWatchdog();
                setEspData(prev => ({ ...prev, connection: "disconnected" }));
                setTimeout(connect, 2000);
            };

            ws.current.onmessage = handleMessage;
        };

        connect();
        return () => {
            stopWatchdog();
            if (ws.current) { ws.current.onclose = null; ws.current.close(); }
        };
    }, [updateEspControl]); // <--- Now legal because updateEspControl is memoized above

    const [extra_controls, setExtraControls] = useState([])
    useEffect(() => {
        const stored = localStorage.getItem("extra_controls");
        if (stored) setExtraControls(JSON.parse(stored));
    }, []);

    useEffect(() => {
        localStorage.setItem('extra_controls', JSON.stringify(extra_controls));
    }, [extra_controls]);

    const [dummyData, setDummyData] = useState({
        app_name: "App",
        connection: "disconnected",
        status: "loading",
        //controls: {}
    })
    useEffect(() => {
        const isDev = import.meta.env.DEV;
        if (!isDev) return; // Skip dummy data on the actual ESP32
        const loadDummyData = async () => {
            try {
                // 1. Fetch your JSON (which now has 'controls', 'settings', and 'app_name')
                const fetchedData = await getDummyData();

                setDummyData(prevData => ({
                    ...prevData,
                    status: "loaded",
                    // 2. Spread the entire result. 
                    // This handles 'controls', 'settings', 'app_name' etc. automatically
                    ...fetchedData
                }));

                console.log("Dummy Data Loaded:", fetchedData);
            } catch (err) {
                console.error("Failed to load dummy data:", err);
                setDummyData(prev => ({ ...prev, status: "error", message: err.message }));
            }
        };
        loadDummyData();
    }, []);
    const updateDummyControl = (idToUpdate, newValueOrObject, updateHost = true) => {
        if (dummyData.status !== "loaded") {
            console.log(`Unable to update dummy. Status: ${dummyData.status}`);
            return;
        }

        setDummyData(prevData => {
            // 1. Find which group contains the ID (controls, settings, etc.)
            const groupName = Object.keys(prevData).find(group =>
                typeof prevData[group] === 'object' &&
                prevData[group] !== null &&
                prevData[group][idToUpdate]
            );

            if (!groupName) {
                console.error(`Dummy ID ${idToUpdate} not found in any group.`);
                return prevData;
            }

            const currentControl = prevData[groupName][idToUpdate];

            // 2. Determine if we are merging a sub-object (like color {r,g,b}) 
            // or replacing a primitive (like bool or int)
            const isObjectMerge =
                typeof newValueOrObject === 'object' &&
                newValueOrObject !== null &&
                typeof currentControl.value === 'object';

            return {
                ...prevData,
                [groupName]: {
                    ...prevData[groupName],
                    [idToUpdate]: {
                        ...currentControl,
                        value: isObjectMerge
                            ? { ...currentControl.value, ...newValueOrObject }
                            : newValueOrObject
                    }
                }
            };
        });

        if (updateHost) {
            // Log exactly what would be sent to the ESP32
            console.log("Simulated WebSocket Send:", JSON.stringify({ [idToUpdate]: newValueOrObject }));
        }
    };

    useEffect(() => {
        // ... (Your existing document.title logic remains same)
        document.title = espData.status === 'loaded' ? espData.app_name : `${espData.app_name} — ${espData.status}`;
    }, [espData.status, espData.app_name]);

    const value = {
        espData,
        dummyData,
        updateDummyControl,
        updateEspControl,
        sendMessage // Exporting this makes it available for Siri-like manual triggers
    };

    return <ESPContext.Provider value={value}>{children}</ESPContext.Provider>;
};
const useESPContext = () => useContext(ESPContext);
export { ESPProvider, useESPContext };

