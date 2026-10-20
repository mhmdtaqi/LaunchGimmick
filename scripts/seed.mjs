/**
 * Seed akun awal via Firebase Admin SDK.
 *
 * Cara pakai:
 *  1. Firebase Console > Project Settings > Service accounts > Generate new private key
 *     Simpan sebagai ./serviceAccountKey.json (jangan commit!)
 *  2. npm run seed
 *  3. Edit daftar USERS di bawah sesuai kebutuhan.
 *
 * Membuat: 1 admin + 2 user biasa, + reset approvals & launch_status.
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

// firebase-admin diinstall on-demand saat seed agar bundle client tetap ringan
let admin
try {
  admin = require('firebase-admin')
} catch {
  console.error('❌ Install dulu: npm i -D firebase-admin')
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'))

// DATABASE_URL bisa via env atau argumen
const databaseURL =
  process.env.VITE_FIREBASE_DATABASE_URL ||
  process.env.FIREBASE_DATABASE_URL ||
  process.argv[2]

if (!databaseURL) {
  console.error('❌ Set VITE_FIREBASE_DATABASE_URL di .env atau: npm run seed -- <databaseURL>')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL,
})

const USERS = [
  { email: 'admin@example.com', password: 'admin123', displayName: 'Admin', role: 'admin' },
  { email: 'user1@example.com', password: 'user1234', displayName: 'User 1', role: 'user' },
  { email: 'user2@example.com', password: 'user1234', displayName: 'User 2', role: 'user' },
]

const auth = admin.auth()
const rtdb = admin.database()

for (const u of USERS) {
  let uid
  try {
    const existing = await auth.getUserByEmail(u.email)
    uid = existing.uid
    console.log(`• ${u.email} sudah ada (${uid}), update password…`)
    await auth.updateUser(uid, { password: u.password, displayName: u.displayName })
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: u.email, password: u.password, displayName: u.displayName,
      })
      uid = created.uid
      console.log(`• ${u.email} dibuat (${uid})`)
    } else throw e
  }
  await rtdb.ref(`accounts/${uid}`).set({ email: u.email, role: u.role, displayName: u.displayName })
  await rtdb.ref(`approvals/${uid}`).set(false)
}

const accSnap = await rtdb.ref('accounts').once('value')
const accs = accSnap.val() || {}
const totalAccounts = Object.values(accs).filter((a) => a?.role === 'user').length
await rtdb.ref('launch_status').set({ isLaunched: false, totalApproved: 0, totalAccounts })

console.log(`✅ Seed selesai. totalAccounts(user) = ${totalAccounts}`)
process.exit(0)