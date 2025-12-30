import { useEffect } from 'react';
import { getEnvironment } from '../utils/environment';

/**
 * Hook to set document.title with environment prefix
 * @param title - Page title (e.g., "Home", "My Campaign", "My Campaign | Map Name")
 *                Pass undefined to skip updating the title (e.g., while data is loading)
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title === undefined) {
      return; // Don't update title while loading
    }

    const env = getEnvironment();
    let prefix = '';
    if (env === 'development') {
      prefix = '[Dev] ';
    } else if (env === 'test') {
      prefix = '[Test] ';
    }

    document.title = `${prefix}${title} - Wall & Shadow`;
  }, [title]);
}
