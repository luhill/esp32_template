/**
 * Generates and triggers a download for an Apple Shortcut (.shortcut)
 * hits the ESP32 directly via HTTP GET.
 */
export const downloadAppleShortcut = (host, name, uri) => {
    // Determine base URL (Remote vs Local)
    const baseUrl = window.location.origin.includes('drnadiaelahi.com') 
                    ? `https://home.drnadiaelahi.com` 
                    : `http://${host}`;

    const targetUrl = `${baseUrl}${uri}`;

    const shortcutXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>WFWorkflowActions</key>
    <array>
        <dict>
            <key>WFWorkflowActionIdentifier</key>
            <string>is.workflow.actions.downloadurl</string>
            <key>WFWorkflowActionParameters</key>
            <dict>
                <key>WFURL</key>
                <string>${targetUrl}</string>
                <key>WFHTTPMethod</key>
                <string>GET</string>
            </dict>
        </dict>
    </array>
    <key>WFWorkflowName</key>
    <string>${name}</string>
</dict>
</plist>`;

    const blob = new Blob([shortcutXml], { type: 'application/x-apple-as-shortcut' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/\s+/g, '_')}.shortcut`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

export const getDeviceApiUrl = (deviceHost, endpoint) => {
    const isESP32 = import.meta.env.VITE_PLATFORM === 'ESP32';
    const windowHost = window.location.hostname;
    const protocol = window.location.protocol; // 'http:' or 'https:'

    // Format the target address (matching your WebSocket logic)
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(deviceHost);
    const target = isIp ? deviceHost : `${deviceHost}.local`;

    if (isESP32) {
        // Direct connection (Direct ESP access)
        return `${protocol}//${target}${endpoint}`;
    } else {
        // Use the Pi's Nginx Proxy tunnel (Same as /esp_proxy/ logic)
        // We replace /ws with the actual API endpoint
        return `${protocol}//${windowHost}/esp_proxy/${target}${endpoint}`;
    }
};

export const setupSiriShortcut = (deviceHost, name, endpoint) => {
    const targetUrl = getDeviceApiUrl(deviceHost, endpoint);

    // 1. Fallback Clipboard Copy
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(targetUrl);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = targetUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) { console.error(err); }
        document.body.removeChild(textArea);
    }

    // 2. Open Shortcuts App
    // We use a small delay to ensure the copy command finished
    setTimeout(() => {
        window.location.href = "shortcuts://create-shortcut";
    }, 200);

    return targetUrl;
};