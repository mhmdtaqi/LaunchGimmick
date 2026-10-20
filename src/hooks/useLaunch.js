import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

/**
 * Hook realtime untuk status launch.
 * Mendengarkan: approvals, accounts, launch_status.
 * Menghitung totalAccounts dari akun role === 'user'.
 */
export function useLaunch() {
  const [approvals, setApprovals] = useState({})
  const [accounts, setAccounts] = useState({})
  const [launchStatus, setLaunchStatus] = useState({
    isLaunched: false,
    totalApproved: 0,
    totalAccounts: 0,
  })
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const unsubApprovals = onValue(
      ref(db, 'approvals'),
      (snap) => setApprovals(snap.val() || {}),
      () => setConnected(false),
    )
    const unsubAccounts = onValue(ref(db, 'accounts'), (snap) =>
      setAccounts(snap.val() || {}),
    )
    const unsubStatus = onValue(ref(db, 'launch_status'), (snap) =>
      setLaunchStatus(
        snap.val() || { isLaunched: false, totalApproved: 0, totalAccounts: 0 },
      ),
    )
    return () => {
      unsubApprovals()
      unsubAccounts()
      unsubStatus()
    }
  }, [])

  const userAccounts = Object.entries(accounts).filter(
    ([, acc]) => acc?.role === 'user',
  )
  const totalAccounts = userAccounts.length
  const totalApproved = userAccounts.filter(([uid]) => approvals[uid] === true).length
  const ratio = totalAccounts === 0 ? 0 : totalApproved / totalAccounts
  const percent = Math.round(ratio * 100)
  const isLaunched = launchStatus?.isLaunched === true || (totalAccounts > 0 && totalApproved >= totalAccounts)

  return {
    approvals,
    accounts,
    userAccounts,
    totalAccounts,
    totalApproved,
    ratio,
    percent,
    isLaunched,
    launchStatus,
    connected,
  }
}