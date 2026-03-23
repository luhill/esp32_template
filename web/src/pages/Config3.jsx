import React, { useState, useEffect } from 'react';
import { useESPContext } from '../contexts/ESPContext';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, MouseSensor, TouchSensor 
} from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
    ChevronUp, ChevronDown, Trash2, Plus,
    Settings, Server, Eye, EyeOff, RotateCw, XCircle, UploadCloud, GripHorizontal
} from 'lucide-react'; // or lucide-react
import Upload from '../components/Upload'; // Ensure Upload is imported
import WifiStatusIcon from "../helpers/WifiStatusIcon"; // Ensure this is imported
import '../css/Config3.css';
// import BufferedInput from '../helpers/BufferedInput';


// --- SUB-COMPONENT: Sortable Row ---
// We extract the row logic here so useSortable works correctly.
const SortableDeviceRowTest = ({ dev }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: dev.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={{ padding: '20px', background: 'red', marginBottom: '5px' }}>
            TEST ROW {dev.host}
        </div>
    );
};
const SortableDeviceRow = ({ dev, /* ... props */ }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: dev.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // In production, force these to ensure they aren't ignored
        position: 'relative',
        zIndex: isDragging ? 999 : 1,
    };
    const { devices } = useESPContext();
    const live = devices[dev.host];
    const isConnected = live?.connection === 'connected';
    const ipAddr = live?.ip || "0.0.0.0";
    const isActuallyDragging = isDragging && attributes['aria-pressed'] === 'true';
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`device-row-split ${!isConnected ? 'row-offline' : ''} ${isActuallyDragging ? 'dragging' : ''}`}
        >
            {/* FAR LEFT: Visibility & Trash */}
            <div className="left-column">
                <button onClick={() => toggleDeviceVisibility(dev.host)} className="vis-toggle-chip">
                    {dev.visible ? <Eye size={18} className="text-blue" /> : <EyeOff size={18} className="text-muted" />}
                </button>
                <button onClick={() => deleteDevice(dev.id)} className="action-chip-v2 delete-chip">
                    <Trash2 size={16} />
                </button>
            </div>

            {/* MIDDLE: Identity & Status */}
            <div className="middle-column">
                <div className="device-inputs">
                    <div className="input-group">
                        <span className="tiny-header">DEVICE NAME</span>
                        <EditableConfigInput
                            value={dev.name}
                            onSave={(v) => updateDeviceConfig(dev.id, { name: v })}
                            className="row-name-input"
                            placeholder="Device Name"
                        />
                    </div>
                    <div className="input-group">
                        <span className="tiny-header">TAB</span>
                        <input
                            className="clean-input editable-field row-name-input"
                            value={dev.tab || ""}
                            placeholder="Tab Name"
                            onChange={(e) => updateDeviceConfig(dev.id, { tab: e.target.value })}
                        />
                    </div>
                </div>

                <div className="status-inline-row">
                    <WifiStatusIcon live={live} isConnected={isConnected} size={20} />
                    <span className="sub-data-text">{dev.host}</span>
                    <span className="sub-data-divider">|</span>
                    <span className="sub-data-text font-mono">{ipAddr}</span>
                    <span className="version-tag">{live?.ver || "v?"}</span>
                </div>
            </div>

            {/* RIGHT COLUMN: Grip & Upload */}
            <div className="right-column">
                {/* Drag handle specifically gets the listeners/attributes */}
                <div
                    className="drag-handle-corner"
                    role={attributes.role}
                    tabIndex={attributes.tabIndex}
                    aria-pressed={attributes['aria-pressed']}
                    aria-roledescription={attributes['aria-roledescription']}
                    aria-describedby={attributes['aria-describedby']}
                    
                    /* 2. Manually apply the listeners */
                    onPointerDown={listeners.onPointerDown}
                    onKeyDown={listeners.onKeyDown}
                    
                    /* 3. Force touch-action for the browser */
                    style={{ touchAction: 'none', cursor: 'grab' }}
                >
                    <GripHorizontal size={20} />
                </div>

                <div className="action-cluster">
                    <button
                        disabled={!isConnected}
                        onClick={() => setSelectedUpdateHost(dev.host)}
                        className={`action-chip-v2 ${!isConnected ? 'chip-disabled' : 'ota-chip'}`}
                    >
                        <UploadCloud size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const Config = ({ onClose }) => {
    const {
        masterList, setMasterList, updateDeviceConfig, deleteDevice, addDevice,
        toggleDeviceVisibility, devices,
        globalSettings, updateGlobalSettings, bulkRefresh, moveDevice
    } = useESPContext();

    const [newRow, setNewRow] = useState({ host: '', name: '' });
    const [selectedUpdateHost, setSelectedUpdateHost] = useState(null);

    // Setup DnD Sensors
    const sensors = useSensors(
        // Mouse support for desktop
        useSensor(MouseSensor),
        // Touch support for mobile/ESP32
        // useSensor(TouchSensor, {
        //     activationConstraint: {
        //         delay: 250,      // Hold for 250ms to start dragging (prevents accidental drags)
        //         tolerance: 5,    // Allow 5px of movement before canceling the "hold"
        //     },
        // }),
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Require 5px movement before the drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const [activeId, setActiveId] = useState(null); // Explicitly null
    const handleDragStart = (event) => {
        console.log("Drag started with ID:", event.active.id);
        if (event.active.id) {
            setActiveId(event.active.id);
        }
        // Optional: Add a temporary alert to see it on your phone
        // window.alert("Dragging: " + event.active.id); 
    };
    const handleDragEnd = (event) => {
        const { active, over } = event;

        // Always clear the active ID first
        setActiveId(null);

        if (active && over && active.id !== over.id) {
            const oldIndex = masterList.findIndex(item => item.id === active.id);
            const newIndex = masterList.findIndex(item => item.id === over.id);
            moveDevice(oldIndex, newIndex);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target.classList.contains('config-overlay')) {
            onClose();
        }
    };
    // disable the "bounce" scroll while the config is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);
    return (
        <div className="config-overlay" onClick={handleOverlayClick}>
            <div className="iphone-container" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="close-btn-top">
                    <XCircle size={32} />
                </button>

                <div className="config-content">
                    <header className="config-header">
                        <div className="header-top-row">
                            <h1 className="main-title">System</h1>
                        </div>
                        <div className="header-bottom-row">
                            <span className="subtitle">Fleet Management</span>
                            <button onClick={bulkRefresh} className="sync-btn">
                                <RotateCw size={14} />
                            </button>
                        </div>
                    </header>

                    {/* Footer Add */}
                    <div className="glass-panel add-node-section">
                        <label className="input-label">Register New Hardware</label>
                        <div className="add-node-inputs">
                            <input 
                                className="clean-input" 
                                placeholder="Hostname (e.g. esp-kitchen)" 
                                value={newRow.host}
                                onChange={e => setNewRow({...newRow, host: e.target.value})}
                            />
                            <div className="add-node-row">
                                <input 
                                    className="clean-input flex-grow-input" 
                                    placeholder="Friendly Label" 
                                    value={newRow.name}
                                    onChange={e => setNewRow({...newRow, name: e.target.value})}
                                />
                                <button onClick={() => { addDevice(newRow); setNewRow({host:'', name:''}) }} className="add-btn-main">
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Device List with DnD Context */}
                    <div className="device-list">
                        <DndContext 
                            id="esp-fleet-dnd-context"
                            sensors={sensors} 
                            collisionDetection={closestCenter} 
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                        >
                            <SortableContext items={masterList} strategy={verticalListSortingStrategy}>
                                {masterList.map((dev) => (
                                    <SortableDeviceRow
                                        key={dev.id}
                                        dev={dev}
                                        devices={devices}
                                        toggleDeviceVisibility={toggleDeviceVisibility}
                                        updateDeviceConfig={updateDeviceConfig}
                                        deleteDevice={deleteDevice}
                                        setSelectedUpdateHost={setSelectedUpdateHost}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* Infrastructure Card */}
                    <div className="glass-panel infrastructure-section">
                        <label className="input-label">Home Assistant</label>
                        <EditableConfigInput
                            value={globalSettings.haHost || ''}
                            onSave={(val) => updateGlobalSettings({ haHost: val })}
                            placeholder="URL (eg. homeassistant.local:8123)"
                            className="ha-host-input"
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
export default Config2;
// Internal Component to ensure value is never null
const EditableConfigInput = ({ value, onSave, placeholder, className = "" }) => {
    const [draft, setDraft] = useState(value || "");
    useEffect(() => setDraft(value || ""), [value]);
    return (
        <input
            className={`clean-input editable-field ${className}`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== value && onSave(draft)}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
    );
};