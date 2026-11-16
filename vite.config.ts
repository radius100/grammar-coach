import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import manifest from './manifest.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as ManifestV3Export })],
})
