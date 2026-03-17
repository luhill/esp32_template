import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useESPContext } from '../contexts/ESPContext';
import { Cpu, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import "../css/Sidebar.css"

const Sidebar = () => {
  const { TABS, getTabStatus } = useESPContext();
  const { pathname } = useLocation();

  const getNewPath = (newTabName) => {
    const segments = pathname.split('/').filter(Boolean);
    const isConfig = segments[0] === 'config';
    if (isConfig) return `/${newTabName}`;
    const subPath = segments.length > 1 ? segments[1] : "";
    return `/${newTabName}${subPath ? '/' + subPath : ''}`;
  };

  return (
    <aside className="sidebar-narrow">
      {/* Container to push tabs below the Navbar height (approx 60-80px) */}
      <div className="sidebar-tabs-container">
        {TABS.map((tab) => (
          <NavLink 
            key={tab.name} 
            to={getNewPath(tab.name)} 
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {/* Modern Status Indicator: A small glowing pill/dot */}
            <div className={`status-indicator ${getTabStatus(tab.name)}`} />
            <span className="vertical-text">{tab.name}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
};


  // return (
  //   <aside className="sidebar-narrow">
  //     {TABS.map((tab) => (
  //       <NavLink 
  //         key={tab.name} 
  //         to={`/${tab.name}`} 
  //         className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
  //       >
  //         {/* Apply the calculated status class */}
  //         <div className={`status-bar ${getTabStatus(tab.name)}`} />
  //         <span className="vertical-text">{tab.name}</span>
  //       </NavLink>
  //     ))}
  //   </aside>
  // );


export default Sidebar;