import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Konfigurasi dibaca dari environment variable (Vite: import.meta.env).
// Salin .env.example menjadi .env dan isi nilainya dari Firebase Console.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getDatabase(app)

// Ingat login terakhir di browser (auto-masuk ke akun terakhir di /login).
// Default Firebase sudah local, ini dieksplisitkan agar tidak berubah.
setPersistence(auth, browserLocalPersistence).catch(() => {})

// Secondary app khusus pembuatan akun oleh admin.
// createUser di secondaryAuth TIDAK memindahkan sesi admin utama,
// jadi admin tetap login setelah buat banyak akun.
const secondaryApp = initializeApp(firebaseConfig, 'secondary')
export const secondaryAuth = getAuth(secondaryApp)

export default app