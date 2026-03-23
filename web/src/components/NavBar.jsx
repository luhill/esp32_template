import React from 'react';
import { useParams, NavLink } from "react-router-dom";
import { useESPContext } from "../contexts/ESPContext";
import { HomeIcon, SettingsIcon, InfoIcon } from "lucide-react";
import WifiStatusIcon from "../helpers/WifiStatusIcon"; // Ensure this is imported
import "../css/Navbar.css";

function NavBar() {
  const { host: tabName } = useParams(); 
  const { getTabStatus, TABS, devices } = useESPContext();

  const tabStatus = getTabStatus(tabName);
  const currentTab = TABS.find(t => t.name === tabName);

  // 1. CALCULATE AGGREGATE HEARTBEAT
  // We find the max lastUpdate timestamp from all devices in this tab group
  const zoneLastUpdate = currentTab 
    ? Math.max(...currentTab.devices.map(d => devices[d.host]?.lastUpdate || 0))
    : 0;

  const displayName = tabName || "Fleet Manager";

  return (
    <nav className="navbar" role="navigation">
      <div className="navbar-brand">
        <NavLink to={tabName ? `/${tabName}` : "/config"} className="brand-link">
          {displayName}
        </NavLink>

        {/* --- DYNAMIC ZONE STATUS ICON --- */}
        {tabName && (
          <WifiStatusIcon 
            // We pass a "fake" live object with the zone's latest timestamp 
            // so the icon knows when ANY device in the room talks.
            live={{ lastUpdate: zoneLastUpdate }} 
            statusOverride={tabStatus} 
            size={18} 
          />
        )}
      </div>

      <div className="navbar-links" role="tablist">
        {tabName ? (
          <>
            <NavLink to={`/${tabName}`} end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <HomeIcon size={22}/>
            </NavLink>
            <NavLink to={`/${tabName}/settings`} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <SettingsIcon size={22}/>
            </NavLink>
            <NavLink to={`/${tabName}/info`} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <InfoIcon size={22}/>
            </NavLink>
          </>
        ) : (
          <NavLink
            to="/config"
            className={({ isActive }) => isActive ? "nav-link active icon-link" : "nav-link icon-link"}
          >
            <Settings size={18} />
          </NavLink>
        )}
      </div>
    </nav>
  );
}

export default NavBar;