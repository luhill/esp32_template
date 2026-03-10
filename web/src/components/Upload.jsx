import { useState, useEffect, useRef } from "react";
import { useESPContext } from "../contexts/ESPContext";
import '../css/Upload.css';

function Upload() {
    const { espData } = useESPContext(); // Access global connection status
    const [status, setStatus] = useState("Ready");
    const [progress, setProgress] = useState(0);
    const [isWaiting, setIsWaiting] = useState(false);

    const handleFileSelection = (e, expectedName, type) => {
        const file = e.target.files[0];
        if (!file) {
            console.log("no file selected");
            return;
        }

        // 1. STRENGTHENED VALIDATION: Check exact filename
        if (file.name !== expectedName) {
            alert(`Invalid File! Please select "${expectedName}" specifically.`);
            e.target.value = ""; // Clear the input
            return;
        }

        // 2. Proceed to upload if valid
        uploadFile(file, type);
        e.target.value = "";//reset value so future upload events of same file name still trigger onchange callback
    };

    const uploadFile = (file, type) => {
        const xhr = new XMLHttpRequest();

        // 1. MUST attach listeners BEFORE calling xhr.open()
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                //cap percent at 95 as the browser upload speed doesnt match the esp32 write speed.
                //100 percent progress set when esp replies with ok
                const percent = Math.round((event.total > 0) ? (event.loaded / event.total) * 95 : 0);
                setProgress(percent);
                console.log(`Upload Progress: ${percent}%`); // Debug in Browser Console
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200){
                setProgress(100); // Only now do we fill the last 5%
                setStatus("Success! Rebooting...");
            }else setStatus("Error: " + xhr.statusText);
        };

        xhr.onerror = () => setStatus("Network Error");

        // 2. Open the connection
        xhr.open("POST", "/do-update");

        // 3. Set Headers AFTER open
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-File-Type", type);

        // 4. Send the raw file
        xhr.send(file);
        setStatus(`Starting ${type} upload...`);
    };
    // 1. Monitor for Reboot
    const pollingRef = useRef(false); // Track if we've started the loop


    useEffect(() => {
        // 1. We know we are waiting for a reboot if we just saw "Success"
        if (status.includes("Success")) {
            setIsWaiting(true);

            // 2. While disconnected, show the "Rebooting" message
            if (espData.connection === "disconnected" || espData.connection === "connecting") {
                setStatus("Rebooting... Waiting for device...");
            }

            // 3. THE TRIGGER: If we were waiting and the status flips back to "connected"
            if (espData.connection === "connected") {
                console.log("✅ WebSocket Restored! Reloading app...");
                setStatus("Online! Syncing...");
                setIsWaiting(false);
                // Wait 1 second to let the ESP32 finish its "First Boot" JSON push
                // then force a reload to ensure we have the new UI files.
                setTimeout(() => {
                    //console.log("reload timer");
                    setStatus("Ready");
                    setProgress(0);
                    //window.location.reload();
                }, 1000);
            }
        }
    }, [espData.connection, status]); // Only depends on these two strings

    return (

        <div className="controlsPanel font-base">
            <h4 className="group-title">System Update</h4>

            {/* Progress Bar */}
            <div className="progress-container color-minor">
                <div className="progress-fill color-major" style={{ width: `${progress}%` }} />
            </div>

            {/* Firmware Row */}
            <div className="controlRow update-row">
                <label className="app-label">Firmware</label>
                <input
                    type="file"
                    id="firm_input"
                    className="file-input-hidden"
                    onChange={(e) => handleFileSelection(e, "firmware.bin", "firmware")}
                />
                <button
                    className="app-btn update-btn font-base color-major color-minor"
                    onClick={() => document.getElementById('firm_input').click()}
                    disabled={isWaiting}
                >
                    Select .bin
                </button>
            </div>

            {/* Filesystem Row */}
            <div className="controlRow update-row">
                <label className="app-label">Filesystem</label>
                <input
                    type="file"
                    id="fs_input"
                    className="file-input-hidden"
                    onChange={(e) => handleFileSelection(e, "littlefs.bin", "fs")}
                />
                <button
                    className="app-btn update-btn font-base color-major color-minor"
                    onClick={() => document.getElementById('fs_input').click()}
                    disabled={isWaiting}
                >
                    Select .bin
                </button>
            </div>

            <p className="status-readout color-major">{status}</p>
        </div>
    );
}
export default Upload;