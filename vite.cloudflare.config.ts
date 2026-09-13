import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'

// A separate configuration keeps legacy Vite tests and Next/Netlify untouched.
// No Images, KV, D1, OCR or sensitive-response caching bindings are enabled.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } }),
  ],
  worker: { format: 'es' },
})
