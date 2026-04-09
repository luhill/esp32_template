import { useState, useEffect } from "react";
import { useESPContext } from "../contexts/ESPContext";
import { XCircleIcon } from "lucide-react";
import '../css/Upload.css';

// 1. Accept targetHost as a prop instead of using useParams
function Upload({ targetHost, onClose }) {
  const { devices, masterList, clearNVS } = useESPContext();
  
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        console.log("Escape: Closing Update Overlay");
        e.stopPropagation(); // Prevents Config from seeing this press
        onClose();
      }
    };

    // Listen on window to catch it globally while open
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleEraseNVS = () => {
    const confirmed = window.confirm(`Erase control settings for ${deviceConfig.name || targetHost}?`);
    if (confirmed) {
      clearNVS(targetHost);
      console.log(`NVS Erase command dispatched to ${targetHost}`);
    }
  };

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
          <span>(firmware.bin)</span>
        </div>
      </div>

      <div className={`update-card ${isOffline ? 'disabled' : ''}`} onClick={() => !isOffline && document.getElementById('fs_input').click()}>
        <input type="file" id="fs_input" hidden onChange={(e) => handleFileSelection(e, "littlefs.bin", "fs")} />
        <div className="card-icon">📁</div>
        <div className="card-text">
          <strong>Filesystem</strong>
          <span>(littlefs.bin)</span>
        </div>
      </div>
    </div>
    <div className={`erase-card ${isOffline ? 'disabled' : ''}`} onClick={() => handleEraseNVS()}>
        {/* </div><input type="file" id="clear_nvs" hidden onChange={(e) => handleFileSelection(e, "firmware.bin", "firmware")} /> */}
        <div className="card-icon">🗑️</div>
        <div className="card-text">
          <strong>Clear Settings</strong>
          <span>(erase NVS)</span>
        </div>
    </div>
  </div>
);
}

export default Upload;
