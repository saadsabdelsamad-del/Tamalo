import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../context/PlayerContext'

export default function History() {
  const { player } = usePlayer()
  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null)
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadGames() }, [])

  async function loadGames() {
    const { data: myGames } = await supabase
      .from('game_players')
      .select('game:games(id, room_code, status, created_at, ended_at, loser_name), final_score, placement')
      .eq('player_id', player.id)
      .order('joined_at', { ascending: false })

    if (myGames) {
      const finished = myGames.filter(g => g.game?.status === 'finished')
      setGames(finished)
    }
    setLoading(false)
  }

  async function openGame(gameId) {
    if (selected === gameId) { setSelected(null); setRounds([]); return }
    setSelected(gameId)
    const { data } = await supabase
      .from('rounds')
      .select('*, scores:round_scores(*, player:players(name))')
      .eq('game_id', gameId)
      .order('round_number')
    if (data) setRounds(data)
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-title">Game History 📜</div>
      <div className="page-sub">Your past games</div>

      {games.length === 0 && <div className="empty">No finished games yet.</div>}

      <div className="gap-12">
        {games.map(g => {
          const date = g.game?.ended_at ? new Date(g.game.ended_at).toLocaleDateString() : '—'
          const won = g.placement === 1
          return (
            <div key={g.game?.id}>
              <div className="game-history-row" onClick={() => openGame(g.game?.id)}>
                <div className="gh-date">{date}</div>
                <div className="gh-players">Room: {g.game?.room_code}</div>
                <div className="gh-meta">
                  <div className={`chip ${won ? 'chip-green' : 'chip-red'}`}>
                    {won ? '🏆 Won' : `#${g.placement || '?'}`}
                  </div>
                  {g.final_score !== null && (
                    <div className="chip chip-gray">Score: {g.final_score}</div>
                  )}
                  {g.game?.loser_name && (
                    <div className="chip chip-red">Lost: {g.game.loser_name}</div>
                  )}
                </div>
              </div>

              {selected === g.game?.id && rounds.length > 0 && (
                <div className="history-box" style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}>
                  <div className="section-label">Round breakdown</div>
                  <div className="history-list" style={{ maxHeight: 300 }}>
                    {rounds.map(r => (
                      <div className="history-item" key={r.id}>
                        <strong>Round {r.round_number}</strong> —{' '}
                        {(r.scores || []).map((s, i) => (
                          <span key={s.id}>
                            {s.player?.name}: {s.score_delta >= 0 ? '+' : ''}{s.score_delta} → {s.total_score}
                            {s.note && <span className="history-note"> ({s.note})</span>}
                            {i < r.scores.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
