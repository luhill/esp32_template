import "../css/Display.css"

function List({ props: { value: { entries = "[]" } } }) {
  //const logList = JSON.parse(entries);
const logList = typeof entries === 'string' ? JSON.parse(entries) : entries;
  return (
    <div className="controlsRow font-base">
      <h4 className="group-title">System Logs</h4>
      <div className="log-container color-minor">
        {logList.length === 0 ? (
          <p className="log-entry">No events recorded.</p>
        ) : (
          logList.map((entry, i) => (
            <div key={i} className="log-entry color-major">
              <samp className="display-readout"><small><small>{entry}</small></small></samp>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
export default List;