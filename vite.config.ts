// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

export default defineConfig({
  base: '/CRM/',    // ⭐ Important for deploying under /CRM

  plugins: [react()],

  resolve: {
    alias: {
      recharts: 'recharts/lib/index.js',
      process: 'process/browser',
      buffer: 'buffer',
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', 'simple-peer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
        NodeModulesPolyfillPlugin()
      ],
    },
  },

  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});