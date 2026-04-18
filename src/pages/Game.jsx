import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../context/PlayerContext'
import { checkAndAwardAchievements, ACHIEVEMENTS } from '../lib/achievements'

function initials(name) { return name?.slice(0, 2).toUpperCase() || '?' }

function scoreClass(s) {
  if (s < 0)  return 'score-neg'
  if (s < 40) return 'score-safe'
  if (s < 65) return 'score-mid'
  if (s < 85) return 'score-high'
  return 'score-danger'
}

export default function Game() {
  const { code } = useParams()
  const { player, updatePlayer } = usePlayer()
  const navigate = useNavigate()

  const [game, setGame]               = useState(null)
  const [gamePlayers, setGamePlayers] = useState([]) // {id, player_id, current_score, player:{name,avatar_url}}
  const [roundNum, setRoundNum]       = useState(1)
  const [history, setHistory]         = useState([])
  const [inputs, setInputs]           = useState({})
  const [tamaloCall, setTamaloCall]   = useState({ player_id: null, correct: null })
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [toast, setToast]             = useState(null)
  const [gameOver, setGameOver]       = useState(null) // {loser}
  const [newAchievements, setNewAchievements] = useState([])

  const isHost = game?.host_id === player?.id
  const isActive = game?.status === 'active'
  const isWaiting = game?.status === 'waiting'
  const isFinished = game?.status === 'finished'

  // Load initial data
  useEffect(() => {
    loadGame()
  }, [code])

  // Real-time subscriptions
  useEffect(() => {
    if (!game?.id) return

    const channel = supabase.channel(`game:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        payload => { setGame(prev => ({ ...prev, ...payload.new })) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        () => loadGamePlayers(game.id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'round_scores', filter: `game_id=eq.${game.id}` },
        () => loadHistory(game.id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [game?.id])

  async function loadGame() {
    const { data: g } = await supabase.from('games').select('*').eq('room_code', code).single()
    if (!g) { navigate('/lobby'); return }
    setGame(g)
    if (g.status === 'finished') setGameOver({ loser: g.loser_name || 'Someone' })
    await Promise.all([loadGamePlayers(g.id), loadHistory(g.id)])
    setLoading(false)
  }

  async function loadGamePlayers(gameId) {
    const { data } = await supabase
      .from('game_players')
      .select('*, player:players(id, name, avatar_url)')
      .eq('game_id', gameId)
    if (data) {
      setGamePlayers(data)
      setInputs(prev => {
        const next = {}
        data.forEach(gp => { next[gp.player_id] = prev[gp.player_id] ?? '' })
        return next
      })
    }
  }

  async function loadHistory(gameId) {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*, scores:round_scores(*, player:players(name))')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
    if (rounds) setHistory(rounds)
  }

  async function startGame() {
    if (gamePlayers.length < 2) return showToast('Need at least 2 players', 'error')
    await supabase.from('games').update({ status: 'active' }).eq('id', game.id)
    setGame(g => ({ ...g, status: 'active' }))
  }

  async function submitRound() {
    if (submitting) return
    setSubmitting(true)
    try {
      // Build new scores
      let scores = gamePlayers.map(gp => {
        const raw = inputs[gp.player_id]
        const delta = (raw === '' || raw == null) ? 0 : (parseInt(raw, 10) || 0)
        let total = gp.current_score + delta
        let note = null

        // Tamalo penalty
        if (tamaloCall.player_id === gp.player_id && tamaloCall.correct === false) {
          total += 5
          note = 'Tamalo penalty +5'
        }

        // 99 rule
        if (total === 99) { total = 50; note = (note ? note + ', ' : '') + '99→50' }

        return { player_id: gp.player_id, gp_id: gp.id, delta, total, note }
      })

      // Check game over (100+)
      const loser = scores.find(s => s.total >= 100)

      // Insert round
      const { data: round } = await supabase
        .from('rounds')
        .insert({ game_id: game.id, round_number: roundNum })
        .select().single()

      // Insert round scores
      await supabase.from('round_scores').insert(
        scores.map(s => ({
          round_id: round.id,
          game_id: game.id,
          player_id: s.player_id,
          score_delta: s.delta,
          total_score: s.total,
          note: s.note
        }))
      )

      // Update current_score for each game_player
      await Promise.all(scores.map(s =>
        supabase.from('game_players')
          .update({ current_score: s.total })
          .eq('id', s.gp_id)
      ))

      // Update local state immediately — don't wait for real-time
      setGamePlayers(prev => prev.map(gp => {
        const s = scores.find(sc => sc.player_id === gp.player_id)
        return s ? { ...gp, current_score: s.total } : gp
      }))

      if (loser) {
        await endGame(loser, scores)
      } else {
        setRoundNum(r => r + 1)
        setInputs(Object.fromEntries(Object.keys(inputs).map(k => [k, ''])))
        setTamaloCall({ player_id: null, correct: null })
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function endGame(loser, finalScores) {
    const sorted = [...finalScores].sort((a, b) => a.total - b.total)
    const loserGp = gamePlayers.find(gp => gp.player_id === loser.player_id)
    const loserName = loserGp?.player?.name || 'Someone'

    // Update placements
    await Promise.all(sorted.map((s, i) =>
      supabase.from('game_players')
        .update({ final_score: s.total, placement: i + 1 })
        .eq('game_id', game.id)
        .eq('player_id', s.player_id)
    ))

    // Update game status
    await supabase.from('games').update({
      status: 'finished',
      loser_id: loser.player_id,
      loser_name: loserName,
      ended_at: new Date().toISOString()
    }).eq('id', game.id)

    // Update player stats for everyone
    const winnerPid = sorted[0].player_id
    for (const gp of gamePlayers) {
      const isWinner = gp.player_id === winnerPid
      await supabase.from('players')
        .update({
          games_played: (gp.player?.games_played || 0) + 1,
          games_won: isWinner ? (gp.player?.games_won || 0) + 1 : (gp.player?.games_won || 0)
        })
        .eq('id', gp.player_id)
    }

    // Check achievements for current player
    const myScore = finalScores.find(s => s.player_id === player.id)
    const myHistory = history.flatMap(r => r.scores?.filter(s => s.player_id === player.id) || [])
    const wasInLastPlace = history.some(r => {
      const rs = r.scores || []
      const sorted = [...rs].sort((a, b) => b.total_score - a.total_score)
      return sorted[0]?.player_id === player.id
    })

    const { data: updatedPlayer } = await supabase.from('players').select('*').eq('id', player.id).single()
    if (updatedPlayer) updatePlayer(updatedPlayer)

    const newAch = await checkAndAwardAchievements(player.id, game.id, {
      wonGame: winnerPid === player.id,
      wasInLastPlace,
      hadNinetyNine: myHistory.some(s => s.note?.includes('99→50')),
      calledTamaloCorrectly: tamaloCall.player_id === player.id && tamaloCall.correct === true,
      finalScore: myScore?.total || 0,
      gamesWon: updatedPlayer?.games_won || 0,
      gamesPlayed: updatedPlayer?.games_played || 0
    })

    if (newAch?.length) setNewAchievements(newAch)
    setGameOver({ loser: loserName })
  }

  async function addPlayer() {
    const n = newPlayerName.trim()
    if (!n) return
    // find or create player by name
    const nameLower = n.toLowerCase()
    let { data: p } = await supabase.from('players').select('*').eq('name_lower', nameLower).single()
    if (!p) {
      const { data: created } = await supabase.from('players')
        .insert({ name: n, name_lower: nameLower, pin_hash: 'guest' })
        .select().single()
      p = created
    }
    if (!p) return
    await supabase.from('game_players')
      .upsert({ game_id: game.id, player_id: p.id }, { onConflict: 'game_id,player_id', ignoreDuplicates: true })
    setNewPlayerName('')
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code).catch(() => {})
    showToast('Code copied!', 'success')
  }

  const sorted = [...gamePlayers].sort((a, b) => a.current_score - b.current_score)

  if (loading) return <div className="spinner" />

  return (
    <div className="game-wrap">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, padding: '10px 20px', borderRadius: 10, fontWeight: 600,
          background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'success' ? 'var(--success)' : '#333',
          color: '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap'
        }}>{toast.msg}</div>
      )}

      {/* New achievement flash */}
      {newAchievements.map(a => (
        <div key={a.type} style={{
          position: 'fixed', top: 70, right: 16, zIndex: 201,
          background: 'var(--orange)', color: '#fff', borderRadius: 12,
          padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700,
          boxShadow: '0 4px 20px rgba(249,115,22,0.4)', maxWidth: 260
        }}>
          🏅 Achievement unlocked: {ACHIEVEMENTS[a.type]?.label}
        </div>
      ))}

      {/* Game Over */}
      {(gameOver || isFinished) && (
        <div className="gameover">
          <h1>GAME OVER</h1>
          <p><strong>{game?.loser_name || gameOver?.loser} loses!</strong></p>
          {newAchievements.length > 0 && (
            <p style={{ marginTop: 8, fontSize: '0.85rem' }}>
              You earned: {newAchievements.map(a => ACHIEVEMENTS[a.type]?.label).join(', ')} 🎉
            </p>
          )}
          <button className="btn btn-ghost mt-16" onClick={() => navigate('/lobby')}>Back to lobby</button>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <div>
          <div className="game-title">Room: <span style={{ color: 'var(--orange)', cursor: 'pointer' }} onClick={copyCode}>{code} 📋</span></div>
          {isActive && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{gamePlayers.length} players</div>}
        </div>
        {isActive && <div className="round-pill">Round {roundNum}</div>}
        {isWaiting && isHost && (
          <button className="btn btn-primary btn-sm" onClick={startGame} disabled={gamePlayers.length < 2}>
            Start game
          </button>
        )}
        {isWaiting && !isHost && (
          <div className="chip chip-gray">Waiting for host…</div>
        )}
      </div>

      {/* Waiting room */}
      {isWaiting && (
        <div className="card mb-16">
          <div className="section-label">Share this code</div>
          <div className="lobby-code" onClick={copyCode} style={{ cursor: 'pointer' }}>{code}</div>
          <div className="lobby-hint">Tap code to copy · Send it to friends</div>
          <div className="section-label">Players ({gamePlayers.length})</div>
          <div className="gap-8">
            {gamePlayers.map(gp => (
              <div className="player-chip" key={gp.id}>
                <div className="player-chip-avatar">
                  {gp.player?.avatar_url ? <img src={gp.player.avatar_url} alt="" /> : initials(gp.player?.name)}
                </div>
                <div className="player-chip-name">{gp.player?.name}</div>
                {gp.player_id === game.host_id && <div className="chip chip-orange">Host</div>}
              </div>
            ))}
          </div>
          {isHost && (
            <div className="row mt-12">
              <input className="input flex1" placeholder="Add player by name…" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
              <button className="btn btn-ghost btn-sm" onClick={addPlayer}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      {(isActive || isFinished) && (
        <div className="gap-8 mb-16">
          {sorted.map((gp, i) => (
            <div key={gp.id} className={`standing-row${i === 0 ? ' leader' : ''}${gp.current_score >= 85 ? ' danger-row' : ''}`}>
              <div className="standing-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>
              <div className="standing-avatar">
                {gp.player?.avatar_url ? <img src={gp.player.avatar_url} alt="" /> : initials(gp.player?.name)}
              </div>
              <div className="standing-name">{gp.player?.name}</div>
              <div className={`standing-score ${scoreClass(gp.current_score)}`}>{gp.current_score}</div>
            </div>
          ))}
        </div>
      )}

      {/* Round entry — host only */}
      {isActive && !isFinished && !gameOver && isHost && (
        <div className="round-form mb-16">
          <div className="round-form-title">Enter Round {roundNum} Scores</div>
          <div className="gap-8 mb-12">
            {gamePlayers.map(gp => (
              <div className="round-input-row" key={gp.player_id}>
                <div className="round-input-name">{gp.player?.name}</div>
                <input
                  className="score-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={inputs[gp.player_id] ?? ''}
                  onChange={e => setInputs(prev => ({ ...prev, [gp.player_id]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {/* Tamalo call */}
          <div className="tamalo-row">
            <div className="tamalo-label">Did someone call Tamalo?</div>
            <div className="tamalo-options">
              {gamePlayers.map(gp => (
                <button
                  key={gp.player_id}
                  className={`tamalo-btn${tamaloCall.player_id === gp.player_id && tamaloCall.correct === true ? ' selected-correct' : ''}${tamaloCall.player_id === gp.player_id && tamaloCall.correct === false ? ' selected-wrong' : ''}`}
                  onClick={() => {
                    if (tamaloCall.player_id === gp.player_id) {
                      if (tamaloCall.correct === null) setTamaloCall({ player_id: gp.player_id, correct: true })
                      else if (tamaloCall.correct === true) setTamaloCall({ player_id: gp.player_id, correct: false })
                      else setTamaloCall({ player_id: null, correct: null })
                    } else {
                      setTamaloCall({ player_id: gp.player_id, correct: true })
                    }
                  }}
                >
                  {gp.player?.name}
                  {tamaloCall.player_id === gp.player_id && tamaloCall.correct === true && ' ✓'}
                  {tamaloCall.player_id === gp.player_id && tamaloCall.correct === false && ' +5'}
                </button>
              ))}
              {tamaloCall.player_id && (
                <button className="tamalo-btn" onClick={() => setTamaloCall({ player_id: null, correct: null })}>
                  Clear
                </button>
              )}
            </div>
            {tamaloCall.player_id && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 6 }}>
                Tap once = correct (no penalty), twice = wrong (+5 pts)
              </p>
            )}
          </div>

          <button className="btn btn-primary btn-full mt-16" onClick={submitRound} disabled={submitting}>
            {submitting ? 'Saving…' : `Submit Round ${roundNum}`}
          </button>

          {isHost && isActive && (
            <div className="row mt-12">
              <input className="input flex1" placeholder="Add player mid-game…" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
              <button className="btn btn-ghost btn-sm" onClick={addPlayer}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* Round history */}
      {history.length > 0 && (
        <div className="history-box">
          <div className="section-label">Round History</div>
          <div className="history-list">
            {history.map(r => (
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
}
