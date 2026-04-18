import { Routes, Route, Navigate } from 'react-router-dom'
import { usePlayer } from './context/PlayerContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import History from './pages/History'
import Rules from './pages/Rules'

function Protected({ children }) {
  const { player } = usePlayer()
  if (!player) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { player } = usePlayer()
  return (
    <>
      {player && <Navbar />}
      <Routes>
        <Route path="/" element={player ? <Navigate to="/lobby" replace /> : <Home />} />
        <Route path="/lobby"          element={<Protected><Lobby /></Protected>} />
        <Route path="/game/:code"     element={<Protected><Game /></Protected>} />
        <Route path="/profile"        element={<Protected><Profile /></Protected>} />
        <Route path="/leaderboard"    element={<Protected><Leaderboard /></Protected>} />
        <Route path="/history"        element={<Protected><History /></Protected>} />
        <Route path="/rules"          element={<Protected><Rules /></Protected>} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
