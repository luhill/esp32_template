import { useEffect, useRef} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useESPContext } from '../contexts/ESPContext';
import { Cpu, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import "../css/Sidebar.css"

const Sidebar = () => {
  const { TABS, getTabStatus, devices, pulseData } = useESPContext(); // Assuming pulseData is here
  const { pathname } = useLocation();
  
  // Create a mapping of refs for each tab indicator
  const indicatorRefs = useRef({});

  useEffect(() => {
  TABS.forEach((tab) => {
    // 1. Get the latest timestamp from ANY device in this tab
    const zoneTimestamp = Math.max(
      ...tab.devices.map(d => devices[d.host]?.lastUpdate || 0)
    );

    // 2. Use a Ref to track the PREVIOUS timestamp for this specific tab
    // This prevents the "Initial Load" from making everything glow at once
    if (!indicatorRefs.current[tab.name + "_last"]) {
        indicatorRefs.current[tab.name + "_last"] = zoneTimestamp;
        return;
    }

    const lastSeen = indicatorRefs.current[tab.name + "_last"];
    const el = indicatorRefs.current[tab.name];

    // 3. Only pulse if the NEW timestamp is greater than what we last saw
    if (zoneTimestamp > lastSeen && el) {
        el.classList.remove('data-pulse');
        void el.offsetWidth; 
        el.classList.add('data-pulse');
        
        // Update the "last seen" for this specific tab
        indicatorRefs.current[tab.name + "_last"] = zoneTimestamp;
    }
  });
}, [devices, TABS]); // Listen to the full 'devices' state

  const getNewPath = (newTabName) => {
    const segments = pathname.split('/').filter(Boolean);
    const isConfig = segments[0] === 'config';
    if (isConfig) return `/${newTabName}`;
    const subPath = segments.length > 1 ? segments[1] : "";
    return `/${newTabName}${subPath ? '/' + subPath : ''}`;
  };

  return (
    <aside className="sidebar-narrow">
      <div className="sidebar-tabs-container">
        {TABS.map((tab) => (
          <NavLink 
            key={tab.name} 
            to={getNewPath(tab.name)} 
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {/* 2. Attach the ref to the specific indicator */}
            <div 
              ref={(el) => (indicatorRefs.current[tab.name] = el)}
              className={`status-indicator ${getTabStatus(tab.name)}`} 
            />
            <span className="vertical-text">{tab.name}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
};


export default Sidebar;