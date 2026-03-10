import { NavLink } from "react-router-dom";
import { useESPContext } from "../contexts/ESPContext";
import "../css/NavBar.css"

function NavBar() {
    const {espData} = useESPContext(); //grab controls from our global context
    return (
        <nav className="navbar" role="navigation" aria-label="Main">
            <div className="navbar-brand">
                <NavLink to="/" className="brand-link">{espData.app_name}</NavLink>
            </div>
            <div className="navbar-links" role="tablist" aria-label="Primary">
                <NavLink to="/" end className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>Home</NavLink>
                <NavLink to="/settings" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>Settings</NavLink>
                <NavLink to="/update" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>Update</NavLink>
            </div>
        </nav>
    );
}

export default NavBar