import "../css/Display.css"

import React from 'react';

/**
 * List Component (Read-Only)
 * @param {Object} data - The configuration object from ESP32 (name, value, etc.)
 */
function List({ data }) {
  // 1. Destructure what we need from the data object
  const name = data?.name || "Log";
  const rawEntries = data?.value?.entries || "[]";

  // 2. Parse the entries (handling potential double-stringification)
  let logList = [];
  try {
    logList = typeof rawEntries === 'string' ? JSON.parse(rawEntries) : rawEntries;
    if (!Array.isArray(logList)) logList = [];
  } catch (e) {
    console.error("Failed to parse log entries:", e);
    logList = [];
  }

  return (
    <div className="controlsRow font-base">
      <h4 className="group-title">{name}</h4>
      
      <div className="log-container ui-color-minor" style={{ 
          // maxHeight: '200px', 
          overflowY: 'auto',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #333'
      }}>
        {logList.length === 0 ? (
          <p className="log-entry" style={{ opacity: 0.5, fontSize: '0.8rem' }}>
            No events recorded.
          </p>
        ) : (
          /* We show the newest logs at the top for better UX */
          [...logList].map((entry, i) => (
            <div key={i} className="log-entry ui-color-major" style={{ 
                padding: '4px 0',
                borderBottom: '1px solid #222',
                display: 'flex'
            }}>
              <samp style={{ fontSize: '0.6rem', lineHeight: '1.2' }}>
                {entry}
              </samp>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default List;