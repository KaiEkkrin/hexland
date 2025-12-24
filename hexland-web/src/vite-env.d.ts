/// <reference types="vite/client" />

// Build-time constants injected by Vite
declare const __GIT_COMMIT__: string;

// Environment-specific type definitions
interface ImportMetaEnv {
  readonly VITE_DEPLOY_ENV?: 'production' | 'test' | 'development';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
