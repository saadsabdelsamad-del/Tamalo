import { useNavigate, useLocation } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'

const links = [
  { path: '/lobby',       label: 'Play' },
  { path: '/leaderboard', label: '🏆' },
  { path: '/history',     label: '📜' },
  { path: '/rules',       label: '📖' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { player } = usePlayer()

  const initials = player?.name?.slice(0, 2).toUpperCase() || '?'

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/lobby')} style={{ cursor: 'pointer' }}>
        Tamalo
      </div>
      <div className="navbar-links">
        {links.map(l => (
          <button
            key={l.path}
            className={`nav-link${location.pathname === l.path ? ' active' : ''}`}
            onClick={() => navigate(l.path)}
          >
            {l.label}
          </button>
        ))}
        <div className="nav-avatar" onClick={() => navigate('/profile')}>
          {player?.avatar_url
            ? <img src={player.avatar_url} alt={player.name} />
            : initials}
        </div>
      </div>
    </nav>
  )
}
