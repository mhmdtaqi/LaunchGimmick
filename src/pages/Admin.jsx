import { useState } from 'react'
import { ref, set, get, remove } from 'firebase/database'
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth'
import { auth, db, secondaryAuth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLaunch } from '../hooks/useLaunch'
import { Link } from 'react-router-dom'

export default function Admin() {
  const { logout, user } = useAuth()
  const { accounts, approvals, userAccounts, totalApproved, totalAccounts, percent } = useLaunch()
  const [busy, setBusy] = useState(false)

  // Form tambah akun
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [formMsg, setFormMsg] = useState('')

  const syncStatus = async (nextApprovals = null) => {
    const accSnap = await get(ref(db, 'accounts'))
    const apprSnap = nextApprovals ? { val: () => nextApprovals } : await get(ref(db, 'approvals'))
    const accs = accSnap.val() || {}
    const apprs = apprSnap.val ? apprSnap.val() || {} : apprSnap || {}
    const userIds = Object.entries(accs).filter(([, a]) => a?.role === 'user').map(([uid]) => uid)
    const done = userIds.filter((uid) => apprs[uid] === true).length
    await set(ref(db, 'launch_status'), {
      isLaunched: userIds.length > 0 && done >= userIds.length,
      totalApproved: done,
      totalAccounts: userIds.length,
    })
  }

  const approveOne = async (uid) => {
    setBusy(true)
    try {
      await set(ref(db, `approvals/${uid}`), true)
      await syncStatus()
    } finally { setBusy(false) }
  }

  const approveAll = async () => {
    if (!confirm('Approve SEMUA akun dan langsung mulai launch?')) return
    setBusy(true)
    try {
      const accSnap = await get(ref(db, 'accounts'))
      const accs = accSnap.val() || {}
      const userIds = Object.entries(accs).filter(([, a]) => a?.role === 'user').map(([uid]) => uid)
      const next = {}
      userIds.forEach((uid) => { next[uid] = true })
      await set(ref(db, 'approvals'), next)
      await set(ref(db, 'launch_status'), { isLaunched: true, totalApproved: userIds.length, totalAccounts: userIds.length })
    } finally { setBusy(false) }
  }

  // ======================================================
  // TOMBOL RESET APPROVE - UNTUK DEVELOPMENT / AWAL SAJA
  // Komentari atau hapus blok ini sebelum production launch.
  // Fungsi: reset approvals untuk SEMUA akun di Firebase.
  // ======================================================
  const resetAll = async () => {
    if (!confirm('Reset approve untuk SEMUA akun? (khusus development/awal)')) return
    setBusy(true)
    try {
      const accSnap = await get(ref(db, 'accounts'))
      const accs = accSnap.val() || {}
      const userIds = Object.entries(accs).filter(([, a]) => a?.role === 'user').map(([uid]) => uid)
      const next = {}
      userIds.forEach((uid) => { next[uid] = false })
      await set(ref(db, 'approvals'), next)
      await set(ref(db, 'launch_status'), { isLaunched: false, totalApproved: 0, totalAccounts: userIds.length })
    } finally { setBusy(false) }
  }

  const friendlyCreateError = (err) => {
    const code = err?.code || ''
    if (code === 'auth/email-already-in-use') {
      return 'Email sudah terdaftar di Authentication. Gunakan email lain, atau hapus permanen dulu via: npm run delete-user -- ' + email.trim()
    }
    if (code === 'auth/invalid-email') return 'Format email tidak valid.'
    if (code === 'auth/weak-password') return 'Password terlalu lemah (min 6 karakter).'
    return 'Gagal: ' + (err?.message || 'unknown')
  }

  const addAccount = async (e) => {
    e.preventDefault()
    setFormMsg('')
    if (!email || !password || !displayName) { setFormMsg('Lengkapi email, password, nama.'); return }
    setBusy(true)
    try {
      // Pre-check: cegah duplikat yang sudah ada di database agar pesan jelas.
      const accSnap = await get(ref(db, 'accounts'))
      const accs = accSnap.val() || {}
      const dup = Object.values(accs).some((a) => a?.email?.toLowerCase() === email.trim().toLowerCase())
      if (dup) {
        setFormMsg('Email sudah ada di daftar akun. Gunakan email lain atau hapus dulu akun tersebut.')
        return
      }
      // Buat user via secondaryAuth agar sesi admin utama TIDAK pindah/logout.
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)
      await set(ref(db, `accounts/${cred.user.uid}`), {
        email: email.trim(), role: 'user', displayName: displayName.trim(),
      })
      await set(ref(db, `approvals/${cred.user.uid}`), false)
      await syncStatus()
      // Bersihkan sesi secondary saja; admin utama tetap login.
      await signOut(secondaryAuth).catch(() => {})
      setFormMsg(`Akun ${email.trim()} dibuat. Anda tetap login sebagai admin.`)
      setEmail(''); setPassword(''); setDisplayName('')
    } catch (err) {
      setFormMsg(friendlyCreateError(err))
    } finally { setBusy(false) }
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setFormMsg(`Disalin: ${text}`)
    } catch {
      setFormMsg(text)
    }
  }

  const removeAccount = async (uid, accEmail) => {
    if (!confirm(`Hapus ${accEmail} dari daftar + database?\n\nCatatan: Auth-nya TIDAK ikut terhapus (keterbatasan Firebase client).\nAgar email bisa dipakai lagi, lanjutkan dengan:\nnpm run delete-user -- ${accEmail}`)) return
    setBusy(true)
    try {
      await remove(ref(db, `accounts/${uid}`))
      await remove(ref(db, `approvals/${uid}`))
      // Hapus dari Auth hanya bisa untuk user yang sedang login.
      if (uid === user?.uid && auth.currentUser) {
        try { await deleteUser(auth.currentUser) } catch { /* abaikan */ }
      }
      await syncStatus()
      setFormMsg(`Akun ${accEmail} dihapus dari database. Untuk hapus Auth permanen agar email bisa dipakai lagi, jalankan: npm run delete-user -- ${accEmail}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="admin-page">
      <header className="topbar">
        <div>
          <h1>Admin Panel</h1>
          <p className="muted">{totalApproved}/{totalAccounts} approve • {percent}%</p>
        </div>
        <div className="row">
          <button className="btn-primary" onClick={approveAll} disabled={busy}>Approve All + Launch</button>
          <button className="btn-ghost" onClick={logout}>Keluar</button>
          <Link to="/semua-buttons">
            <button className="btn-ghost">Lihat Semua User Buttons</button>
          </Link>
        </div>
      </header>

      <section className="card">
        <h2>Daftar Akun</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nama</th><th>Email</th><th>UID</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {Object.entries(accounts).map(([uid, acc]) => (
                <tr key={uid}>
                  <td>{acc?.displayName || '-'}</td>
                  <td>{acc?.email}</td>
                  <td><code className="small">{uid.slice(0, 8)}…</code></td>
                  <td><span className={`badge ${acc?.role}`}>{acc?.role}</span></td>
                  <td>{acc?.role === 'user' ? (approvals[uid] ? '✅ Approved' : '⏳ Pending') : '—'}</td>
                  <td className="row">
                    {acc?.role === 'user' && !approvals[uid] && (
                      <button className="btn-small" onClick={() => approveOne(uid)} disabled={busy}>Approve</button>
                    )}
                    <button className="btn-small" onClick={() => copyText(uid)} disabled={busy} title="Salin UID penuh">UID</button>
                    <button className="btn-small" onClick={() => copyText(`npm run delete-user -- ${acc?.email}`)} disabled={busy} title="Salin perintah hapus permanen">Script</button>
                    <button className="btn-small danger" onClick={() => removeAccount(uid, acc?.email)} disabled={busy}>Hapus</button>
                  </td>
                </tr>
              ))}
              {Object.keys(accounts).length === 0 && (
                <tr><td colSpan={6} className="muted">Belum ada akun. Tambahkan via form di bawah / seed script.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted small">User ({userAccounts.length}) menentukan totalAccounts. Admin tidak dihitung.</p>
        <div className="row">
          {/* ======================================================
              TOMBOL RESET APPROVE - UNTUK DEVELOPMENT / AWAL SAJA
              Komentari atau hapus blok ini sebelum production launch.
              Fungsi: reset approvals untuk SEMUA akun di Firebase.
              ====================================================== */}
          <button className="btn-danger-ghost" onClick={resetAll} disabled={busy}>Reset Approve (Dev)</button>
        </div>
      </section>

      <section className="card">
        <h2>Tambah Akun User</h2>
        <form onSubmit={addAccount} className="form-grid">
          <label>Nama<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="User 1" /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user1@example.com" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 karakter" /></label>
          <button className="btn-primary" type="submit" disabled={busy}>Buat Akun</button>
        </form>
        {formMsg && <p className="muted">{formMsg}</p>}
        <p className="muted small">Buat akun via secondary auth (admin tetap login). Hapus di tabel hanya hapus database; untuk hapus Auth permanen agar email bisa dipakai lagi: <code>npm run delete-user -- email@example.com</code> atau <code>node scripts/delete-user.mjs --uid UID</code>.</p>
      </section>
    </div>
  )
}