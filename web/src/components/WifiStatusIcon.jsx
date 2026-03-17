import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import '../css/WifiStatusIcon.css'; // <--- POINT TO NEW CSS

const WifiStatusIcon = ({ live, isConnected, size = 14, statusOverride }) => {
  const iconRef = useRef(null); // 1. Add a ref to the div
  const currentUpdate = live?.lastUpdate || 0;
  const lastSeen = useRef(currentUpdate);
  const statusClass = statusOverride || (isConnected ? 'online' : 'offline');

  useEffect(() => {
    // 2. If a new update arrived
    if (currentUpdate > lastSeen.current) {
      if (lastSeen.current !== 0 && iconRef.current) {
        const el = iconRef.current;
        
        // 3. THE MAGIC REFLOW TRICK
        el.classList.remove('data-pulse'); // Remove if exists
        void el.offsetWidth;               // Force browser to "notice" it's gone
        el.classList.add('data-pulse');    // Add it back to start frame 0
      }
      lastSeen.current = currentUpdate;
    }
  }, [currentUpdate]);

  if (!statusClass) return null;

  return (
    <div 
      ref={iconRef} // Attach ref here
      className={`status-icon-wifi ${statusClass}`}
      // 4. Remove onAnimationEnd logic entirely
    >
      {statusClass === 'offline' ? (
        <WifiOff size={size} strokeWidth={2.5} />
      ) : (
        <Wifi size={size} strokeWidth={2.5} />
      )}
    </div>
  );
};

export default WifiStatusIcon;