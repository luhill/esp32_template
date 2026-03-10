
import "../css/Switch.css"
import "../css/App.css"

function Switch({ props, setValue }) {

    const onInput = (e) => {
        if (setValue) {
            setValue(e.target.checked*1)//*1 cast to int
        }
    }

    return (
        <div className="switch">
            <label className="app-label font-base">{props.name}</label>
            <label>
                <input className = "color-minor"
                    type="checkbox" 
                    onChange={onInput} 
                    checked={props.value}/>
                <span className="slider round"></span>
            </label>
        </div>
    );
}

export default Switch