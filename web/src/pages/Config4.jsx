import React, { useState, useEffect } from 'react';
import { ReactSortable } from 'react-sortablejs';
import {
    Plus, Eye, EyeOff, Trash2, RotateCw,
    XCircle, UploadCloud, GripHorizontal
} from 'lucide-react';
import { useESPContext } from '../contexts/ESPContext';
import Upload from '../components/Upload';
import * as Fleet from '../helpers/fleetHelper';
import '../css/Config4.css';
import BufferedInput from '../helpers/BufferedInput';
import WifiStatusIcon from '../helpers/WifiStatusIcon';

// --- SUB-COMPONENT: DEVICEROW ---
const DeviceRow = React.memo(({
    dev, live, toggleDeviceVisibility, deleteDevice,
    updateDeviceConfig, setSelectedUpdateHost
}) => {
    const isConnected = live?.connection === 'connected';

    return (
        <div className={`device-row-split ${!isConnected ? 'row-offline' : ''}`}>
            <div className="left-column">
                <button onClick={() => toggleDeviceVisibility(dev.host)} className="vis-toggle-chip clickable-surface">
                    {dev.visible ? <Eye size={18} className="text-blue" /> : <EyeOff size={18} className="text-muted" />}
                </button>
                <button onClick={() => deleteDevice(dev.id)} className="action-chip-v2 delete-chip clickable-surface">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="middle-column">
                <div className="device-inputs">
                    <div className="input-group">
                        <span className="tiny-header">DEVICE NAME</span>
                        <BufferedInput
                            value={dev.name}
                            onSave={(v) => updateDeviceConfig(dev.id, { name: v })}
                            className="row-name-input"
                        />
                    </div>
                    <div className="input-group">
                        <span className="tiny-header">TAB</span>
                        <input
                            className="clean-input row-name-input"
                            value={dev.tab || ""}
                            onChange={(e) => updateDeviceConfig(dev.id, { tab: e.target.value })}
                        />
                    </div>
                </div>
                <div className="status-inline-row">
                    <WifiStatusIcon
                        live={live}
                        isConnected={isConnected}
                        size={12} // Slightly smaller for the dense grid
                    />
                    <span className="sub-data-text">{dev.host}</span>
                    <span className="sub-data-divider">|</span>
                    <span className="version-tag">{live?.ver || "v?.?.?"}</span>
                    { }
                    {live?.info?.wifi?.value?.ip && (
                        <>
                            <span className="sub-data-divider">|</span>
                            <span className="ip-tag">ip:{live.info.wifi.value.ip}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="right-column">
                <div className="drag-handle-corner clickable-surface">
                    <GripHorizontal size={18} />
                </div>
                <button
                    disabled={!isConnected}
                    onClick={() => setSelectedUpdateHost(dev.host)}
                    className={`action-chip-v2 clickable-surface ${!isConnected ? 'chip-disabled' : 'ota-chip'}`}
                >
                    <UploadCloud size={16} />
                </button>
            </div>
        </div>
    );
});

// --- MAIN COMPONENT ---
const Config = ({ onClose }) => {
    // Destructure everything needed from context
    const { 
        masterList, setMasterList, 
        devices, setDevices, 
        globalSettings, updateGlobalSettings, 
        bulkRefresh 
    } = useESPContext();

    const [showSuccess, setShowSuccess] = useState(false);
    const [selectedUpdateHost, setSelectedUpdateHost] = useState(null);
    const [newRow, setNewRow] = useState({ host: '', name: '', tab: '' });


    // --- 1. HANDLERS ---
    const isInvalid = !newRow.host.trim() || masterList.some(d => d.host.toLowerCase() === newRow.host.trim().toLowerCase());
    const hasInput = newRow.host || newRow.name || newRow.tab;
    useEffect(() => {
        const handleKeyDown = (e) => {
            // If selectedUpdateHost is NOT null, the overlay is open.
            // We let the overlay handle its own escape via propagation,
            // so we only trigger onClose if the overlay is hidden.
            if(hasInput && e.key === 'Escape') {
                setNewRow({ host: '', name: '', tab: '' });
                return;
            }
            if (e.key === 'Escape' && !selectedUpdateHost) {
                console.log("Escape: Closing Config Page");
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectedUpdateHost]);

    const handleAddSubmit = () => {
        const trimmedHost = newRow.host.trim();
        if (!trimmedHost) return;

        if (isInvalid) {
            console.warn(`[CONFIG] Blocked duplicate device: ${trimmedHost}`);
            // Optional: Trigger a specific error UI here
            alert(`Device "${trimmedHost}" is already in your fleet.`);
            return;
        }

        // 2. PROCEED if unique
        const device = Fleet.createDeviceObject(newRow);
        const newList = Fleet.addDeviceToList(masterList, device);

        setMasterList(newList);
        Fleet.saveFleet(newList);

        setShowSuccess(true);
        setNewRow({ host: '', name: '', tab: '' });
        setTimeout(() => setShowSuccess(false), 600);
    };

    const handleDelete = (id) => {
        const device = masterList.find(d => d.id === id);
        if (device) {
            setDevices(prev => {
                const next = { ...prev };
                delete next[device.host];
                return next;
            });
        }
        const newList = Fleet.deleteDeviceFromList(masterList, id);
        setMasterList(newList);
        Fleet.saveFleet(newList);
    };

    const toggleVisibility = (host) => {
        const newList = Fleet.toggleVisibilityInList(masterList, host);
        setMasterList(newList);
        Fleet.saveFleet(newList);
    };

    const updateDeviceConfig = (id, data) => {
        const newList = Fleet.updateDeviceInList(masterList, id, data);
        setMasterList(newList);
        Fleet.saveFleet(newList);
    };

    const handleHostInputChange = (val) => {
        const cleanHost = Fleet.sanitizeHost(val);
        setNewRow(prev => ({
            ...prev,
            host: cleanHost,
            name: (prev.name === prev.host || prev.name === '') ? cleanHost : prev.name,
            tab: (prev.tab === prev.host || prev.tab === '') ? cleanHost : prev.tab
        }));
    };

    // FIXED: The missing Sortable handler
    const handleSortChange = (newList) => {
        // Only update if the order actually changed to prevent render loops
        const hasMoved = newList.some((item, idx) => item.id !== masterList[idx]?.id);
        if (hasMoved) {
            setMasterList(newList);
            // Small timeout to allow the UI to finish animating before disk write
            setTimeout(() => Fleet.saveFleet(newList), 50);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAddSubmit();
        if (e.key === 'Escape') {
            if (hasInput) {
                setNewRow({ host: '', name: '', tab: '' });
                e.target.blur();
            } else {
                onClose();
            }
        }
    };

    // --- 2. RENDER ---
    return (
        <div className="config-overlay" onClick={(e) => e.target.classList.contains('config-overlay') && onClose()}>
            <div className="iphone-container" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="close-btn-top clickable-surface"><XCircle size={32} /></button>

                <div className="config-content">
                    <header className="config-header">
                        <h1 className="main-title">Connected Devices</h1>
                        <div className="header-bottom-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="subtitle">Refresh All</span>
                                <button onClick={bulkRefresh} className="sync-btn clickable-surface">
                                    <RotateCw size={14} />
                                </button>
                            </div>

                            {/* The Toggle Switch */}
                            <div className="shortcuts-toggle-wrapper" style={{ display: 'flex', alignItems: 'right', gap: '5px' }}>
                                <span className="subtitle" style={{ fontSize: '0.7rem' }}>Show Shortcuts</span>
                                <input
                                    type="checkbox"
                                    className="ios-checkbox"
                                    checked={globalSettings.showShortcuts}
                                    onChange={(e) => updateGlobalSettings({ showShortcuts: e.target.checked })}
                                />
                            </div>
                        </div>
                    </header>

                    {/* Register Node Section */}
                    <div className="glass-panel add-node-section">
                        <label className="input-label">Register New Device</label>
                        <div className={`add-node-grid ${showSuccess ? 'success-flash' : ''}`}>
                            <input
                                className="clean-input"
                                placeholder="host"
                                value={newRow.host}
                                onChange={e => handleHostInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoCapitalize="none"
                            />
                            <input
                                className="clean-input"
                                placeholder="Name"
                                value={newRow.name}
                                onChange={e => setNewRow({ ...newRow, name: e.target.value })}
                                onKeyDown={handleKeyDown}
                            />
                            <input
                                className="clean-input"
                                placeholder="Tab"
                                value={newRow.tab}
                                onChange={e => setNewRow({ ...newRow, tab: e.target.value })}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                onClick={handleAddSubmit}
                                disabled={isInvalid}
                                className={`add-btn-main clickable-surface ${isInvalid ? 'btn-disabled' : ''}`}
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Sortable Device List */}
                    <div className="device-list-container">
                        <ReactSortable
                            list={masterList}
                            setList={handleSortChange}
                            animation={200}
                            handle=".drag-handle-corner"
                            ghostClass="sortable-ghost"
                            forceFallback={true}
                            fallbackClass="sortable-drag"
                            dragClass="sortable-drag"
                            // This helps the engine realize it's a single column
                            direction="vertical"
                            className="device-list"
                        >
                            {masterList.map((dev) => (
                                <DeviceRow
                                    key={dev.id}
                                    dev={dev}
                                    live={devices[dev.host]}
                                    toggleDeviceVisibility={toggleVisibility}
                                    updateDeviceConfig={updateDeviceConfig}
                                    deleteDevice={handleDelete}
                                    setSelectedUpdateHost={setSelectedUpdateHost}
                                />
                            ))}
                        </ReactSortable>
                    </div>

                    {/* Global Settings */}
                    <div className="glass-panel infrastructure-section">
                        <label className="input-label">Home Assistant</label>
                        <BufferedInput
                            value={globalSettings.haHost || ''}
                            onSave={(val) => updateGlobalSettings({ haHost: val })}
                            className="ha-input"
                            placeholder="URL (e.g homeassistant.local:8123)"
                        />
                    </div>
                </div>

                {/* OTA Modal */}
                {selectedUpdateHost && (
                    <div className="ota-modal-overlay" onClick={() => setSelectedUpdateHost(null)}>
                        <div className="ota-modal-content" onClick={(e) => e.stopPropagation()}>
                            <Upload targetHost={selectedUpdateHost} onClose={() => setSelectedUpdateHost(null)} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Config;