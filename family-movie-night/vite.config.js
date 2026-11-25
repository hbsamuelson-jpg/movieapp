import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every build gets an id. It is baked into the app and also written to /version.json,
// so a running copy can tell when a newer build has been deployed (see src/lib/autoUpdate.js).
const buildId = String(Date.now());
const versionFile = () => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
  },
});

// `npm run build:single` inlines everything into one HTML file (handy for sharing the demo).
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss(), versionFile(), ...(process.env.SINGLE_FILE ? [viteSingleFile()] : [])],
});
