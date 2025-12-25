import { useEffect } from 'react';
import Home from './Home';

/**
 * Wrapper component for the '/' route that intelligently handles navigation:
 * - In Firebase Hosting mode: Does a real browser navigation to '/' to load the static landing page
 * - In naked dev mode (port 5000): Renders the Home component normally
 *
 * This allows users to navigate back to the static landing page from within the React app
 * when running in Firebase Hosting, while maintaining the normal behavior in dev mode.
 */
function RootRedirect() {
  // Detect if we're running in Firebase Hosting vs. naked Vite dev server
  // Vite dev server runs on port 5000, Firebase Hosting emulator runs on port 3400
  const isViteDevMode = window.location.port === '5000';

  useEffect(() => {
    if (!isViteDevMode) {
      // We're in Firebase Hosting mode - do a real browser navigation to load the static landing page
      window.location.href = '/';
    }
  }, [isViteDevMode]);

  // If in Vite dev mode, render Home component normally
  // If in Hosting mode, return null while the browser navigates away
  return isViteDevMode ? <Home /> : null;
}

export default RootRedirect;
