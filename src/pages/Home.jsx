import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { loginOrRegister } from '../lib/auth'

export default function Home() {
  const { login } = usePlayer()
  const [tab, setTab] = useState('login') // login | register
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Enter your name')
    if (pin.length < 4) return setError('PIN must be at least 4 digits')
    if (tab === 'register' && pin !== pin2) return setError("PINs don't match")

    setLoading(true)
    try {
      const player = await loginOrRegister(name, pin)
      login(player)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-wrap">
      <div className="home-logo">🃏</div>
      <div className="home-title">Tamalo</div>
      <div className="home-sub">The memory card game scoreboard</div>

      <div className="card home-card">
        <div className="home-tabs">
          <button className={`home-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError('') }}>
            Sign in
          </button>
          <button className={`home-tab${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setError('') }}>
            New player
          </button>
        </div>

        <form onSubmit={submit} className="gap-12" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="input-label">Your name</label>
            <input className="input" placeholder="e.g. Saad" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="input-label">PIN (4+ digits)</label>
            <input className="input" type="password" inputMode="numeric" placeholder="••••" maxLength={8} value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          {tab === 'register' && (
            <div>
              <label className="input-label">Confirm PIN</label>
              <input className="input" type="password" inputMode="numeric" placeholder="••••" maxLength={8} value={pin2} onChange={e => setPin2(e.target.value)} />
            </div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-full mt-8" type="submit" disabled={loading}>
            {loading ? 'Loading…' : tab === 'login' ? 'Sign in' : 'Create profile'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: 16 }}>
          {tab === 'login'
            ? 'New here? Switch to "New player" above.'
            : 'Already have a profile? Switch to "Sign in".'}
        </p>
      </div>
    </div>
  )
}
