/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATAFORSEO_LOGIN: string;
  readonly VITE_DATAFORSEO_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 