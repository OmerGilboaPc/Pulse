import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/heebo/wght.css';
import './index.css';
import App from './App';

// Ask the browser to keep IndexedDB (watchlist, notes…) even under storage pressure.
if (navigator.storage?.persist) {
  void navigator.storage.persisted().then((p) => (p ? undefined : navigator.storage.persist())).catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
