import "../css/Display.css"
import '../css/App.css';


function Display({ data }) {
  // 1. Defensive Extraction
  // We rename to 'config' inside the function to keep things clear
  const config = data || {};
  const name = config.name || "System Info";
  const value = config.value || {}; 
  const append = config.append || "";
  const thresholds = config.thresholds || {};

  // 2. Safety Check: If 'value' is accidentally a string, don't crash the map
  const displayEntries = (typeof value === 'object' && value !== null) 
    ? Object.entries(value) 
    : [];

  return (
    <div className="controlsRow font-base">
      <h4 className="group-title">{name}</h4>
      
      {displayEntries.length === 0 ? (
        <p className="display-msg ui-color-minor">No data available</p>
      ) : (
        displayEntries.map(([key, val]) => {
          // 3. Hardened Label Formatting
          // Converts "rssi_level" -> "RSSI LEVEL" or "ip" -> "IP"
          const label = String(key).replace(/_/g, ' ').toUpperCase();
          
          // 4. Smart Threshold Logic
          // Check if value is a number before comparing to avoid false alerts
          const numericVal = Number(val);
          const threshold = thresholds[key];
          let isAlert = false;

          if (threshold !== undefined && !isNaN(numericVal)) {
            // Logic: Alert if RSSI is LESS than threshold (signal drop) 
            // OR if other values (CPU/Temp) are GREATER than threshold
            isAlert = key === 'rssi' ? numericVal < threshold : numericVal > threshold;
          }

          return (
            <div className="display-row" key={key}>
              <label className="display-label font-base">{label}</label>
              <div className="value-container">
                <samp className={`display-readout ${isAlert ? 'text-alert' : 'text-ok'}`}>
                  {/* Handle null/undefined values gracefully */}
                  {val ?? '--'}
                  
                  <small className="display-unit">
                    {key === 'rssi' ? ' dBm' : key === 'cpu' ? '%' : ` ${append}`}
                  </small>
                </samp>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default Display;