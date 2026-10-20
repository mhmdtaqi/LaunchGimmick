import { useState } from 'react'
import { ref, set, get } from 'firebase/database'
import { db } from '../firebase'
import { useLaunch } from '../hooks/useLaunch'
import HoldButton from '../components/HoldButton'

/**
 * Halaman admin: tampilkan semua tombol approval dari user (kecuali admin sendiri)
 * menggunakan HoldButton yang sama persis seperti halaman Trigger.
 * - Tombol-tombol mengisi seluruh lebar halaman (right ke left, di tengah page).
 *   Ukuran tombol menyesuaikan jumlah user: sedikit = besar, banyak = kecil.
 * - Tombol mata (👁️/👁️‍🗨️) untuk hide/show seluruh judul & deskripsi halaman.
 * - Tombol HoldButton diperbesar sedikit.
 */
export default function AllUserButtons() {
  const { accounts, approvals, user, userAccounts } = useLaunch()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [msg, setMsg] = useState('')

  const handleApprove = async (uid) => {
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      await set(ref(db, `approvals/${uid}`), true)
      const accSnap = await get(ref(db, 'accounts'))
      const accs = accSnap.val() || {}
      const userIds = Object.entries(accs)
        .filter(([, a]) => a?.role === 'user')
        .map(([id]) => id)
      const apprSnap = await get(ref(db, 'approvals'))
      const apprs = apprSnap.val ? apprSnap.val() : {}
      const done = userIds.filter((id) => apprs[id] === true).length
      await set(ref(db, 'launch_status'), {
        isLaunched: userIds.length > 0 && done >= userIds.length,
        totalApproved: done,
        totalAccounts: userIds.length,
      })
      setMsg(`Approved ${uid.slice(0, 6)}…`)
    } catch (e) {
      setMsg('Gagal approve: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  // Filter: hanya user, admin TIDAK dicantumkan
  const users = Object.entries(accounts)
    .filter(([, acc]) => acc?.role === 'user')
    .map(([uid, acc]) => ({ uid, ...acc }))

  const toggleHidden = () => {
    setHidden(!hidden)
  }

  // Determine the number of users for dynamic sizing
  const userCount = users.length
  const isOne = userCount === 1
  const isTwo = userCount === 2
  const isThree = userCount === 3
  const isFourOrMore = userCount >= 4

  return (
    <div className="buttons-page">
      <header className="topbar">
        <div className={hidden ? 'hide-title' : ''}>
          <h1>Semua User Buttons</h1>
          <p className="muted">{users.length} user • {userAccounts.length} accounts</p>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {!hidden && msg && <span className="muted small" style={{ marginRight: 8 }}>{msg}</span>}
          <button
            className="btn-ghost"
            onClick={toggleHidden}
            title={hidden ? 'Tampilkan judul & deskripsi halaman' : 'Sembunyikan judul & deskripsi halaman'}
          >
            {hidden ? '👁️' : '👁️‍🗨️'}
          </button>
          {!hidden && (
            <button className="btn-ghost" onClick={() => document.location.href = '/admin'}>Kembali ke Admin</button>
          )}
        </div>
      </header>

      <section className="card buttons-center">
        <div
          className={`buttons-row ${isOne || isTwo || isThree || isFourOrMore ? 'fill-width' : ''}`}
        >
          {users.map(({ uid, email, displayName }) => {
            const approved = approvals[uid] === true
            const isAdmin = user?.uid === uid
            return (
              <div
                key={uid}
                className={`user-btn ${approved ? 'is-approved' : ''} ${isAdmin ? 'is-admin' : ''}`}
                title={`${displayName || email} (${uid.slice(0, 6)}…)`}
                // style={{ minWidth: 'auto', flex: 'auto', maxWidth: '280px' }}
              >
                <HoldButton
                  approved={approved}
                  onApprove={() => handleApprove(uid)}
                  disabled={isAdmin || busy}
                />
              </div>
            )
          })}
          {users.length === 0 && (
            <p className="muted" style={{ textAlign: 'center' }}>Belum ada user. Buat akun pertama di Admin Panel.</p>
          )}
        </div>
      </section>
        {!hidden && (
          <p className="muted small">Klik tombol HOLD 3 detik untuk approve setiap user (kecuali admin).</p>
        )}
    </div>
  )
}