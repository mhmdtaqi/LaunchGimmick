import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { useNavigate, Link } from 'react-router-dom'
import { auth, db } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const snap = await get(ref(db, `accounts/${cred.user.uid}`))
      const profile = snap.exists() ? snap.val() : null
      if (!profile) {
        setError('Akun tidak terdaftar di database. Hubungi admin.')
        setLoading(false)
        return
      }
      if (profile.role === 'admin') navigate('/admin', { replace: true })
      else navigate('/trigger', { replace: true })
    } catch (err) {
      setError('Login gagal: ' + (err?.message || 'unknown error'))
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Masuk</h1>
        <p className="muted">Gunakan akun yang dibuat admin.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="user1@example.com" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Memproses…' : 'Login'}
        </button>
        <Link to="/" className="meta-link">← Kembali ke Launch</Link>
      </form>
    </div>
  )
}