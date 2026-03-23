
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useParams, useNavigate, useLocation, NavLink, useSearchParams } from 'react-router-dom';
import { HouseWifiIcon, XCircleIcon} from "lucide-react";
import { SiHomeassistant } from 'react-icons/si'
import { useESPContext } from './contexts/ESPContext';
import Sidebar from './components/Sidebar';
import NavBar from './components/NavBar';
import ControlsPage from './pages/ControlsPage';
//import Update from './pages/Update';
import Config from './pages/Config4';
//import { Settings} from 'lucide-react';
import DevPulseHelper from './helpers/DevPulseHelper';


const DeviceLayout = () => {
  const { host } = useParams();
  const { devices } = useESPContext();
  const { masterList } = useESPContext();
  const navigate = useNavigate();

  useEffect(() => {
    const isVisible = masterList.some(d => d.tab === host && d.visible);

    // If the zone is hidden, go to the root but open the config overlay
    if (!isVisible && host !== 'config') {
      navigate('/?showConfig=true', { replace: true });
    }
  }, [host, masterList, navigate]);

  // --- 2. TITLE LOGIC (The Fix) ---
  useEffect(() => {
    // Look for any device assigned to this tab to get its 'name'
    const deviceInTab = masterList.find(d => d.tab === host);
    const liveData = devices[deviceInTab?.host];

    // Set title to Hardware Name (e.g. "Bidet") or Tab Name (e.g. "Bathroom")
    if (host) {
      document.title = deviceInTab?.name || host;
    }
  }, [host, devices, masterList]);

  return (
    <>
      <NavBar /> {/* This instance of NavBar will now see the 'host' */}
      <Outlet key={host} /> {/* This renders Home, Settings, or Update */}
    </>
  );
};
const PathTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Combine path and search (e.g. "/Bathroom?showConfig=true")
    const fullPath = `${location.pathname}${location.search}`;

    // 2. DEBUG LOG: Check your browser console to see if this fires!
    console.log("📍 PathTracker saving:", fullPath);

    // Only save if it's a "real" page (not just the empty root)
    if (fullPath && fullPath !== "/" && fullPath !== "") {
      localStorage.setItem("last_esp_path", fullPath);
    }
  }, [location]); // Watch the whole location object for any change

  return null; // This component doesn't draw anything, it just "listens"
};

// 1. Create a sub-component for the main layout
const AppContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { masterList, isInitialized, globalSettings, isESP32, isDev } = useESPContext();
  const { pathname, search } = useLocation(); // Destructure 'search' here
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInitialized) return;

    // 1. Only redirect if we are exactly at the root "/"
    if (pathname === "/") {
      const savedPath = localStorage.getItem("last_esp_path");
      const pathSegments = savedPath ? savedPath.split('/').filter(Boolean) : [];
      const savedTab = pathSegments[0];
      const isStillValid = masterList.some(d => d.tab === savedTab && d.visible);

      // 2. THE FIX: Explicitly grab the current search string (e.g., "?showConfig=true")
      const currentSearch = search || "";

      if (isStillValid && savedPath && savedPath !== "/") {
        // Construct the full URL: "/Bathroom/settings?showConfig=true"
        navigate(`${savedPath}${currentSearch}`, { replace: true });
      } else {
        const firstTab = masterList?.find(d => d.visible)?.tab;
        if (firstTab) {
          // Construct the full URL: "/Bathroom?showConfig=true"
          navigate(`/${firstTab}${currentSearch}`, { replace: true });
        } else if (!searchParams.get('showConfig')) {
          setSearchParams({ showConfig: true });
        }
      }
    }
  }, [isInitialized, masterList, pathname, search, navigate, searchParams, setSearchParams]);

  const visibleTabs = [...new Set(masterList.filter(d => d.visible).map(d => d.tab))];
  const hasMultipleTabs = visibleTabs.length > 1;
  const isConfigOpen = searchParams.get('showConfig') === 'true' || pathname === '/config';
  const isHAOpen = searchParams.get('showHA') === 'true'; // New State

  // Logic: Show HA only if a host is provided
  const showHAButton = globalSettings.haHost;

  const getHAUrl = () => {
    const host = globalSettings.haHost;
    if (!host) return '';
    if (isDev) return `http://${host}.local:8123`;
    // If user provided a full URL (https://...), use it. 
    // Otherwise, assume the same protocol as the current page.
    if (host.startsWith('http')) return host;

    const protocol = window.location.protocol;
    return `${protocol}//${host}`;
  };

  return (
    <div className={`app-layout ${hasMultipleTabs ? 'has-sidebar' : 'no-sidebar'}`}>
      {/* --- 1. HOME ASSISTANT OVERLAY --- */}
      {isHAOpen && (
        <div className="config-overlay-wrapper ha-overlay" onClick={() => setSearchParams({})}>
          <div className="config-card-container ha-card" onClick={(e) => e.stopPropagation()}>
            <div className="ha-header">
              <span>Home Assistant</span>
              <button
                onClick={() => setSearchParams({})}
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
            <iframe
              src={getHAUrl()}
              title="Home Assistant"
              className="ha-iframe"
              allow="fullscreen"
            />
          </div>
        </div>
      )}

      {/* 1. THE OVERLAY (Background Layer) */}
      {isConfigOpen && (
        <div className="config-overlay-wrapper" onClick={() => setSearchParams({})}>
          <div className="config-card-container" onClick={(e) => e.stopPropagation()}>
            <Config onClose={() => setSearchParams({})} />
          </div>
        </div>
      )}

      {/* 2. THE BUTTON (Foreground Layer) */}
      {/* Move this AFTER the overlay code so it's always clickable */}
      <button
        onClick={() => setSearchParams(isConfigOpen ? {} : { showConfig: true })}
        className="floating-config-btn"
      >
        <HouseWifiIcon size={25} />
      </button>
      {showHAButton && (
        <button
          onClick={() => setSearchParams(isHAOpen ? {} : { showHA: true })}
          className="floating-ha-btn"
        >
          {/* <HomeAssistantIcon size={155} active={showHAButton} /> */}
          <SiHomeassistant size={20} color='#03a9f4'/>
        </button>
      )}
      {hasMultipleTabs && <Sidebar />}

      <main className="main-content">
        <Routes>
          <Route path="/config" element={null} />
          <Route path="/:host" element={<DeviceLayout />}>
            <Route index element={<ControlsPage data_field="home" />} />
            <Route path="settings" element={<ControlsPage data_field="settings" />} />
            <Route path="info" element={<ControlsPage data_field="info" />} />
          </Route>
          <Route path="/" element={null} />
        </Routes>
        <DevPulseHelper />
      </main>
    </div>
  );
};

// 2. Keep the main App component clean with just the Providers
function App() {
  return (
    <Router>
      <PathTracker />
      <AppContent />
    </Router>
  );
}
export default App;