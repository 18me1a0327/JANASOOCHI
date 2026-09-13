// Read-only HTTP smoke checks. No credentials, voter queries or source uploads.
// Run after pnpm preview:cloudflare, or pass the authorized deployment origin.
import assert from 'node:assert/strict'

const origin = process.argv[2] || 'http://localhost:4173'
assert(['http:', 'https:'].includes(new URL(origin).protocol))
let checks = 0
async function request(path, options = {}) {
  return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options })
}
async function check(label, test) {
  await test()
  checks++
  console.log(`PASS ${label}`)
}

await check('home redirects to Search', async () => {
  const response = await request('/')
  assert.equal(response.status, 307)
  assert.equal(new URL(response.headers.get('location'), origin).pathname, '/search')
})
await check('configured login HTML and no-store', async () => {
  const response = await request('/login')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  const html = await response.text()
  assert.match(html, /login-title/)
  assert.doesNotMatch(html, /Supabase is not configured|"stack":/)
})
for (const path of ['/search', '/documents', '/review', '/data-quality', '/administration', '/profile', '/source/00000000-0000-0000-0000-000000000000?page=1']) {
  await check(`anonymous and spoofed role rejected: ${path}`, async () => {
    for (const cookie of ['', 'role=admin']) {
      const response = await request(path, { headers: { cookie } })
      assert.equal(response.status, 307)
      assert.equal(new URL(response.headers.get('location'), origin).pathname, '/login')
      assert.match(response.headers.get('cache-control') || '', /no-store/)
    }
  })
}
await check('standalone manifest/start URL and icon assets', async () => {
  const response = await request('/manifest.webmanifest')
  assert.equal(response.status, 200)
  const manifest = await response.json()
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/search')
  for (const icon of manifest.icons) {
    const asset = await request(icon.src)
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('content-type') || '', /image\/png/)
  }
})
await check('service worker and exact offline URL', async () => {
  const response = await request('/sw.js')
  assert.equal(response.status, 200)
  assert.match(await response.text(), /janasoochi-safe-shell/)
  const offline = await request('/offline.html')
  assert.equal(offline.status, 200)
  assert.match(offline.headers.get('content-type') || '', /text\/html/)
})
await check('unknown route is a safe 404', async () => {
  const response = await request('/not-a-janasoochi-route')
  assert.equal(response.status, 404)
  assert.doesNotMatch(await response.text(), /"stack":|at refreshSession/)
})
console.log(`${checks}/${checks} HTTP smoke checks passed; authenticated account QA remains separate.`)
