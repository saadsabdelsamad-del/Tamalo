import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { supabase } from '../lib/supabase'
import { ACHIEVEMENTS } from '../lib/achievements'

export default function Profile() {
  const { player, logout, updatePlayer } = usePlayer()
  const [stats, setStats] = useState(null)
  const [earned, setEarned] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    loadStats()
    loadAchievements()
  }, [])

  async function loadStats() {
    const { data } = await supabase.from('players').select('*').eq('id', player.id).single()
    if (data) setStats(data)
  }

  async function loadAchievements() {
    const { data } = await supabase.from('achievements').select('type').eq('player_id', player.id)
    if (data) setEarned(data.map(a => a.type))
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${player.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('players').update({ avatar_url: publicUrl }).eq('id', player.id)
      updatePlayer({ avatar_url: publicUrl })
      loadStats()
    } catch (e) {
      alert(e.message)
    } finally {
      setUploading(false)
    }
  }

  const winRate = stats?.games_played > 0
    ? Math.round((stats.games_won / stats.games_played) * 100)
    : 0

  const initials = player.name.slice(0, 2).toUpperCase()

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar" onClick={() => fileRef.current?.click()}>
          {(stats?.avatar_url || player.avatar_url)
            ? <img src={stats?.avatar_url || player.avatar_url} alt={player.name} />
            : initials}
          <div className="profile-avatar-overlay">📷</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        <div>
          <div className="profile-name">{player.name}</div>
          <div className="profile-since">
            {uploading ? 'Uploading…' : 'Tap photo to change avatar'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-24">
        <div className="stat-box">
          <div className="stat-value">{stats?.games_played ?? 0}</div>
          <div className="stat-label">Games played</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats?.games_won ?? 0}</div>
          <div className="stat-label">Wins</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{winRate}%</div>
          <div className="stat-label">Win rate</div>
        </div>
      </div>

      {/* Achievements */}
      <div className="section-label mb-12">Achievements</div>
      <div className="achievements-grid mb-24">
        {Object.entries(ACHIEVEMENTS).map(([type, ach]) => (
          <div key={type} className={`achievement-card${earned.includes(type) ? ' earned' : ' locked'}`}>
            <div className="achievement-icon">{ach.icon}</div>
            <div>
              <div className="achievement-name">{ach.label}</div>
              <div className="achievement-desc">{ach.desc}</div>
              {earned.includes(type) && (
                <div style={{ fontSize: '0.7rem', color: 'var(--orange)', marginTop: 4, fontWeight: 700 }}>Earned ✓</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost btn-full" onClick={logout}>Sign out</button>
    </div>
  )
}
