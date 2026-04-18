const SUITS = ['H', 'D', 'C', 'S']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck() {
  const cards = []
  for (const suit of SUITS)
    for (const val of VALUES)
      cards.push(val + suit)
  cards.push('JOK1', 'JOK2')
  return cards
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardValue(code) {
  if (!code) return 0
  if (code.startsWith('JOK')) return -3
  const val = code.slice(0, -1)
  const suit = code.slice(-1)
  if (val === 'A') return 1
  if (val === 'J') return 10
  if (val === 'Q') return 10
  if (val === 'K') return (suit === 'H' || suit === 'D') ? 0 : 10
  return parseInt(val, 10)
}

export function cardPower(code) {
  if (!code || code.startsWith('JOK')) return null
  const val = code.slice(0, -1)
  if (val === 'J')  return 'peek_own'   // forced: peek at one of your cards
  if (val === '10') return 'spy'         // forced: peek at any opponent card
  if (val === 'Q')  return 'blind_swap'  // optional: swap with opponent
  if (val === 'K')  return 'king'        // spy any card, then optional swap
  return null
}

export function cardDisplay(code) {
  if (!code) return { label: '?', suit: '', color: '#6B7280', score: null }
  if (code.startsWith('JOK')) return { label: '🃏', suit: '', color: '#7C3AED', score: -3 }
  const val = code.slice(0, -1)
  const suit = code.slice(-1)
  const suits = { H: '♥', D: '♦', C: '♣', S: '♠' }
  const isRed = suit === 'H' || suit === 'D'
  return {
    label: val,
    suit: suits[suit] || suit,
    color: isRed ? '#EF4444' : '#111827',
    score: cardValue(code)
  }
}

export function powerLabel(power) {
  if (power === 'peek_own')   return '👁️ Peek (your card)'
  if (power === 'spy')        return '🔍 Spy (opponent)'
  if (power === 'blind_swap') return '↔️ Swap (optional)'
  if (power === 'king')       return '👑 King (spy + swap)'
  return ''
}

export function cardValueLabel(code) {
  const v = cardValue(code)
  return v < 0 ? String(v) : (v === 0 ? '0' : String(v))
}
