// Verifies dist/ against the MV3 contracts in migration/INVENTORY.md.
// Run after `pnpm run build`: node scripts/check-dist.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const EXPECTED = {
  permissions: ['storage', 'declarativeNetRequest'],
  host_permissions: [
    'https://www.linkedin.com/*',
    'https://linkedin.com/*',
    'https://media.licdn.com/*',
    'https://ai-gateway.vercel.sh/*',
  ],
  content_matches: ['https://www.linkedin.com/*', 'https://linkedin.com/*'],
  run_at: 'document_idle',
}
// XML namespaces, library doc/metadata links and the AI Gateway endpoint, all
// appearing in bundled source strings (template ids, error links, API base URL).
const BENIGN_URL_HOSTS = ['www.w3.org', 'vercel.com', 'vuejs.org', 'json-schema.org', 'ai-gateway.vercel.sh']
const PATH_EXT = /\.(js|css|html|png|svg|json)$/

const errors = []
const fail = (msg) => errors.push(msg)
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'))

const referenced = []
const collect = (value) => {
  if (typeof value === 'string') {
    if (PATH_EXT.test(value) && !/^https?:/.test(value)) referenced.push(value)
  } else if (Array.isArray(value)) value.forEach(collect)
  else if (value && typeof value === 'object') Object.values(value).forEach(collect)
}
collect(manifest)
for (const path of referenced) {
  try {
    statSync(join(DIST, path))
  } catch {
    fail(`manifest references missing dist file: ${path}`)
  }
}

if (!same(manifest.permissions ?? [], EXPECTED.permissions))
  fail(`permissions ${JSON.stringify(manifest.permissions)} != INVENTORY ${JSON.stringify(EXPECTED.permissions)}`)
if (!same(manifest.host_permissions ?? [], EXPECTED.host_permissions))
  fail(`host_permissions ${JSON.stringify(manifest.host_permissions)} != INVENTORY`)
for (const script of manifest.content_scripts ?? []) {
  if (!same(script.matches ?? [], EXPECTED.content_matches))
    fail(`content_scripts.matches ${JSON.stringify(script.matches)} != INVENTORY`)
  if (script.run_at !== EXPECTED.run_at) fail(`content_scripts.run_at ${script.run_at} != ${EXPECTED.run_at}`)
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )
const scanned = walk(DIST).filter((file) => file.endsWith('.js'))
const urls = new Set()
for (const file of scanned) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (/\beval\s*\(|new Function/.test(line)) fail(`${file}:${index + 1} uses eval/new Function`)
    for (const match of line.matchAll(/https?:\/\/[^\s'"`)\]}]+/g)) {
      // minified template literals can leave partial URLs like `http://${x`
      try {
        urls.add(new URL(match[0]).host)
      } catch {}
    }
  })
}
for (const host of urls) {
  if (!BENIGN_URL_HOSTS.includes(host)) fail(`unexpected URL host in dist JS: ${host}`)
}

console.log(`scanned ${scanned.length} JS files, ${referenced.length} manifest paths`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('check:dist ok')
