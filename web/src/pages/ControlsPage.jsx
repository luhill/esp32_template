import { useState, useEffect, useRef, useContext } from "react";
import { useParams } from "react-router-dom"; // Import this!
import { useESPContext } from "../contexts/ESPContext";
import "../css/ControlsPage.css";
import "../css/Navbar.css";
import ControlsPanel from "../components/ControlsPanel";
import WifiStatusIcon from "../components/WifiStatusIcon"; // Ensure this is imported

function ControlsPage({ data_field = "home" }) {
  const { host: tabName } = useParams();
  const { TABS = [], devices, updateEspControl, isInitialized } = useESPContext();
  
  const currentTab = TABS.find(t => t.name === tabName);

  // 1. Wait for LocalStorage/MasterList to actually load
  if (!isInitialized) {
    return <div className="p-4 opacity-50">Initializing Fleet...</div>;
  }

  // 2. Tab doesn't exist in the Master List
  if (!currentTab) {
    return (
      <div className="p-8 text-center opacity-60">
        <p>Zone "{tabName}" not found.</p>
        <small>Check your Fleet Config to ensure this tab is assigned to a device.</small>
      </div>
    );
  }

  // 3. Tab exists, but has 0 visible devices
  if (currentTab.devices.length === 0) {
    return (
      <div className="p-8 text-center opacity-60">
        <p>No visible devices in {tabName}.</p>
        <button onClick={() => window.location.href='/config'} className="btn-small mt-2">
          Manage Fleet
        </button>
      </div>
    );
  }

  return (
    <div className="controls-dashboard">
      {currentTab.devices.map(device => {
        const live = devices[device.host] || { connection: 'disconnected', lastUpdate: 0, status: 'connecting' };
        const isConnected = live.connection === 'connected';

        return (
          <div key={device.host} className={`device-zone-block ${!isConnected ? 'device-offline' : ''}`}>
            <div className="device-zone-header">
              <h5 className="zone-label">{device.name}</h5>
              <WifiStatusIcon live={live} isConnected={isConnected}/>
            </div>
            <ControlsPanel 
              props={{ 
                controls: live[data_field], 
                status: live.status || 'waiting' 
              }} 
              onUpdate={(id, val, updateHost) => updateEspControl(device.host, id, val, updateHost)} 
            />
          </div>
        );
      })}
    </div>
  );
}
export default ControlsPage