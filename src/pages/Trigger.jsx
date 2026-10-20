import { useEffect, useState } from 'react'
import { ref, onValue, set, get } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import HoldButton from '../components/HoldButton'

export default function Trigger() {
  const { user, profile, logout } = useAuth()
  const [approved, setApproved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    const unsub = onValue(ref(db, `approvals/${user.uid}`), (snap) => {
      setApproved(snap.val() === true)
    })
    return () => unsub()
  }, [user])

  const handleApprove = async () => {
    if (!user || approved) return
    setSaving(true)
    try {
      await set(ref(db, `approvals/${user.uid}`), true)
      await syncLaunchStatus()
    } finally {
      setSaving(false)
    }
  }

  /** Sinkronkan counter launch_status setelah ada perubahan approval. */
  const syncLaunchStatus = async () => {
    const [accSnap, apprSnap] = await Promise.all([
      get(ref(db, 'accounts')),
      get(ref(db, 'approvals')),
    ])
    const accounts = accSnap.val() || {}
    const approvals = apprSnap.val() || {}
    const userIds = Object.entries(accounts)
      .filter(([, a]) => a?.role === 'user')
      .map(([uid]) => uid)
    const totalApproved = userIds.filter((uid) => approvals[uid] === true).length
    const totalAccounts = userIds.length
    const isLaunched = totalAccounts > 0 && totalApproved >= totalAccounts
    await set(ref(db, 'launch_status'), { isLaunched, totalApproved, totalAccounts })
  }

  return (
    <div className="trigger-page">
      <header className="topbar">
        <div>
          <h1>Launch Pad</h1>
          <p className="muted">{profile?.displayName || user?.email}</p>
        </div>
        <button className="btn-ghost" onClick={logout}>Keluar</button>
      </header>

      <main className="trigger-main">
        <HoldButton approved={approved} onApprove={handleApprove} disabled={saving} />
        {saving && <p className="muted">Menyimpan…</p>}
      </main>

      {/* ======================================================
          TOMBOL RESET APPROVE - UNTUK DEVELOPMENT / AWAL SAJA
          Komentari atau hapus blok ini sebelum production launch.
          Fungsi: reset approvals untuk SEMUA akun di Firebase.
          ====================================================== */}
      <footer className="trigger-footer">
        <ResetAllApprovals />
      </footer>
    </div>
  )
}

function ResetAllApprovals() {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!confirm('Reset approve untuk SEMUA akun? (khusus development/awal)')) return
    setLoading(true)
    try {
      const accSnap = await get(ref(db, 'accounts'))
      const accounts = accSnap.val() || {}
      const userIds = Object.entries(accounts)
        .filter(([, a]) => a?.role === 'user')
        .map(([uid]) => uid)
      const updates = {}
      userIds.forEach((uid) => { updates[uid] = false })
      await set(ref(db, 'approvals'), updates)
      await set(ref(db, 'launch_status'), {
        isLaunched: false,
        totalApproved: 0,
        totalAccounts: userIds.length,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="btn-danger-ghost" onClick={handleReset} disabled={loading}>
      {loading ? 'Mereset…' : 'Reset Approve (Dev)'}
    </button>
  )
}