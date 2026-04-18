import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function initials(name) { return name?.slice(0, 2).toUpperCase() || '?' }

const rankLabel = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

export default function Leaderboard() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('players')
      .select('id, name, avatar_url, games_played, games_won')
      .gte('games_played', 1)
      .order('games_won', { ascending: false })
    if (data) {
      const ranked = data
        .map(p => ({ ...p, winRate: p.games_played > 0 ? p.games_won / p.games_played : 0 }))
        .sort((a, b) => b.games_won - a.games_won || b.winRate - a.winRate)
      setPlayers(ranked)
    }
    setLoading(false)
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-title">Leaderboard 🏆</div>
      <div className="page-sub">All-time standings across every game</div>

      {players.length === 0 && (
        <div className="empty">No games played yet. Start one!</div>
      )}

      <div className="gap-8">
        {players.map((p, i) => (
          <div key={p.id} className={`lb-row${i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : ''}`}>
            <div className="lb-rank">{rankLabel(i)}</div>
            <div className="lb-avatar">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.name} /> : initials(p.name)}
            </div>
            <div className="lb-name">{p.name}</div>
            <div className="lb-stats">
              <div className="lb-wins">{p.games_won}W</div>
              <div className="lb-sub">{p.games_played} played · {Math.round(p.winRate * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
