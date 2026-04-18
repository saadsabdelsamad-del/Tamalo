import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../context/PlayerContext'
import { checkAndAwardAchievements, ACHIEVEMENTS } from '../lib/achievements'
import GamePlay from './GamePlay'

function initials(name) { return name?.slice(0, 2).toUpperCase() || '?' }

function scoreColor(s) {
  if (s < 0)  return '#7C3AED'
  if (s < 40) return '#22C55E'
  if (s < 65) return '#F59E0B'
  if (s < 85) return '#F97316'
  return '#EF4444'
}

export default function Game() {
  const { code } = useParams()
  const { player, updatePlayer } = usePlayer()
  const navigate = useNavigate()

  const [game, setGame]               = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [cardRoundNum, setCardRoundNum] = useState(1)
  const [history, setHistory]         = useState([])
  const [gameOver, setGameOver]       = useState(null)
  const [newAchievements, setNewAchievements] = useState([])
  const [midName, setMidName]         = useState('')
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)

  const isHost    = game?.host_id === player?.id
  const isWaiting = game?.status === 'waiting'
  const isActive  = game?.status === 'active'
  const isFinished = game?.status === 'finished'

  useEffect(() => { loadGame() }, [code])

  useEffect(() => {
    if (!game?.id) return
    const iv = setInterval(pollGame, 4000)
    return () => clearInterval(iv)
  }, [game?.id])

  async function loadGame() {
    const { data: g } = await supabase.from('games').select('*').eq('room_code', code).single()
    if (!g) { navigate('/lobby'); return }
    setGame(g)
    if (g.status === 'finished') setGameOver({ loser: g.loser_name })
    await Promise.all([loadGamePlayers(g.id), loadHistory(g.id)])
    setLoading(false)
  }

  async function pollGame() {
    if (!game?.id) return
    const { data: g } = await supabase.from('games').select('*').eq('id', game.id).single()
    if (g) {
      setGame(g)
      if (g.status === 'finished' && !gameOver) setGameOver({ loser: g.loser_name })
    }
    await Promise.all([loadGamePlayers(game.id), loadHistory(game.id)])
  }

  async function loadGamePlayers(gameId) {
    const { data } = await supabase
      .from('game_players')
      .select('*, player:players(id, name, avatar_url, games_played, games_won)')
      .eq('game_id', gameId)
    if (data) setGamePlayers(data)
  }

  async function loadHistory(gameId) {
    const { data } = await supabase
      .from('rounds')
      .select('*, scores:round_scores(*, player:players(name))')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
    if (data) {
      setHistory(data)
      if (data.length > 0) setCardRoundNum(Math.max(...data.map(r => r.round_number)) + 1)
    }
  }

  async function startGame() {
    if (gamePlayers.length < 2) return showToast('Need at least 2 players')
    await supabase.from('games').update({ status: 'active' }).eq('id', game.id)
    setGame(g => ({ ...g, status: 'active' }))
  }

  // Called by GamePlay when a card round is scored
  async function onRoundScored(cardScores) {
    // cardScores = { player_id: hand_total }
    const notes = []
    const newScores = {}

    let updatedPlayers = gamePlayers.map(gp => {
      const delta = cardScores[gp.player_id] ?? 0
      let total = gp.current_score + delta
      let note = null
      if (total === 99) { total = 50; note = '99→50' }
      newScores[gp.player_id] = total
      return { ...gp, current_score: total, _delta: delta, _note: note }
    })

    // Check game over
    const loser = updatedPlayers.find(gp => gp.current_score >= 100)

    // Update game_players scores
    await Promise.all(updatedPlayers.map(gp =>
      supabase.from('game_players').update({ current_score: gp.current_score }).eq('id', gp.id)
    ))

    // Save to rounds/round_scores for history
    const { data: round } = await supabase
      .from('rounds').insert({ game_id: game.id, round_number: cardRoundNum }).select().single()

    if (round) {
      await supabase.from('round_scores').insert(
        updatedPlayers.map(gp => ({
          round_id: round.id, game_id: game.id, player_id: gp.player_id,
          score_delta: gp._delta, total_score: gp.current_score, note: gp._note
        }))
      )
    }

    setGamePlayers(updatedPlayers.map(({ _delta, _note, ...rest }) => rest))
    setCardRoundNum(n => n + 1)
    await loadHistory(game.id)

    if (loser) {
      await endGame(loser, updatedPlayers)
    }
  }

  async function endGame(loser, finalPlayers) {
    const sorted = [...finalPlayers].sort((a, b) => a.current_score - b.current_score)
    const loserName = loser.player?.name || 'Someone'
    const winnerId = sorted[0].player_id

    await Promise.all(sorted.map((gp, i) =>
      supabase.from('game_players').update({ final_score: gp.current_score, placement: i + 1 })
        .eq('game_id', game.id).eq('player_id', gp.player_id)
    ))

    await supabase.from('games').update({
      status: 'finished', loser_id: loser.player_id, loser_name: loserName,
      ended_at: new Date().toISOString()
    }).eq('id', game.id)

    for (const gp of finalPlayers) {
      const isWinner = gp.player_id === winnerId
      await supabase.from('players').update({
        games_played: (gp.player?.games_played || 0) + 1,
        games_won: isWinner ? (gp.player?.games_won || 0) + 1 : (gp.player?.games_won || 0)
      }).eq('id', gp.player_id)
    }

    const myGP = finalPlayers.find(gp => gp.player_id === player.id)
    const { data: updatedPlayer } = await supabase.from('players').select('*').eq('id', player.id).single()
    if (updatedPlayer) updatePlayer(updatedPlayer)

    const newAch = await checkAndAwardAchievements(player.id, game.id, {
      wonGame: winnerId === player.id,
      wasInLastPlace: false,
      hadNinetyNine: finalPlayers.some(gp => gp._note?.includes('99→50')),
      calledTamaloCorrectly: false,
      finalScore: myGP?.current_score || 0,
      gamesWon: updatedPlayer?.games_won || 0,
      gamesPlayed: updatedPlayer?.games_played || 0
    })

    if (newAch?.length) setNewAchievements(newAch)
    setGameOver({ loser: loserName })
  }

  async function addPlayer() {
    const n = midName.trim()
    if (!n) return
    const nameLower = n.toLowerCase()
    let { data: p } = await supabase.from('players').select('*').eq('name_lower', nameLower).single()
    if (!p) {
      const { data: created } = await supabase.from('players')
        .insert({ name: n, name_lower: nameLower, pin_hash: 'guest' }).select().single()
      p = created
    }
    if (!p) return
    await supabase.from('game_players')
      .upsert({ game_id: game.id, player_id: p.id }, { onConflict: 'game_id,player_id', ignoreDuplicates: true })
    setMidName('')
    await loadGamePlayers(game.id)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code).catch(() => {})
    showToast('Code copied!')
  }

  function showToast(msg) {
    setToast(msg); setTimeout(() => setToast(null), 2500)
  }

  const sorted = [...gamePlayers].sort((a, b) => a.current_score - b.current_score)

  if (loading) return <div className="spinner" />

  return (
    <div className="game-wrap">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, padding: '10px 20px', borderRadius: 10,
          background: '#333', color: '#fff', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap'
        }}>{toast}</div>
      )}

      {/* Achievement flash */}
      {newAchievements.map(a => (
        <div key={a.type} style={{
          position: 'fixed', top: 70, right: 16, zIndex: 201,
          background: '#F97316', color: '#fff', borderRadius: 12,
          padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700, maxWidth: 260,
          boxShadow: '0 4px 20px rgba(249,115,22,.4)'
        }}>
          🏅 Achievement: {ACHIEVEMENTS[a.type]?.label}
        </div>
      ))}

      {/* Game over banner */}
      {(gameOver || isFinished) && (
        <div className="gameover">
          <h1>GAME OVER</h1>
          <p><strong>{game?.loser_name || gameOver?.loser} loses!</strong></p>
          <button className="btn btn-ghost mt-16" onClick={() => navigate('/lobby')}>Back to lobby</button>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <div>
          <div className="game-title">
            Room: <span style={{ color: 'var(--orange)', cursor: 'pointer' }} onClick={copyCode}>{code} 📋</span>
          </div>
          {isActive && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{gamePlayers.length} players · Round {cardRoundNum}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isWaiting && isHost && (
            <button className="btn btn-primary btn-sm" onClick={startGame} disabled={gamePlayers.length < 2}>
              Start game
            </button>
          )}
          {isWaiting && !isHost && <div className="chip chip-gray">Waiting for host…</div>}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lobby')}>Leave</button>
        </div>
      </div>

      {/* Waiting room */}
      {isWaiting && (
        <div className="card mb-16">
          <div className="section-label">Share this code</div>
          <div className="lobby-code" onClick={copyCode} style={{ cursor: 'pointer' }}>{code}</div>
          <div className="lobby-hint">Tap to copy · Send to friends</div>
          <div className="section-label">Players ({gamePlayers.length})</div>
          <div className="gap-8 mb-12">
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
            <div className="row">
              <input className="input flex1" placeholder="Add player by name…" value={midName}
                onChange={e => setMidName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
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
              <div className="standing-score" style={{ color: scoreColor(gp.current_score) }}>{gp.current_score}</div>
            </div>
          ))}
        </div>
      )}

      {/* Card game */}
      {isActive && !isFinished && !gameOver && (
        <div className="mb-16">
          <GamePlay
            gameId={game.id}
            gamePlayers={gamePlayers}
            onRoundScored={onRoundScored}
            roundNum={cardRoundNum}
            isHost={isHost}
          />
        </div>
      )}

      {/* Add player mid-game */}
      {isActive && isHost && !isFinished && !gameOver && (
        <div className="row mb-16">
          <input className="input flex1" placeholder="Add player mid-game…" value={midName}
            onChange={e => setMidName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
          <button className="btn btn-ghost btn-sm" onClick={addPlayer}>Add</button>
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
