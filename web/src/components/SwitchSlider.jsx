import { useState } from "react";
import Switch from "./Switch";
import Slider from "./Slider";
import '../css/Slider.css';
import '../css/Switch.css';
import '../css/App.css';

function SwitchSlider({ props, setValue }) {
  // 1. Determine which value to display in the UI
  // This says: Use duty_target if it exists (is not null/undefined), otherwise use duty.
  const displayDuty = props.value.duty_target ?? props.value.duty;

  const handleSwitch = (switchVal) => {
    setValue({ on: switchVal });
  };

  const handleSlider = (v) => {
    // 2. Decide which key to update when the slider moves
    // If duty_target exists in the object, update that; otherwise update duty.
    const keyToUpdate = ("duty_target" in props.value) ? "duty_target" : "duty";
    setValue({ [keyToUpdate]: v });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
      <div style={{ flexShrink: 0 }}>
        <Switch 
          props={{ ...props, value: props.value.on }} 
          setValue={handleSwitch} 
        />
      </div>
      <Slider 
        props={{ ...props, name: '', value: displayDuty }} 
        setValue={handleSlider} 
      />
    </div>
  );
}

export default SwitchSlider;
