import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../context/PlayerContext'

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default function Lobby() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createGame() {
    setLoading(true)
    setError('')
    try {
      let code = randomCode()
      // ensure unique
      const { data: existing } = await supabase.from('games').select('id').eq('room_code', code).eq('status', 'waiting').single()
      if (existing) code = randomCode()

      const { data: game, error: err } = await supabase
        .from('games')
        .insert({ room_code: code, host_id: player.id, status: 'waiting' })
        .select().single()

      if (err) throw new Error(err.message)

      // add host as first player
      await supabase.from('game_players').insert({ game_id: game.id, player_id: player.id })

      navigate(`/game/${code}`)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function joinGame() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return setError('Enter a room code')
    setLoading(true)
    setError('')
    try {
      const { data: game, error: err } = await supabase
        .from('games')
        .select('*')
        .eq('room_code', code)
        .in('status', ['waiting', 'active'])
        .single()

      if (err || !game) throw new Error('Game not found. Check the code.')

      // add player if not already in
      await supabase.from('game_players')
        .upsert({ game_id: game.id, player_id: player.id }, { onConflict: 'game_id,player_id', ignoreDuplicates: true })

      navigate(`/game/${code}`)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-title">Let's play 🃏</div>
      <div className="page-sub">Start a new game or join one with a code</div>

      <div className="card mb-16">
        <div className="card-title">Create a game</div>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 16 }}>
          You'll be the host and get a room code to share with friends.
        </p>
        <button className="btn btn-primary btn-full" onClick={createGame} disabled={loading}>
          {loading ? 'Creating…' : 'Create game'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Join a game</div>
        <div className="row mb-12">
          <input
            className="input flex1"
            placeholder="Enter room code (e.g. XK9A)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            maxLength={4}
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, fontSize: '1.1rem' }}
          />
          <button className="btn btn-outline" onClick={joinGame} disabled={loading}>
            Join
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  )
}
