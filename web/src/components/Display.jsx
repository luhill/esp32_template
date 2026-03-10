import "../css/Display.css"
import '../css/App.css';


function Display({ 
  props: { 
    name = "System Info", 
    value = {},      // This is now the object {rssi: -65, ip: "192..."}
    append = "",    // Default unit if not specified per-key
    thresholds = {}  // Optional: { rssi: -80, cpu: 90 }
  } 
}) {
  return (
    <div className="controlsRow font-base">
      <h4 className="group-title">{name}</h4>
      
      {Object.entries(value).map(([key, val]) => {
        // 1. Format the label (rssi -> RSSI, date_time_now -> Date Time Now)
        const label = key.replace(/_/g, ' ').toUpperCase();
        
        // 2. Check individual threshold for this specific key
        const isAlert = thresholds[key] !== undefined && val > thresholds[key];

        return (
          <div className="display-row" key={key}>
            <label className="app-label font-base">{label}</label>
            <div className="value-container">
            <samp className={`display-readout ${isAlert ? 'text-alert' : 'text-ok'}`}>
              {val}
              <small className="display-unit">
                {/* Use specific unit if key matches, otherwise use global append */}
                {key === 'rssi' ? 'dBm' : key === 'cpu' ? '%' : append}
              </small>
            </samp>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Display;