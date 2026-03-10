import { useState, useEffect, useContext } from "react";
import { useESPContext } from "../contexts/ESPContext";
import "../css/Home.css";
import ControlsPanel from "../components/ControlsPanel"

function Settings() {
    const {espData, dummyData, updateEspControl, updateDummyControl } = useESPContext(); //grab controls from our global context

    return (
        <div className="home">
                        {espData.status=="loading" && <ControlsPanel props={{controls:dummyData.settings, status:dummyData.status}} onUpdate={updateDummyControl}/>}
            {espData.status=="loaded" && <ControlsPanel props={{controls:espData.settings, status:espData.status}} onUpdate={updateEspControl}/>}
        </div>
    );
}

export default Settings;