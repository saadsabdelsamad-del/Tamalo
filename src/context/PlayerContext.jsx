import { createContext, useContext, useState, useEffect } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tamalo_player')) } catch { return null }
  })

  function login(p) {
    localStorage.setItem('tamalo_player', JSON.stringify(p))
    setPlayer(p)
  }

  function logout() {
    localStorage.removeItem('tamalo_player')
    setPlayer(null)
  }

  function updatePlayer(fields) {
    const updated = { ...player, ...fields }
    localStorage.setItem('tamalo_player', JSON.stringify(updated))
    setPlayer(updated)
  }

  return (
    <PlayerContext.Provider value={{ player, login, logout, updatePlayer }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
