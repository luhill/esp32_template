import React, { useState, useRef, useEffect} from 'react';
import { downloadAppleShortcut, setupSiriShortcut} from '../helpers/ShortcutHelper';
import { useESPContext } from '../contexts/ESPContext';
import {Sparkles} from 'lucide-react';

const ShortcutTrigger = ({ host, shortcuts }) => {
    const [isOpen, setIsOpen] = useState(false);
    // 1. Create a ref to track the entire component area
    const menuRef = useRef(null);

    // Haptic helper for PWA feel
    const hapticFeedback = (ms = 10) => {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(ms);
        }
    };

    // 2. Click Outside Logic
    useEffect(() => {
        const handleClickOutside = (event) => {
            // If the menu is open and the click is NOT inside our menuRef
            if (isOpen && menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside); // Mobile optimization
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    if (!shortcuts || Object.keys(shortcuts).length === 0) return null;

    const onTriggerClick = (e, label, uri) => {
        e.stopPropagation(); 
        hapticFeedback(15); // Slightly stronger vibe for a "Confirm" action
        
        // Setup the shortcut logic
        setupSiriShortcut(host, label, uri);
        
        setIsOpen(false);

        alert(
            `✅ URL for "${label}" copied!\n\n` +
            `The Shortcuts app is opening. Follow these steps:\n` +
            `1. Tap 'Add Action'\n` +
            `2. Search for 'URL'\n` +
            `3. Choose 'Get Contents of URL'\n` +
            `4. Paste your link into the URL field.`
        );
    };

    return (
        /* 3. Attach the ref to the parent container */
        <div className="shortcut-container" ref={menuRef}>
            <button 
                className={`shortcut-icon-btn ${isOpen ? 'active' : ''}`}
                onClick={(e) => {
                    e.stopPropagation(); 
                    hapticFeedback(10); // Standard "Tick"
                    setIsOpen(!isOpen);
                }}
                type="button"
            >
                <Sparkles size={16} />
            </button>

            {isOpen && (
                <div className="shortcut-dropdown">
                    <div className="shortcut-header">Siri Shortcuts</div>
                    {Object.entries(shortcuts).map(([label, uri]) => (
                        <div 
                            key={uri} 
                            className="shortcut-item"
                            onClick={(e) => onTriggerClick(e, label, uri)}
                        >
                            Add "{label}"
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ShortcutTrigger;