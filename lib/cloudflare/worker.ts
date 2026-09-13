import handler from 'vinext/server/app-router-entry'

// Cloudflare-only boundary. Delegate all routing, auth and cookie handling to
// vinext unchanged. ASSETS handles public files before this Worker is invoked.
// Config headers alone do not cover App Router redirects in this adapter.
export default {
  async fetch(...args: Parameters<typeof handler.fetch>): Promise<Response> {
    const response = await handler.fetch(...args)
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'private, no-store, max-age=0')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
