const allowedMethods = new Set(['GET', 'HEAD'])

export default {
  async fetch(request, env) {
    if (!allowedMethods.has(request.method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      })
    }

    if (!env?.ASSETS?.fetch) {
      return new Response('Static asset service unavailable', { status: 503 })
    }

    const url = new URL(request.url)
    const isAssetRequest = /\.[a-z0-9]+$/i.test(url.pathname)

    if (isAssetRequest) {
      return env.ASSETS.fetch(request)
    }

    const indexUrl = new URL('/index.html', url)
    return env.ASSETS.fetch(new Request(indexUrl, request))
  },
}
