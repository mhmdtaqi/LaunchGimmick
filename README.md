# Launch Gimmick — React + Firebase

Website launch gimmick dengan trigger berjamaah. 4 halaman: **Launch (`/`)**, **Login (`/login`)**, **Trigger (`/trigger`)**, **Admin (`/admin`)**. Setelah semua akun user approve (atau admin tekan Approve All), video `public/video.mp4` diputar full screen.

## Struktur

```
.
├── public/video.mp4
├── src/
│   ├── firebase.js            # init Firebase (Auth + RTDB via .env)
│   ├── context/AuthContext.jsx
│   ├── hooks/useLaunch.js     # listener realtime approvals/accounts/launch_status
│   ├── components/
│   │   ├── LaunchSphere.jsx   # sphere 3D + dashed ring 2 axis
│   │   ├── WaterBar.jsx       # vertical bar air (tanpa teks)
│   │   └── HoldButton.jsx     # tombol tahan 3 detik + progress ring
│   ├── pages/
│   │   ├── Launch.jsx
│   │   ├── Login.jsx
│   │   ├── Trigger.jsx
│   │   └── Admin.jsx
│   ├── App.jsx                # routing + proteksi role
│   ├── main.jsx
│   └── index.css
├── scripts/seed.mjs           # seed 1 admin + 2 user via Admin SDK
├── database.rules.json        # contoh rules RTDB
└── .env.example
```

## 1. Setup Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → aktifkan **Email/Password**.
3. **Realtime Database** → Create Database → mulai dalam **test mode** (atau paste `database.rules.json`).
4. **Project Settings → General → Your apps → Web** → salin config.
5. Di proyek ini:
   ```bash
   cp .env.example .env
   # isi VITE_FIREBASE_* dari Firebase Console
   ```

Struktur data yang dipakai:

```json
{
  "accounts": { "<uid>": { "email": "...", "role": "user|admin", "displayName": "..." } },
  "approvals": { "<uid>": true },
  "launch_status": { "isLaunched": false, "totalApproved": 0, "totalAccounts": 2 }
}
```

## 2. Install & Jalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output dist/
npm run preview
```

> `video.mp4` sudah dipindah ke `public/video.mp4` sehingga diakses sebagai `/video.mp4`.

## 3. Buat Akun Awal (1 admin + 2 user)

**Opsi A — seed script (disarankan):**

```bash
npm i -D firebase-admin
# Download serviceAccountKey.json dari Project Settings > Service accounts
# simpan di root proyek (jangan commit!)
npm run seed
```

Akun default:

| Email | Password | Role |
|---|---|---|
| admin@example.com | admin123 | admin |
| user1@example.com | user1234 | user |
| user2@example.com | user1234 | user |

**Opsi B — manual via UI Admin:**

1. Buat 1 admin manual: Authentication → Add user + tulis `accounts/<uid>` role `admin` di RTDB.
2. Login sebagai admin → `/admin` → form "Tambah Akun User".

**Hapus Auth user lain:** Firebase client hanya bisa hapus sesi sendiri. Untuk UID lain hapus via Console → Authentication → Users, lalu hapus node `accounts/<uid>` + `approvals/<uid>` di RTDB (atau pakai Admin SDK).

## 4. Alur Uji End-to-End

1. Buka `/` di layar proyektor (sphere standby + bar kosong).
2. Login sebagai `user1` di HP/laptop → `/trigger` → tahan tombol 3 detik → sphere di `/` berputar lebih cepat + cincin 1 muncul + bar terisi 50%.
3. Login sebagai `user2` → approve → 100% → animasi flash → video full screen.
4. Admin (`/admin`) bisa Approve per akun, Approve All + Launch, Reset Approve (dev), tambah/hapus akun.

## 5. Catatan Production

- **Hapus/komentari tombol "Reset Approve (Dev)"** di `src/pages/Trigger.jsx` dan `src/pages/Admin.jsx` sebelum launch asli (sudah ditandai komentar blok).
- Kencangkan `database.rules.json`: batasi write `accounts` hanya untuk admin (cek `root.child('accounts').child(auth.uid).child('role').val() == 'admin'`).
- Target performa MacBook 2012 / Intel HD 4000: `Canvas dpr={[1,1.5]}`, Sparkles `count={120}`, tanpa post-processing.

## Troubleshooting

- **Layar hitam / Firebase error:** pastikan `.env` terisi benar dan RTDB URL region sesuai (`...fireio.com` vs `...asia-southeast1.firebasedatabase.app`).
- **Vite create gagal di Node 18:** proyek ini memakai `vite@4` + `plugin-react@4` agar kompatibel Node 18. Jangan upgrade ke Vite 6/7 tanpa Node 20+.
- **Video tidak autoplay dengan suara:** browser memblokir autoplay bersuara tanpa interaksi. Halaman Launch mencoba `play()` + fullscreen best-effort; klik sekali pada video jika masih paused.# LaunchGimmick
