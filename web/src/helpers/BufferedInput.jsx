import React, { useState, useEffect } from 'react';

const BufferedInput = ({ value, onSave, className = "", placeholder = "" }) => {
    const [draft, setDraft] = useState(value || "");
    useEffect(() => setDraft(value || ""), [value]);
    return (
        <input
            className={`clean-input ${className}`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== value && onSave(draft)}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
    );
};
export default BufferedInput;