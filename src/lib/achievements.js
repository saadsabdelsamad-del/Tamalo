import { supabase } from './supabase'

export const ACHIEVEMENTS = {
  first_win:     { label: 'First Blood',     icon: '🏆', desc: 'Win your first game' },
  hat_trick:     { label: 'Hat Trick',        icon: '🎩', desc: 'Win 3 games' },
  legend:        { label: 'Legend',           icon: '👑', desc: 'Win 10 games' },
  survivor:      { label: 'Survivor',         icon: '🔥', desc: 'Score hit 99 and reset to 50' },
  comeback:      { label: 'Comeback Kid',     icon: '⚡', desc: 'Win after being in last place' },
  veteran:       { label: 'Veteran',          icon: '🎖️', desc: 'Play 20 games' },
  perfect_tamalo:{ label: 'Tamalo Master',   icon: '🃏', desc: 'Called Tamalo correctly' },
  close_call:    { label: 'Close Call',       icon: '😅', desc: 'Win with 90+ points' },
}

export async function checkAndAwardAchievements(playerId, gameId, { wasInLastPlace, hadNinetyNine, wonGame, calledTamaloCorrectly, finalScore, gamesWon, gamesPlayed }) {
  const toAward = []

  if (wonGame) {
    if (gamesWon === 1) toAward.push('first_win')
    if (gamesWon === 3) toAward.push('hat_trick')
    if (gamesWon === 10) toAward.push('legend')
    if (wasInLastPlace) toAward.push('comeback')
    if (finalScore >= 90) toAward.push('close_call')
  }
  if (hadNinetyNine) toAward.push('survivor')
  if (calledTamaloCorrectly) toAward.push('perfect_tamalo')
  if (gamesPlayed === 20) toAward.push('veteran')

  if (!toAward.length) return []

  const rows = toAward.map(type => ({ player_id: playerId, type, game_id: gameId }))
  const { data } = await supabase
    .from('achievements')
    .upsert(rows, { onConflict: 'player_id,type', ignoreDuplicates: true })
    .select()

  return data || []
}
