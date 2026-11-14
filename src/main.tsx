import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
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
  if (
    args.some(
      (a) =>
        typeof a === 'string' &&
        (a.includes('OverQuotaMapError') ||
          a.includes('RESOURCE_EXHAUSTED') ||
          a.includes('quota'))
    )
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  _origConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);

