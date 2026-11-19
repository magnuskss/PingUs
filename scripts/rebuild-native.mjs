// Rebuilds native modules (better-sqlite3) for Electron's ABI.
// Non-fatal: if the toolchain is unavailable, the app falls back to a JSON
// history store at runtime, so install must not fail here.
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx', ['electron-builder', 'install-app-deps'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (r.status !== 0) {
  console.warn(
    '\n[pingus] Native rebuild of better-sqlite3 did not complete.\n' +
    '         The app will still run and use a JSON history store.\n' +
    '         To enable SQLite, install build tools and run: npm run rebuild\n'
  )
}
// Always exit 0 so `npm install` succeeds.
process.exit(0)
