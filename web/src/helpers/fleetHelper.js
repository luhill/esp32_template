/**
 * fleetHelpers.js
 * Pure logic for managing the ESP32 device list.
 */

// 1. SANITIZE HOSTNAME
export const sanitizeHost = (val) => {
    return val.toLowerCase()
              .replace(/\s+/g, '-') 
              .replace(/[^a-z0-9-]/g, '');
};

// 2. CREATE NEW DEVICE
export const createDeviceObject = (newRow) => {
    return {
        ...newRow,
        id: `dev-${Date.now()}`,
        visible: true,
        tab: newRow.tab || "Home"
    };
};

// 3. PERSISTENCE WRAPPER
export const saveFleet = (list) => {
    try {
        localStorage.setItem("esp_fleet_config", JSON.stringify(list));
    } catch (e) {
        console.error("Failed to save fleet config:", e);
    }
};

// 4. CRUD OPERATIONS (Return the new list)
export const addDeviceToList = (list, device) => [...list, device];

export const deleteDeviceFromList = (list, id) => list.filter(d => d.id !== id);

export const toggleVisibilityInList = (list, host) => 
    list.map(d => d.host === host ? { ...d, visible: !d.visible } : d);

export const updateDeviceInList = (list, id, newData) =>
    list.map(device => device.id === id ? { ...device, ...newData } : device);