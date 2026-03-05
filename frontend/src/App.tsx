import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Mint from './pages/Mint'
import Stable from './pages/Stable'
import RaceLobby from './pages/RaceLobby'
import RaceBroadcast from './pages/RaceBroadcast'
import Shop from './pages/Shop'
import Leaderboard from './pages/Leaderboard'
import MiniGames from './pages/MiniGames'
import Spectate from './pages/Spectate'
import RaceReplay from './pages/RaceReplay'
import Profile from './pages/Profile'
import Guide from './pages/Guide'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="/stable" element={<Stable />} />
        <Route path="/race" element={<RaceLobby />} />
        <Route path="/race/:id" element={<RaceBroadcast />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/mini-games" element={<MiniGames />} />
        <Route path="/spectate" element={<Spectate />} />
        <Route path="/replay/:id" element={<RaceReplay />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/guide" element={<Guide />} />
        {/* Redirects for old routes */}
        <Route path="/history" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
