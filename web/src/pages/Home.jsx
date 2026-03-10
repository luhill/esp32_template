import { useState, useEffect, useContext } from "react";
import { useESPContext } from "../contexts/ESPContext";
import "../css/Home.css";
import ControlsPanel from "../components/ControlsPanel"

function Home() {
    const {espData, dummyData, updateEspControl, updateDummyControl } = useESPContext(); //grab controls from our global context

    return (
        <div className="home">
            {espData.status=="loading" && <ControlsPanel props={{controls:dummyData.home, status:dummyData.status}} onUpdate={updateDummyControl}/>}
            {espData.status=="loaded" && <ControlsPanel props={{controls:espData.home, status:espData.status}} onUpdate={updateEspControl}/>}
        </div>
    );
}

export default Home;