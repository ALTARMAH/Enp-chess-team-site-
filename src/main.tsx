import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __enpGmpFailed?: boolean;
  }
}

const triggerGmpFallback = () => {
  window.__enpGmpFailed = true;
  window.dispatchEvent(new CustomEvent('gmp-map-fallback'));
};

window.gm_authFailure = () => {
  triggerGmpFallback();
};

const _origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    args.some(
      (a) =>
        typeof a === 'string' &&
        (a.includes('Cannot set property fetch') ||
          a.includes('chrome-extension://'))
    )
  ) {
    return;
  }
  const joined = args.map((a) => String(a)).join(' ');
  if (
    joined.includes('OverQuotaMapError') ||
    joined.includes('BillingNotEnabledMapError') ||
    joined.includes('ApiNotActivatedMapError') ||
    joined.includes('RefererNotAllowedMapError') ||
    joined.includes('InvalidKeyMapError') ||
    joined.includes('Google Maps JavaScript API error')
  ) {
    triggerGmpFallback();
  }
  _origConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);

