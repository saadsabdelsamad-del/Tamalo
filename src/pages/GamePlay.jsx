import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../context/PlayerContext'
import { createDeck, shuffle, cardValue, cardPower, cardDisplay, powerLabel } from '../lib/deck'

// ── Card visuals ────────────────────────────────────────────
function CardBack({ small, selectable, onClick, selected }) {
  return (
    <div onClick={onClick} style={{
      width: small ? 42 : 58, height: small ? 60 : 84, borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg,#F97316,#EA580C)',
      border: `2px solid ${selected ? '#1D4ED8' : '#c2440a'}`,
      cursor: selectable ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: selected ? '0 0 0 3px #93C5FD' : '0 1px 3px rgba(0,0,0,0.15)',
      transform: selectable ? 'translateY(-2px)' : 'none', transition: 'all .15s',
    }}>
      <div style={{ width: '65%', height: '65%', border: '2px solid rgba(255,255,255,.35)', borderRadius: 4 }} />
    </div>
  )
}

function CardFace({ code, small, selectable, onClick, selected, dimmed }) {
  const d = cardDisplay(code)
  return (
    <div onClick={onClick} style={{
      width: small ? 42 : 58, height: small ? 60 : 84, borderRadius: 8, flexShrink: 0,
      background: '#fff', border: `2px solid ${selected ? '#1D4ED8' : '#E5E7EB'}`,
      cursor: selectable ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      boxShadow: selected ? '0 0 0 3px #93C5FD' : '0 1px 3px rgba(0,0,0,.1)',
      transform: selectable ? 'translateY(-2px)' : 'none', transition: 'all .15s',
      opacity: dimmed ? 0.4 : 1, position: 'relative', gap: 1,
    }}>
      <div style={{ fontSize: small ? '0.85rem' : '1.1rem', fontWeight: 800, color: d.color, lineHeight: 1 }}>{d.label}</div>
      <div style={{ fontSize: small ? '0.85rem' : '1.1rem', color: d.color, lineHeight: 1 }}>{d.suit}</div>
      {!small && d.score !== null && (
        <div style={{ position: 'absolute', bottom: 3, right: 5, fontSize: '0.55rem', color: '#9CA3AF', fontWeight: 700 }}>
          {d.score > 0 ? '+' : ''}{d.score}
        </div>
      )}
    </div>
  )
}

function Card({ code, known, small, selectable, onClick, selected, dimmed }) {
  if (known && code) return <CardFace code={code} small={small} selectable={selectable} onClick={onClick} selected={selected} dimmed={dimmed} />
  return <CardBack small={small} selectable={selectable} onClick={onClick} selected={selected} />
}

// ── Main component ───────────────────────────────────────────
export default function GamePlay({ gameId, gamePlayers, onRoundScored, roundNum, isHost }) {
  const { player } = usePlayer()

  const [round, setRound]           = useState(null)
  const [myCards, setMyCards]       = useState([])
  const [allCards, setAllCards]     = useState({})    // {pid: [{position,card_code,revealed}]}
  const [knownCards, setKnownCards] = useState({})    // {pid: {pos: code}}
  const [tempReveal, setTempReveal] = useState(null)  // {ownerId, pos, code}
  const [selectMode, setSelectMode] = useState(null)  // null | 'swap_mine' | 'power_mine' | 'power_their' | 'slapping'
  const [swapMyPos, setSwapMyPos]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')

  // Derived
  const currentPid  = round?.turn_order?.[round.current_turn_index % (round?.turn_order?.length || 1)]
  const isMyTurn    = currentPid === player.id
  const currentGP   = gamePlayers.find(gp => gp.player_id === currentPid)
  const topDiscard  = round?.discard_pile?.slice(-1)?.[0] ?? null
  const hasDrawn    = !!round?.drawn_card
  const peekReady   = round?.peek_ready ?? {}
  const myReady     = !!peekReady[player.id]
  const peekCount   = Object.keys(knownCards[player.id] ?? {}).filter(p => parseInt(p) >= 0).length

  // ── Load / poll ───────────────────────────────────────────
  useEffect(() => { if (gameId) load() }, [gameId])
  useEffect(() => {
    if (!gameId) return
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [gameId])

  async function load() {
    const { data: r } = await supabase
      .from('game_rounds').select('*')
      .eq('game_id', gameId).neq('status', 'scored')
      .order('created_at', { ascending: false }).limit(1).single()

    setRound(r ?? null)
    setLoading(false)
    if (!r) return
    await Promise.all([loadMyCards(r.id), loadAllCards(r.id), loadKnown(r.id)])
  }

  async function loadMyCards(rid) {
    const { data } = await supabase.from('player_hand_cards').select('*')
      .eq('game_round_id', rid).eq('player_id', player.id).order('position')
    setMyCards(data ?? [])
  }

  async function loadAllCards(rid) {
    const { data } = await supabase.from('player_hand_cards').select('*')
      .eq('game_round_id', rid).order('position')
    if (!data) return
    const g = {}
    data.forEach(c => { if (!g[c.player_id]) g[c.player_id] = []; g[c.player_id].push(c) })
    setAllCards(g)
  }

  async function loadKnown(rid) {
    const { data } = await supabase.from('player_known_cards').select('*')
      .eq('game_round_id', rid).eq('viewer_id', player.id)
    if (!data) return
    const k = {}
    data.forEach(({ owner_id, position, card_code }) => {
      if (!k[owner_id]) k[owner_id] = {}
      k[owner_id][position] = card_code
    })
    setKnownCards(k)
  }

  function flash(m, ms = 3000) { setMsg(m); setTimeout(() => setMsg(''), ms) }

  async function upsertKnown(viewerId, ownerId, pos, code) {
    await supabase.from('player_known_cards').upsert(
      { game_round_id: round.id, viewer_id: viewerId, owner_id: ownerId, position: pos, card_code: code },
      { onConflict: 'game_round_id,viewer_id,owner_id,position' }
    )
  }

  function tempShow(ownerId, pos, code, ms = 3000) {
    setTempReveal({ ownerId, pos, code })
    setTimeout(() => setTempReveal(null), ms)
  }

  // ── Actions ───────────────────────────────────────────────

  async function dealRound() {
    const deck = shuffle(createDeck())
    const order = gamePlayers.map(gp => gp.player_id)
    const hands = {}
    let d = [...deck]
    for (const pid of order) {
      hands[pid] = []
      for (let pos = 0; pos < 4; pos++) hands[pid].push({ player_id: pid, position: pos, card_code: d.pop() })
    }
    const firstDiscard = d.pop()

    const { data: r } = await supabase.from('game_rounds').insert({
      game_id: gameId, round_number: roundNum, status: 'peek',
      turn_order: order, deck: d, discard_pile: [firstDiscard], peek_ready: {}
    }).select().single()

    if (!r) return
    await supabase.from('player_hand_cards').insert(
      Object.values(hands).flat().map(c => ({ game_round_id: r.id, ...c }))
    )
    await load()
  }

  async function peekMyCard(pos) {
    if (peekCount >= 2 || myReady) return
    const card = myCards.find(c => c.position === pos)
    if (!card) return
    await upsertKnown(player.id, player.id, pos, card.card_code)
    tempShow(player.id, pos, card.card_code)
    await loadKnown(round.id)
  }

  async function markReady() {
    const pr = { ...peekReady, [player.id]: true }
    const allDone = round.turn_order.every(pid => pr[pid])
    await supabase.from('game_rounds').update({
      peek_ready: pr, ...(allDone ? { status: 'playing' } : {})
    }).eq('id', round.id)
    await load()
  }

  async function drawFromDeck() {
    if (!isMyTurn || hasDrawn) return
    const deck = [...round.deck]
    if (!deck.length) { flash('Deck is empty!'); return }
    const drawn = deck.pop()
    await supabase.from('game_rounds').update({ deck, drawn_card: drawn, drawn_from: 'deck' }).eq('id', round.id)
    await upsertKnown(player.id, player.id, -1, drawn) // I know what I drew
    await load()
  }

  async function takeFromDiscard() {
    if (!isMyTurn || hasDrawn || !topDiscard) return
    const pile = [...round.discard_pile]
    const drawn = pile.pop()
    await supabase.from('game_rounds').update({
      discard_pile: pile, drawn_card: drawn, drawn_from: 'discard'
    }).eq('id', round.id)
    await load()
    setSelectMode('swap_mine') // must swap immediately
  }

  async function swapDrawnWith(pos) {
    if (!round.drawn_card) return
    const myCard = myCards.find(c => c.position === pos)
    if (!myCard) return

    const newDiscard = [...round.discard_pile, myCard.card_code]
    await supabase.from('player_hand_cards').update({ card_code: round.drawn_card })
      .eq('game_round_id', round.id).eq('player_id', player.id).eq('position', pos)
    await upsertKnown(player.id, player.id, pos, round.drawn_card)
    await supabase.from('player_known_cards').delete()
      .eq('game_round_id', round.id).eq('viewer_id', player.id).eq('owner_id', player.id).eq('position', -1)
    await supabase.from('game_rounds').update({
      drawn_card: null, drawn_from: null,
      discard_pile: newDiscard, last_discard: myCard.card_code, last_discard_by: player.id
    }).eq('id', round.id)
    setSelectMode(null)
    await doAdvanceTurn()
    await load()
  }

  async function discardDrawn(usePower) {
    if (!round.drawn_card) return
    const card = round.drawn_card
    const power = cardPower(card)
    const newDiscard = [...round.discard_pile, card]

    await supabase.from('player_known_cards').delete()
      .eq('game_round_id', round.id).eq('viewer_id', player.id).eq('owner_id', player.id).eq('position', -1)

    if (usePower && power) {
      await supabase.from('game_rounds').update({
        drawn_card: null, drawn_from: null, discard_pile: newDiscard,
        last_discard: card, last_discard_by: player.id, pending_power: power
      }).eq('id', round.id)
    } else {
      await supabase.from('game_rounds').update({
        drawn_card: null, drawn_from: null, discard_pile: newDiscard,
        last_discard: card, last_discard_by: player.id
      }).eq('id', round.id)
      await doAdvanceTurn()
    }
    await load()
  }

  async function doAdvanceTurn(overrideRound) {
    const r = overrideRound ?? (await supabase.from('game_rounds').select('*').eq('id', round.id).single()).data
    if (!r) return
    const nextIdx = r.current_turn_index + 1
    let updates = { current_turn_index: nextIdx }

    if (r.status === 'tamalo_called') {
      const left = r.tamalo_turns_left - 1
      if (left <= 0) {
        updates.status = 'revealing'
        updates.tamalo_turns_left = 0
        await supabase.from('player_hand_cards').update({ revealed: true }).eq('game_round_id', r.id)
      } else {
        updates.tamalo_turns_left = left
      }
    }
    await supabase.from('game_rounds').update(updates).eq('id', r.id)
    await load()
  }

  // Powers
  async function resolvePeekOwn(pos) {
    const card = myCards.find(c => c.position === pos)
    if (!card) return
    await upsertKnown(player.id, player.id, pos, card.card_code)
    tempShow(player.id, pos, card.card_code)
    await supabase.from('game_rounds').update({ pending_power: null }).eq('id', round.id)
    setSelectMode(null)
    await doAdvanceTurn()
  }

  async function resolveSpy(targetPid, targetPos) {
    const card = (allCards[targetPid] ?? []).find(c => c.position === targetPos)
    if (!card) return
    await upsertKnown(player.id, targetPid, targetPos, card.card_code)
    tempShow(targetPid, targetPos, card.card_code)
    await supabase.from('game_rounds').update({ pending_power: null }).eq('id', round.id)
    setSelectMode(null)
    await doAdvanceTurn()
  }

  async function resolveBlindSwap(myPos, theirPid, theirPos) {
    const myCard   = myCards.find(c => c.position === myPos)
    const theirCard = (allCards[theirPid] ?? []).find(c => c.position === theirPos)
    if (!myCard || !theirCard) return

    await supabase.from('player_hand_cards').update({ card_code: theirCard.card_code })
      .eq('game_round_id', round.id).eq('player_id', player.id).eq('position', myPos)
    await supabase.from('player_hand_cards').update({ card_code: myCard.card_code })
      .eq('game_round_id', round.id).eq('player_id', theirPid).eq('position', theirPos)

    // Both players know their new card
    await upsertKnown(player.id, player.id, myPos, theirCard.card_code)
    await upsertKnown(theirPid, theirPid, theirPos, myCard.card_code) // notify them

    await supabase.from('game_rounds').update({ pending_power: null }).eq('id', round.id)
    setSelectMode(null); setSwapMyPos(null)
    await doAdvanceTurn()
  }

  async function resolveKingSpy(targetPid, targetPos) {
    const card = (allCards[targetPid] ?? []).find(c => c.position === targetPos)
    if (!card) return
    await upsertKnown(player.id, targetPid, targetPos, card.card_code)
    tempShow(targetPid, targetPos, card.card_code, 60000) // keep shown until decision
    await supabase.from('game_rounds').update({
      pending_power: 'king_swap',
      pending_power_target: { player_id: targetPid, position: targetPos, card_code: card.card_code }
    }).eq('id', round.id)
    setSelectMode(null)
    await load()
  }

  async function resolveKingSwap(doSwap, myPos) {
    const target = round.pending_power_target
    if (doSwap && myPos !== null && target) {
      const myCard    = myCards.find(c => c.position === myPos)
      const theirCard = (allCards[target.player_id] ?? []).find(c => c.position === target.position)
      if (myCard && theirCard) {
        await supabase.from('player_hand_cards').update({ card_code: theirCard.card_code })
          .eq('game_round_id', round.id).eq('player_id', player.id).eq('position', myPos)
        await supabase.from('player_hand_cards').update({ card_code: myCard.card_code })
          .eq('game_round_id', round.id).eq('player_id', target.player_id).eq('position', target.position)
        await upsertKnown(player.id, player.id, myPos, theirCard.card_code)
        await upsertKnown(target.player_id, target.player_id, target.position, myCard.card_code) // notify
      }
    }
    setTempReveal(null); setSelectMode(null); setSwapMyPos(null)
    await supabase.from('game_rounds').update({ pending_power: null, pending_power_target: null }).eq('id', round.id)
    await doAdvanceTurn()
  }

  async function slap(myPos) {
    if (!topDiscard) return
    if (round.last_discard_by === player.id) { flash("Can't slap your own discard!"); setSelectMode(null); return }
    const myCard = myCards.find(c => c.position === myPos)
    if (!myCard || !topDiscard) return

    const discardVal = topDiscard.startsWith('JOK') ? 'JOK' : topDiscard.slice(0, -1)
    const myVal      = myCard.card_code.startsWith('JOK') ? 'JOK' : myCard.card_code.slice(0, -1)

    if (discardVal === myVal) {
      await supabase.from('player_hand_cards').delete()
        .eq('game_round_id', round.id).eq('player_id', player.id).eq('position', myPos)
      await supabase.from('player_known_cards').delete()
        .eq('game_round_id', round.id).eq('viewer_id', player.id).eq('owner_id', player.id).eq('position', myPos)
      flash('✅ Correct slap! Card removed.')
    } else {
      const deck = [...round.deck]
      if (deck.length) {
        const penalty = deck.pop()
        const positions = myCards.map(c => c.position)
        const nextPos = Math.max(...positions, 3) + 1
        await supabase.from('player_hand_cards').insert({
          game_round_id: round.id, player_id: player.id, position: nextPos, card_code: penalty
        })
        await supabase.from('game_rounds').update({ deck }).eq('id', round.id)
      }
      flash('❌ Wrong slap! Penalty card added.')
    }
    setSelectMode(null)
    await load()
  }

  async function callTamalo() {
    if (!isMyTurn || hasDrawn) return
    const others = round.turn_order.filter(p => p !== player.id)
    await supabase.from('game_rounds').update({
      status: 'tamalo_called', tamalo_caller_id: player.id, tamalo_turns_left: others.length
    }).eq('id', round.id)
    await doAdvanceTurn()
  }

  async function scoreRound() {
    // Calculate each player's hand total
    const scores = {}
    for (const [pid, cards] of Object.entries(allCards))
      scores[pid] = cards.reduce((sum, c) => sum + cardValue(c.card_code), 0)

    // Tamalo bonus/penalty
    const caller = round.tamalo_caller_id
    if (caller) {
      const callerScore = scores[caller]
      const others = Object.entries(scores).filter(([pid]) => pid !== caller).map(([, s]) => s)
      const lowestOther = others.length ? Math.min(...others) : Infinity
      scores[caller] = callerScore <= lowestOther ? 0 : callerScore + 5
    }

    await supabase.from('game_rounds').update({ status: 'scored' }).eq('id', round.id)
    setRound(null)
    onRoundScored(scores)
  }

  // ── Helpers ───────────────────────────────────────────────
  function iKnow(ownerId, pos)  { return !!(knownCards[ownerId]?.[pos]) }
  function knownCode(ownerId, pos) { return knownCards[ownerId]?.[pos] ?? null }
  function isTempShown(ownerId, pos) { return tempReveal?.ownerId === ownerId && tempReveal?.pos === pos }
  function showFace(ownerId, pos, revealed) { return revealed || iKnow(ownerId, pos) || isTempShown(ownerId, pos) }

  // ── Render ────────────────────────────────────────────────
  if (loading) return <div className="spinner" />

  if (!round) {
    if (!isHost) return (
      <div className="card text-center" style={{ padding: 32 }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
        <p style={{ fontWeight: 600 }}>Waiting for host to deal…</p>
      </div>
    )
    return (
      <div className="card text-center" style={{ padding: 32 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🃏</div>
        <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>Deal round {roundNum}</p>
        <button className="btn btn-primary btn-lg" onClick={dealRound}>Deal cards</button>
      </div>
    )
  }

  const myCardsSorted  = [...myCards].sort((a, b) => a.position - b.position)
  const otherPlayers   = gamePlayers.filter(gp => gp.player_id !== player.id)
  const callerGP       = gamePlayers.find(gp => gp.player_id === round.tamalo_caller_id)
  const pendingPower   = round.pending_power
  const kingTarget     = round.pending_power_target
  const drawnCode      = knownCode(player.id, -1) ?? round.drawn_card
  const drawnPower     = round.drawn_card ? cardPower(round.drawn_card) : null

  // Status bar text
  const statusText = (() => {
    if (round.status === 'peek')          return myReady ? 'Waiting for others to finish peeking…' : `Peek at 2 of your cards (${peekCount}/2)`
    if (round.status === 'tamalo_called') return `📣 ${callerGP?.player?.name ?? '?'} called Tamalo! ${round.tamalo_turns_left} turn(s) left`
    if (round.status === 'revealing')     return '🃏 Cards revealed — check your score'
    if (isMyTurn)                         return '⬆️ Your turn!'
    return `${currentGP?.player?.name ?? '?'}'s turn`
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Status bar */}
      <div style={{
        padding: '10px 16px', borderRadius: 10, textAlign: 'center',
        fontWeight: 700, fontSize: '0.95rem',
        background: isMyTurn ? '#DCFCE7' : round.status === 'peek' ? '#FFF7ED' : '#F9FAFB',
        border: `1px solid ${isMyTurn ? '#86EFAC' : round.status === 'peek' ? '#FED7AA' : '#E5E7EB'}`,
        color: isMyTurn ? '#166534' : '#374151'
      }}>{statusText}</div>

      {/* Flash message */}
      {msg && <div style={{ padding: '10px 16px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, textAlign: 'center', fontWeight: 600, fontSize: '0.88rem', color: '#166534' }}>{msg}</div>}

      {/* Slap mode */}
      {selectMode === 'slapping' && (
        <div style={{ background: '#FFF7ED', border: '2px solid #F97316', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: '#EA580C', marginBottom: 10, fontSize: '0.88rem', textAlign: 'center' }}>
            ⚡ Tap your matching card to slap it!
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            {myCardsSorted.map(c => (
              <div key={c.position} onClick={() => slap(c.position)}>
                <Card code={knownCode(player.id, c.position) ?? c.card_code} known={showFace(player.id, c.position, c.revealed)} selectable />
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Opponents */}
      {otherPlayers.map(gp => {
        const pid = gp.player_id
        const cards = (allCards[pid] ?? []).sort((a, b) => a.position - b.position)
        const isActive = pid === currentPid
        const isSpy = (pendingPower === 'spy' || pendingPower === 'king') && isMyTurn
        const isSwapTarget = pendingPower === 'blind_swap' && isMyTurn && selectMode === 'power_their'
        const isKingSwapTarget = pendingPower === 'king_swap' && isMyTurn && selectMode === 'power_their'

        return (
          <div key={pid} style={{
            background: '#F9FAFB', borderRadius: 12, padding: '12px 14px',
            border: `${isActive ? 2 : 1}px solid ${isActive ? '#86EFAC' : '#E5E7EB'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                {gp.player?.name} {isActive && <span style={{ color: '#16A34A' }}>▶</span>}
                {knownCards[pid] && Object.keys(knownCards[pid]).some(p => parseInt(p) >= 0) && (
                  <span style={{ fontSize: '0.72rem', color: '#9CA3AF', marginLeft: 4 }}>(you know some)</span>
                )}
              </span>
              {round.drawn_card && isActive && (
                <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>holding a card…</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cards.map(c => {
                const shown = showFace(pid, c.position, c.revealed)
                const selectable = (isSpy || isSwapTarget || isKingSwapTarget) && pid !== player.id
                return (
                  <div key={c.position} onClick={selectable ? () => {
                    if (isSpy && pendingPower === 'king') resolveKingSpy(pid, c.position)
                    else if (isSpy) resolveSpy(pid, c.position)
                    else if (isSwapTarget) resolveBlindSwap(swapMyPos, pid, c.position)
                    else if (isKingSwapTarget) resolveKingSwap(true, swapMyPos)
                  } : undefined}>
                    <Card
                      code={shown ? (knownCode(player.id, c.position) ?? c.card_code) : c.card_code}
                      known={shown} small selectable={selectable}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Deck + discard pile */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', padding: '4px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: 6, fontWeight: 700, letterSpacing: '0.05em' }}>DECK ({round.deck.length})</div>
          <div onClick={isMyTurn && !hasDrawn && (round.status === 'playing' || round.status === 'tamalo_called') ? drawFromDeck : undefined}>
            <CardBack selectable={isMyTurn && !hasDrawn} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: 6, fontWeight: 700, letterSpacing: '0.05em' }}>DISCARD</div>
          {topDiscard
            ? <div onClick={isMyTurn && !hasDrawn && (round.status === 'playing' || round.status === 'tamalo_called') ? takeFromDiscard : undefined}>
                <CardFace code={topDiscard} selectable={isMyTurn && !hasDrawn} />
              </div>
            : <div style={{ width: 58, height: 84, borderRadius: 8, border: '2px dashed #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: '0.75rem' }}>Empty</div>
          }
          {topDiscard && round.last_discard_by !== player.id && !hasDrawn && round.status !== 'peek' && (
            <button
              onClick={() => setSelectMode(selectMode === 'slapping' ? null : 'slapping')}
              style={{
                marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none',
                background: selectMode === 'slapping' ? '#EA580C' : '#FFF7ED',
                color: selectMode === 'slapping' ? '#fff' : '#EA580C',
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                border: '2px solid #F97316', transition: 'all .15s'
              }}
            >⚡ SLAP</button>
          )}
        </div>
      </div>

      {/* Drawn card panel (only visible to the drawer) */}
      {isMyTurn && round.drawn_card && (
        <div style={{ background: '#EFF6FF', border: '2px solid #93C5FD', borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#1D4ED8', marginBottom: 12, fontSize: '0.88rem' }}>
            You drew {round.drawn_from === 'discard' ? '(from discard — must swap)' : ''}:
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            {drawnCode ? <CardFace code={drawnCode} /> : <CardBack />}
          </div>
          {round.drawn_from === 'discard' ? (
            <p style={{ fontSize: '0.82rem', color: '#1D4ED8' }}>↓ Tap one of your cards below to swap</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectMode('swap_mine')}>
                Swap with my card
              </button>
              {drawnPower ? (
                <button className="btn btn-primary btn-sm" onClick={() => discardDrawn(true)}>
                  Discard + {powerLabel(drawnPower)}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-sm" onClick={() => discardDrawn(false)}>
                Just discard
              </button>
            </div>
          )}
        </div>
      )}

      {/* Power instruction panel */}
      {pendingPower && isMyTurn && (
        <div style={{ background: '#FFF7ED', border: '2px solid #F97316', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#EA580C', marginBottom: 12, fontSize: '0.9rem' }}>
            {pendingPower === 'peek_own'   && '👁️ Tap one of YOUR cards to peek at it'}
            {pendingPower === 'spy'        && '🔍 Tap any OPPONENT\'s card to spy on it'}
            {pendingPower === 'blind_swap' && (selectMode === 'power_their' ? '↔️ Now tap an opponent\'s card to swap with' : '↔️ Tap one of YOUR cards first')}
            {pendingPower === 'king'       && '👑 Tap ANY card to spy on it'}
            {pendingPower === 'king_swap'  && (
              selectMode === 'power_their'
                ? '↔️ Now tap your card to swap with it'
                : `👑 You saw: ${tempReveal ? cardDisplay(tempReveal.code).label + cardDisplay(tempReveal.code).suit : '?'} — swap or skip?`
            )}
          </div>

          {pendingPower === 'blind_swap' && !selectMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectMode('power_mine')}>Use swap</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                await supabase.from('game_rounds').update({ pending_power: null }).eq('id', round.id)
                await doAdvanceTurn()
              }}>Skip</button>
            </div>
          )}

          {pendingPower === 'king_swap' && !selectMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectMode('power_mine')}>Swap it</button>
              <button className="btn btn-ghost btn-sm" onClick={() => resolveKingSwap(false, null)}>Skip</button>
            </div>
          )}
        </div>
      )}

      {/* My hand */}
      <div style={{ background: '#FFF7ED', border: '2px solid #FED7AA', borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#EA580C', marginBottom: 12, letterSpacing: '0.05em' }}>
          YOUR CARDS
          {round.status === 'peek' && !myReady && <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>({peekCount}/2 peeked)</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {myCardsSorted.map(c => {
            const pos = c.position
            const shown = showFace(player.id, pos, c.revealed)
            const code  = knownCode(player.id, pos) ?? c.card_code

            let selectable = false
            let onClick = undefined

            if (round.status === 'peek' && !myReady && !iKnow(player.id, pos) && peekCount < 2) {
              selectable = true; onClick = () => peekMyCard(pos)
            } else if ((selectMode === 'swap_mine') && isMyTurn) {
              selectable = true; onClick = () => swapDrawnWith(pos)
            } else if (pendingPower === 'peek_own' && isMyTurn) {
              selectable = true; onClick = () => resolvePeekOwn(pos)
            } else if ((pendingPower === 'blind_swap' || pendingPower === 'king_swap') && isMyTurn && (selectMode === 'power_mine')) {
              selectable = true; onClick = () => { setSwapMyPos(pos); setSelectMode('power_their') }
            }

            return (
              <div key={pos} onClick={selectable ? onClick : undefined}>
                <Card code={code} known={shown} selectable={selectable} />
              </div>
            )
          })}
        </div>

        {/* Peek controls */}
        {round.status === 'peek' && !myReady && peekCount >= 2 && (
          <button className="btn btn-primary btn-sm" onClick={markReady}>Done peeking — I'm ready ✓</button>
        )}
        {round.status === 'peek' && myReady && (
          <div style={{ fontSize: '0.82rem', color: '#22C55E', fontWeight: 600 }}>✓ Ready</div>
        )}

        {/* Tamalo button */}
        {isMyTurn && !hasDrawn && round.status === 'playing' && (
          <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={callTamalo}>
            📣 Tamalo!
          </button>
        )}
      </div>

      {/* Reveal: score button */}
      {round.status === 'revealing' && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          {isHost
            ? <button className="btn btn-primary btn-lg" onClick={scoreRound}>✅ Score this round</button>
            : <div style={{ color: '#6B7280', fontSize: '0.88rem' }}>Waiting for host to score the round…</div>
          }
        </div>
      )}

    </div>
  )
}
