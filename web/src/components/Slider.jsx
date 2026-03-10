import '../css/Slider.css';
import '../css/App.css';

function Slider({ props, setValue }) {

    const onInput = (e) => {
        if (setValue) {
            setValue(parseFloat(e.target.value));
        }
    }

    const max = typeof props?.max !== "undefined" ? props.max : 100;
    const min = typeof props?.min !== "undefined" ? props.min : 0;
    const useIcon = typeof props?.useIcon !== "undefined" ? props.useIcon : false;

    return (
        <div className="slider-row">
            {props.name && (
                <label className="slider-label" title={props.name}>
                    {/* visible text only when useIcon is false; always include hidden text for accessibility */}
                    <span className={useIcon ? "visually-hidden" : "font-base"}>{props.name}</span>
                    {useIcon && <span className="slider-icon font-base" aria-hidden="true">☀</span>}
                </label>
            )}
            <input
                className="slider-input color-base"
                type="range"
                min={min}
                max={max}
                onInput={onInput}
                value={props.value}
            />
            <div className="slider-value color-minor">
                 <span className="color-minor">{props.value}</span>
                {props.append && <span className="slider-append color-minor">{props.append}</span>}
            </div>
        </div>
    );
}

export default Slider