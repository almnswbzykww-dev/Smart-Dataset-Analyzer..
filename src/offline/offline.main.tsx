import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
import '@fontsource/cairo/900.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/700.css';
import '../index.css';
import { registerSW } from 'virtual:pwa-register';
import OfflineApp from './OfflineApp';
import { OfflineErrorBoundary } from './components/OfflineErrorBoundary';

// Register offline caching Service Worker cleanly
try {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // Cached assets ready for offline execution
    },
  });
} catch {
  // Safe fallback if running in non-SW browser environment
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OfflineErrorBoundary>
      <OfflineApp />
    </OfflineErrorBoundary>
  </React.StrictMode>
);
