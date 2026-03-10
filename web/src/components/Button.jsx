import '../css/App.css';

function Button({ 
  props: { 
    id, 
    name = "Button", 
    value: { click = true } 
  }, 
  setValue 
}) {
  const handleClick = () => {
    // We send a dummy value (like 'true' or 'click') to trigger the C++ onUpdate
    // This goes through WebSocket as {"touch_btn": true}
    setValue({click:true}); 
  };

  return (
    <div className="control-row button-row">
    {/* <label className="auto-label font-base">{name}</label> */}
      <div className="button-group">
        <button className="app-btn font-base" onClick={handleClick}>
          {name}
        </button>
      </div>
    </div>
  );
}
export default Button;