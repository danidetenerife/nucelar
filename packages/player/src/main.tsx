import ReactDOM from 'react-dom/client';

import '@nuclearplayer/tailwind-config';
import '@nuclearplayer/themes';
import '@nuclearplayer/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);

const isTauri = Boolean(
  typeof window !== 'undefined' &&
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
);

const isRemoteUrl =
  typeof window !== 'undefined' &&
  (window.location.pathname.includes('/remote') ||
    window.location.search.includes('remote'));

try {
  if (isRemoteUrl && !isTauri) {
    const { initRemoteApp } = await import('./remoteControl');
    initRemoteApp(root);
  } else {
    const { initPlayerApp } = await import('./initPlayerApp');
    await initPlayerApp(root);
  }
} catch (error) {
  console.error('Fatal initialization error:', error);
}
