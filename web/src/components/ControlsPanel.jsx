import { useState, useContext, useEffect } from "react";
import Slider from "./Slider";
import Switch from "./Switch";
import Led from "./Led";
import Time from "./Time";
import Auto from "./Auto";
import SwitchSlider from "./SwitchSlider";
import Display from "./Display";
import Button from "./Button";
import List from "./List";
import '../css/App.css';
//import "../css/ControlsPanel.css";


function ControlsPanel({ props, onUpdate}) {
    
      const controlForTool = (id,config) => {
        switch (config.type) {
            case "slider":
                return (<Slider props={config} setValue={(v) =>{
                    onUpdate(id,v);
                }}/>)
                break;
            case "switch":
                // return (<Switch props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                const hasOnKey = config.value?.on !== undefined;
                const currentValue = hasOnKey ? config.value.on : config.value;
                return (<Switch props={{...config, value: !!currentValue}} setValue={(v) => {onUpdate(id, hasOnKey ? { on: v } : v);}}/>);
                break;
            case "led":
                return (<Led props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "dateTime":
                return (<Time props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "autoStartStop":
                return (<Auto props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "switchSlider":
                return (<SwitchSlider props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "display":
                return (<Display props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "button":
                return (<Button props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            case "list":
                return (<List props={config} setValue={(v) =>{onUpdate(id,v)}}/>)
                break;
            default:
                return (
                    <p key={id}>Unknown Control:{JSON.stringify(config, null, "\t")}</p>
                )
        }
    }

return (
  <div className="controlsPanel">
    {props.status !== "loaded" ? (
      /* Case 1: Still Loading */
      <p className="status-msg">Loading</p>
    ) : props.controls && Object.keys(props.controls).length > 0 ? (
      /* Case 2: Loaded AND Controls Exist */
      Object.entries(props.controls).map(([id, config]) => (
        <div className="controlRow" key={id}>
          {controlForTool(id, config)}
        </div>
      ))
    ) : (
      /* Case 3: Loaded BUT No Controls in this group */
      <p className="status-msg empty">No items available.</p>
    )}
  </div>
);
}
export default ControlsPanel