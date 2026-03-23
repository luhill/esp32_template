import { useState, useEffect } from "react";
import { useESPContext } from "../contexts/ESPContext";
import { XCircleIcon } from "lucide-react";
import '../css/Upload.css';

// 1. Accept targetHost as a prop instead of using useParams
function Upload({ targetHost, onClose }) {
  const { devices, masterList } = useESPContext();
  
  // Find the metadata for the specific host we are updating
  const deviceConfig = masterList.find(d => d.host === targetHost) || {};
  const liveState = devices[targetHost] || { connection: "disconnected" };

  const [status, setStatus] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const isDev = import.meta.env.DEV;
  const isOffline = liveState.connection !== "connected";
  
  // Reset status if the user switches to a different device in the list
  useEffect(() => {
    setStatus("Ready");
    setProgress(0);
    setIsWaiting(false);
  }, [targetHost]);

  const handleFileSelection = (e, expectedName, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name !== expectedName) {
      alert(`Invalid File! Please select "${expectedName}" specifically.`);
      e.target.value = "";
      return;
    }

    if (isDev) {
      simulateUpload(type);
    } else {
      uploadFile(file, type);
    }
    e.target.value = "";
  };

  const uploadFile = (file, type) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.total > 0) ? (event.loaded / event.total) * 95 : 0);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        setProgress(100);
        setStatus("Success! Rebooting...");
      } else {
        setStatus("Error: " + xhr.statusText);
      }
    };

    xhr.onerror = () => setStatus("Network Error");

    // --- RESOLVE TARGET URL ---
    // If we are on HTTPS (Cloudflare/GitHub), use the remote URL. 
    // Otherwise, use the local .local host.
    const isSecure = window.location.protocol === 'https:';
    const destination = isSecure ? deviceConfig.remote : `${deviceConfig.host}.local`;
    const url = `${window.location.protocol}//${destination}/do-update`;

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-File-Type", type);
    xhr.send(file);
    setStatus(`Uploading ${type} to ${deviceConfig.name || targetHost}...`);
  };

  const simulateUpload = (type) => {
    setStatus(`Simulating ${type} to ${targetHost}...`);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setStatus("Success! (Simulated)");
      }
    }, 200);
  };

  // 2. Monitor reboot for the SPECIFIC target device
  useEffect(() => {
    if (status.includes("Success")) {
      setIsWaiting(true);

      if (liveState.connection !== "connected") {
        setStatus(`Rebooting ${deviceConfig.name}...`);
      }

      if (liveState.connection === "connected" && isWaiting) {
        setStatus("Online! Update Complete.");
        setIsWaiting(false);
        setTimeout(() => {
          setStatus("Ready");
          setProgress(0);
        }, 3000);
      }
    }
  }, [liveState.connection, status, deviceConfig.name, isWaiting]);

  return (
  <div className="upload-panel card modern-glass">
    {/* HEADER */}
    <header className="upload-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div className="upload-title-group">
        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ui-color-major)' }}>
          Update Tool
        </h4>
        <div className="targetLabel">
          Target: {deviceConfig.name || targetHost}
        </div>
      </div>
      
      <button onClick={onClose} className="icon-btn-close">
        <XCircleIcon size={24} color="#ff4d4d" strokeWidth={1.5} />
      </button>
    </header>

    {/* ERROR STATE */}
    {isOffline && (
      <div className="error-banner">
        <p>⚠️ Device Offline: OTA Unavailable</p>
      </div>
    )}

    {/* PROGRESS SECTION */}
    <div className="progress-section">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-labels">
        <span>{status}</span>
        <span>{progress}%</span>
      </div>
    </div>

    {/* ACTION CARDS */}
    <div className="update-grid">
      <div className={`update-card ${isOffline ? 'disabled' : ''}`} onClick={() => !isOffline && document.getElementById('firm_input').click()}>
        <input type="file" id="firm_input" hidden onChange={(e) => handleFileSelection(e, "firmware.bin", "firmware")} />
        <div className="card-icon">🚀</div>
        <div className="card-text">
          <strong>Firmware</strong>
          <span>Update logic (.bin)</span>
        </div>
      </div>

      <div className={`update-card ${isOffline ? 'disabled' : ''}`} onClick={() => !isOffline && document.getElementById('fs_input').click()}>
        <input type="file" id="fs_input" hidden onChange={(e) => handleFileSelection(e, "littlefs.bin", "fs")} />
        <div className="card-icon">📁</div>
        <div className="card-text">
          <strong>Filesystem</strong>
          <span>Update UI/Data (.bin)</span>
        </div>
      </div>
    </div>
  </div>
);
}

export default Upload;

// import { useState, useEffect, useRef } from "react";
// import { useParams } from "react-router-dom"; // Need this for the ID
// import { useESPContext } from "../contexts/ESPContext";
// import '../css/Upload.css';

// function Upload() {
//   const { host } = useParams();
//   const { devices, DEVICE_LIST } = useESPContext();
  
//   // Get live data for THIS specific device
//   const deviceData = devices[host] || { connection: "disconnected" };
//   // Find the host/remote from the blueprint list
//   const blueprint = DEVICE_LIST.find(d => d.host === host) || {};

//   const [status, setStatus] = useState("Ready");
//   const [progress, setProgress] = useState(0);
//   const [isWaiting, setIsWaiting] = useState(false);
//   const isDev = import.meta.env.DEV;

//   const handleFileSelection = (e, expectedName, type) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     if (file.name !== expectedName) {
//       alert(`Invalid File! Please select "${expectedName}" specifically.`);
//       e.target.value = "";
//       return;
//     }

//     if (isDev) {
//       simulateUpload(type);
//     } else {
//       uploadFile(file, type);
//     }
//     e.target.value = "";
//   };

//   const uploadFile = (file, type) => {
//     const xhr = new XMLHttpRequest();
    
//     xhr.upload.onprogress = (event) => {
//       if (event.lengthComputable) {
//         const percent = Math.round((event.total > 0) ? (event.loaded / event.total) * 95 : 0);
//         setProgress(percent);
//       }
//     };

//     xhr.onload = () => {
//       if (xhr.status === 200) {
//         setProgress(100);
//         setStatus("Success! Rebooting...");
//       } else {
//         setStatus("Error: " + xhr.statusText);
//       }
//     };

//     xhr.onerror = () => setStatus("Network Error");

//     // --- FIX: Resolve the correct URL for the specific device ---
//     const protocol = window.location.protocol; // https: or http:
//     const host = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1') 
//                  ? blueprint.host 
//                  : blueprint.remote;
    
//     // Construct absolute URL: https://bidet.drnadiaelahi.com
//     xhr.open("POST", `${protocol}//${host}/do-update`);
    
//     xhr.setRequestHeader("Content-Type", "application/octet-stream");
//     xhr.setRequestHeader("X-File-Type", type);
//     xhr.send(file);
//     setStatus(`Starting ${type} upload to ${host}...`);
//   };

//   const simulateUpload = (type) => {
//     setStatus(`Simulating ${type} upload...`);
//     let p = 0;
//     const interval = setInterval(() => {
//       p += 10;
//       setProgress(p);
//       if (p >= 100) {
//         clearInterval(interval);
//         setStatus("Success! (Simulated)");
//         setTimeout(() => setProgress(0), 2000);
//       }
//     }, 200);
//   };

//   // Monitor for Reboot based on the SPECIFIC device connection
//   useEffect(() => {
//     if (status.includes("Success")) {
//       setIsWaiting(true);

//       if (deviceData.connection !== "connected") {
//         setStatus("Rebooting... Waiting for device...");
//       }

//       if (deviceData.connection === "connected" && isWaiting) {
//         console.log(`✅ ${host} Restored!`);
//         setStatus("Online!");
//         setIsWaiting(false);
//         setTimeout(() => {
//           setStatus("Ready");
//           setProgress(0);
//         }, 2000);
//       }
//     }
//   }, [deviceData.connection, status, host, isWaiting]);

//   return (
//     <div className="controlsPanel font-base">
//       <h4 className="group-title">Update: {deviceData.name || host}</h4>
      
//       <div className="progress-container color-minor">
//         <div className="progress-fill color-major" style={{ width: `${progress}%` }} />
//       </div>

//       <div className="controlRow update-row">
//         <label className="app-label">Firmware</label>
//         <input type="file" id="firm_input" className="file-input-hidden" onChange={(e) => handleFileSelection(e, "firmware.bin", "firmware")} />
//         <button className="app-btn update-btn font-base" onClick={() => document.getElementById('firm_input').click()} disabled={isWaiting}>
//           Select .bin
//         </button>
//       </div>

//       <div className="controlRow update-row">
//         <label className="app-label">Filesystem</label>
//         <input type="file" id="fs_input" className="file-input-hidden" onChange={(e) => handleFileSelection(e, "littlefs.bin", "fs")} />
//         <button className="app-btn update-btn font-base" onClick={() => document.getElementById('fs_input').click()} disabled={isWaiting}>
//           Select .bin
//         </button>
//       </div>

//       <p className="status-readout color-major">{status}</p>
//     </div>
//   );
// }

// export default Upload;