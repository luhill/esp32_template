import React, { useState, useEffect } from 'react';
import { useESPContext } from '../contexts/ESPContext';
import { Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Cpu, FolderArchive, PlusCircle, XCircleIcon, RotateCw } from 'lucide-react';
import Upload from '../components/Upload'; // Ensure Upload is imported
import WifiStatusIcon from "../helpers/WifiStatusIcon"; // Ensure this is imported
import '../css/Config.css';

const Config = ({onClose}) => {
  const { masterList, updateDeviceConfig, deleteDevice, addDevice, toggleDeviceVisibility, moveDevice, devices } = useESPContext();
  const [newRow, setNewRow] = useState({ host: '', name: '', remote: '', tab: 'Home' });
  const [selectedUpdateHost, setSelectedUpdateHost] = useState(null);

  const { bulkRefresh } = useESPContext();

  const handleAdd = () => {
    if (newRow.host && newRow.name) {
      addDevice(newRow);
      setNewRow({ host: '', name: '', remote: '', tab: 'Home' });
    }
  };

  const EditableHostInput = ({ device }) => {
    const { updateDeviceConfig } = useESPContext();
    const [tempHost, setTempHost] = useState(device.host);

    // Keep local state in sync if external data changes
    useEffect(() => {
      setTempHost(device.host);
    }, [device.host]);

    return (
      <input
        className="config-input"
        value={tempHost}
        onChange={(e) => setTempHost(e.target.value)} // Only updates local text
        onBlur={() => {
          // Only updates the GLOBAL masterList when you stop typing
          if (tempHost !== device.host) {
            updateDeviceConfig(device.host, { host: tempHost });
          }
        }}
        placeholder="hostname"
      />
    );
  };

  return (
    <div className="config-page font-base">
      {/* --- UPPER GRID: HARDWARE REGISTRATION --- */}
      <section className="config-section">
        <div className="config-header">
          <h4 className="section-title">Hardware Registry</h4>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              lineHeight: 0,   /* Prevents extra height from text alignment */
              display: 'flex'  /* Centers the icon perfectly */
            }}
          >
            <XCircleIcon size={25} fill="red" color="black" strokeWidth={2} />
          </button>
        </div>
        <div className="hardware-grid header">
          <div>Host</div>
          <div>Name</div>
          <div>Remote URL</div>
          <div></div>
        </div>

        {masterList.map(dev => (
          <div key={dev.host} className="hardware-grid row">
            <EditableHostInput device={dev}/>
            <input className="config-input" value={dev.name} onChange={(e) => updateDeviceConfig(dev.host, { name: e.target.value })} />
            <input className="config-input" value={dev.remote} onChange={(e) => updateDeviceConfig(dev.host, { remote: e.target.value })} />
            <button onClick={() => deleteDevice(dev.host)} className="icon-btn text-red"><Trash2 size={16} /></button>
          </div>
        ))}

        {/* Ghost Row */}
        <div className="hardware-grid row ghost mt-2">
          <input className="config-input" placeholder="new-host" value={newRow.host} onChange={e => setNewRow({ ...newRow, host: e.target.value })} />
          <input className="config-input" placeholder="Name" value={newRow.name} onChange={e => setNewRow({ ...newRow, name: e.target.value })} />
          <input className="config-input" placeholder="Remote" value={newRow.remote} onChange={e => setNewRow({ ...newRow, remote: e.target.value })} />
          <button onClick={handleAdd} className="icon-btn text-accent"><PlusCircle size={18} /></button>
        </div>
      </section>

      {/* --- LOWER GRID: FLEET & UPDATES --- */}
      <section className="config-section mt-8">
        <h4 className="section-title">Fleet & Zones</h4>
        <button className="btn-refresh" onClick={bulkRefresh}>
          <RotateCw size={14} /> Refresh All
        </button>
        <div className="fleet-grid header">
          <div>Show</div>
          <div></div>
          <div>Host</div>
          <div>Order</div>
          <div>Tab</div>
          <div>Update</div>
        </div>

        {masterList.map(dev => (
          <div key={dev.host + "-fleet"} className={`fleet-grid row ${selectedUpdateHost === dev.host ? 'selected' : ''}`}>
            {/* 1. Visibility */}
            <button onClick={() => toggleDeviceVisibility(dev.host)} className="icon-btn">
              {dev.visible ? <Eye size={18} /> : <EyeOff size={18} className="opacity-30" />}
            </button>

            <div>
              <WifiStatusIcon
                live={devices[dev.host]}
                isConnected={devices[dev.host]?.connection === 'connected'}
                size={12} // Slightly smaller for the dense grid
              />
            </div>

            {/* 2. Device Label */}
            <div className="device-label-group">
              <span className="host-label">{dev.host}</span>
              {/* Display the version from the live state if available */}
              <span className="version-tag">
                {devices[dev.host]?.ver || "v?.?.?"}
              </span>
            </div>
            
            {/* 4. Reorder Buttons */}
            <div className="order-btns">
              <button onClick={() => moveDevice(dev.host, -1)} aria-label="Move Up"><ArrowUp size={14} /></button>
              <button onClick={() => moveDevice(dev.host, 1)} aria-label="Move Down"><ArrowDown size={14} /></button>
            </div>

            {/* 3. Tab Name Input */}
            <input
              className="config-input"
              value={dev.tab || ""}
              onChange={(e) => updateDeviceConfig(dev.host, { tab: e.target.value })}
            />

            {/* 5. Update Selector Radio */}
            <div className="update-selector">
              <input
                type="radio"
                name="update-target"
                // Key change: Use onClick instead of just onChange for toggle behavior
                onClick={() => {
                  if (selectedUpdateHost === dev.host) {
                    setSelectedUpdateHost(null); // Unselect if already selected
                  } else {
                    setSelectedUpdateHost(dev.host); // Select if different
                  }
                }}
                // Keep checked as a controlled property
                checked={selectedUpdateHost === dev.host}
                readOnly // Prevents warnings since we handle click manually
              />
            </div>
          </div>
        ))}
      </section>

      {selectedUpdateHost && (
          <Upload
            targetHost={selectedUpdateHost}
            onClose={() => setSelectedUpdateHost(null)}
          />
      )}
    </div>
  );
};

export default Config2;