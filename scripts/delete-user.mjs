/**
 * Hapus akun permanen via Firebase Admin SDK (Auth + Realtime Database).
 *
 * Kenapa perlu script? Firebase client (browser) TIDAK bisa menghapus
 * Auth user lain — deleteUser() hanya untuk sesi sendiri. Jadi tombol Hapus
 * di Admin hanya hapus tampilan/database; Auth-nya harus dihapus di sini.
 *
 * Cara pakai:
 *   node scripts/delete-user.mjs user1@example.com
 *   node scripts/delete-user.mjs --uid <UID>
 *   npm run delete-user -- user1@example.com
 *
 * Syarat:
 *   1. ./serviceAccountKey.json ada (Firebase Console > Project Settings > Service accounts)
 *   2. VITE_FIREBASE_DATABASE_URL di .env (atau argumen kedua)
 *
 * Menghapus: Auth user + accounts/<uid> + approvals/<uid> + sinkron launch_status.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const KEY_PATH = new URL('../serviceAccountKey.json', import.meta.url)

if (!existsSync(KEY_PATH)) {
  console.error('❌ serviceAccountKey.json tidak ditemukan di root proyek.')
  console.error('   Download dari Firebase Console > Project Settings > Service accounts.')
  process.exit(1)
}

let admin
try {
  admin = require('firebase-admin')
} catch {
  console.error('❌ Install dulu: npm i -D firebase-admin')
  process.exit(1)
}

const args = process.argv.slice(2).filter((a) => a !== '--')
if (args.length === 0) {
  console.error('❌ Cara pakai: node scripts/delete-user.mjs user@example.com | --uid <UID>')
  process.exit(1)
}

let targetUid = null
let targetEmail = null
if (args[0] === '--uid' && args[1]) {
  targetUid = args[1]
} else {
  targetEmail = args[0]
}

 // Baca .env sebagai fallback agar databaseURL selalu ada
try {
  if (!process.env.VITE_FIREBASE_DATABASE_URL && !process.env.FIREBASE_DATABASE_URL) {
    const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const m = envText.match(/VITE_FIREBASE_DATABASE_URL=(.+)/)
    if (m) process.env.VITE_FIREBASE_DATABASE_URL = m[1].trim()
  }
} catch { /* abaikan */ }

const databaseURL =
  process.env.VITE_FIREBASE_DATABASE_URL ||
  process.env.FIREBASE_DATABASE_URL ||
  (args[1] && args[1].startsWith('https://') ? args[1] : null)

const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL,
  })
}

const auth = admin.auth()
const rtdb = admin.database()

try {
  let uid = targetUid
  let email = targetEmail

  if (!uid && email) {
    try {
      const u = await auth.getUserByEmail(email)
      uid = u.uid
      email = u.email
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`ℹ️ Auth tidak punya ${email}. Cek sisa database...`)
        // Cari UID via database berdasarkan email (fallback)
        const accSnap = await rtdb.ref('accounts').once('value')
        const accs = accSnap.val() || {}
        const found = Object.entries(accs).find(([, a]) => a?.email?.toLowerCase() === email.toLowerCase())
        if (!found) {
          console.log('✅ Tidak ada sisa Auth maupun database. Selesai.')
          process.exit(0)
        }
        uid = found[0]
        console.log(`ℹ️ Ditemukan sisa database UID=${uid}, lanjut hapus database...`)
      } else throw e
    }
  }

  if (uid && !email) {
    try {
      const u = await auth.getUser(uid)
      email = u.email
    } catch { /* Auth mungkin sudah tidak ada, lanjut database */ }
  }

  // 1. Hapus Auth (jika masih ada)
  if (uid) {
    try {
      await auth.deleteUser(uid)
      console.log(`• Auth dihapus: ${email || uid} (${uid})`)
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`• Auth sudah tidak ada (${uid}), lanjut...`)
      } else throw e
    }
  }

  // 2. Hapus database
  if (uid) {
    await rtdb.ref(`accounts/${uid}`).remove()
    await rtdb.ref(`approvals/${uid}`).remove()
    console.log(`• Database dihapus: accounts/${uid} + approvals/${uid}`)
  }

  // 3. Sinkron launch_status
  const accSnap = await rtdb.ref('accounts').once('value')
  const apprSnap = await rtdb.ref('approvals').once('value')
  const accs = accSnap.val() || {}
  const apprs = apprSnap.val() || {}
  const userIds = Object.entries(accs).filter(([, a]) => a?.role === 'user').map(([id]) => id)
  const done = userIds.filter((id) => apprs[id] === true).length
  await rtdb.ref('launch_status').set({
    isLaunched: userIds.length > 0 && done >= userIds.length,
    totalApproved: done,
    totalAccounts: userIds.length,
  })
  console.log(`✅ Selesai. Email ${email || '(unknown)'} bisa dipakai lagi untuk buat akun baru.`)
  process.exit(0)
} catch (e) {
  console.error('❌ Gagal hapus:', e?.message || e)
  process.exit(1)
}