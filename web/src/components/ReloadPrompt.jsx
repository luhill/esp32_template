import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
//import { registerSW } from 'virtual:pwa-register';
import { XCircle } from 'lucide-react';
import "../css/ReloadPrompt.css";

function ReloadPrompt() {
  const [showDevUpdate, setShowDevUpdate] = useState(import.meta.env.DEV);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      //check for updates every hour
      r && setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
    setShowDevUpdate(false);
  };

  const shouldShow = needRefresh || showDevUpdate;
  return (
    <>
      {shouldShow && (

        <div className="pwa-toast-container">
          <button className="pwa-refresh-btn" onClick={() => updateServiceWorker(true)}>
            Update Available
          </button>

          <button className="pwa-close-btn" onClick={() => close()}>
            <XCircle size={25} />
          </button>
        </div>

      )}
      );
    </>
  );
}

export default ReloadPrompt;