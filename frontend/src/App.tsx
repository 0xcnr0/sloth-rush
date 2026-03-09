import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Mint from './pages/Mint'
import Treehouse from './pages/Treehouse'
import RaceLobby from './pages/RaceLobby'
import RaceBroadcast from './pages/RaceBroadcast'
import Shop from './pages/Shop'
import Leaderboard from './pages/Leaderboard'
import Spectate from './pages/Spectate'
import RaceReplay from './pages/RaceReplay'
import Profile from './pages/Profile'
import Guide from './pages/Guide'
import NotFound from './pages/NotFound'
import { FEATURES } from './config/features'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="/treehouse" element={<Treehouse />} />
        <Route path="/race" element={<RaceLobby />} />
        <Route path="/race/:id" element={<RaceBroadcast />} />
        <Route path="/shop" element={FEATURES.shop ? <Shop /> : <Navigate to="/" replace />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/mini-games" element={<Navigate to="/treehouse" replace />} />
        <Route path="/spectate" element={FEATURES.spectate ? <Spectate /> : <Navigate to="/" replace />} />
        <Route path="/replay/:id" element={FEATURES.replay ? <RaceReplay /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={FEATURES.profile ? <Profile /> : <Navigate to="/" replace />} />
        <Route path="/guide" element={<Guide />} />
        {/* Redirects for old routes */}
        <Route path="/stable" element={<Navigate to="/treehouse" replace />} />
        <Route path="/history" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
