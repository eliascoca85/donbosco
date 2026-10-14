import { defineConfig, transformWithOxc } from 'vite'
import react from '@vitejs/plugin-react'

// Los componentes usan JSX dentro de archivos .js (no .jsx).
// Este plugin convierte ese JSX a JavaScript normal antes que el resto de Vite.
function jsxInJs() {
  let isDev = false
  return {
    name: 'jsx-in-js',
    enforce: 'pre',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
    async transform(code, id) {
      const file = id.split('?')[0]
      if (!/[\\/]src[\\/].*\.js$/.test(file)) return
      const result = await transformWithOxc(code, file, {
        lang: 'jsx',
        jsx: { runtime: 'automatic', development: isDev },
      })
      return { code: result.code, map: result.map }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [jsxInJs(), react()],
  // El escaneo inicial de dependencias tambien debe leer los .js como JSX
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: { '.js': 'jsx' },
    },
  },
})
