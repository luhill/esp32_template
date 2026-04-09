import { useState } from "react";
import Switch from "./Switch";
import Slider from "./Slider";
import '../css/Slider.css';
import '../css/Switch.css';
import '../css/App.css';

function SwitchSlider({ data, setValue }) {
  // 1. Defensive Extraction of the nested 'value' object
  const config = data || {};
  const valObj = config.value || {};
  
  // 2. Determine Display Value (Target vs Actual)
  // We prioritize 'duty_target' for the UI thumb position
  const displayDuty = valObj.duty_target ?? valObj.duty ?? 0;
  const isPowerOn = !!valObj.on;

  const handleSwitch = (switchVal) => {
    if (typeof setValue === 'function') {
      // Send a partial update object back to the ESP32
      setValue({ on: !!switchVal ? 1 : 0 });
    }
  };

  const handleSlider = (v) => {
    if (typeof setValue === 'function') {
      // 3. Logic: Update target if it exists, otherwise update duty directly
      const keyToUpdate = ("duty_target" in valObj) ? "duty_target" : "duty";
      setValue({ [keyToUpdate]: v });
    }
  };

  return (
    <div className="switch-slider-container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      width: '100%',
      padding: '4px 0' 
    }}>
      {/* 4. The Toggle Area */}
        <Switch 
          data={{ 
            name: config.name || "Power", 
            value: isPowerOn 
          }} 
          setValue={handleSwitch} 
        />
      {/* 5. The Slider Area */}
        <Slider 
          data={{ 
            ...config, 
            name: '', // We hide the name on the slider to avoid double labels
            value: displayDuty,
            // Ensure min/max are passed through from the main config
            min: config.min ?? 0,
            max: config.max ?? 100,
            append: config.append || "%"
          }} 
          setValue={handleSlider} 
        />
      </div>
  );
}

export default SwitchSlider;
