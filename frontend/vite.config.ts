import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Wallet dependencies reach for Node's Buffer through bs58 -> base-x ->
    // safe-buffer, which reads `Buffer.from` off the global at module load.
    // Without this the app threw during boot and rendered a blank page in dev.
    //
    // Hand-rolling it does not work: Vite treats the bare name `buffer` as a
    // Node builtin and externalises it to a stub that throws on property
    // access, and a polyfill assigned inside main.tsx runs too late anyway
    // because import declarations are hoisted above it.
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  server: {
    proxy: {
      // Overridable so a second backend can run alongside the default one,
      // which is what the end-to-end checks do.
      '/api': process.env.API_PROXY || 'http://localhost:3001',
    },
  },
})
