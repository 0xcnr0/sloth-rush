import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Mint from './pages/Mint'
import Collection from './pages/Collection'
import RaceLobby from './pages/RaceLobby'
import RaceBroadcast from './pages/RaceBroadcast'
import Leaderboard from './pages/Leaderboard'
import RaceReplay from './pages/RaceReplay'
import Profile from './pages/Profile'
import Guide from './pages/Guide'
import DevPreview from './pages/DevPreview'
import NotFound from './pages/NotFound'
import { FEATURES } from './config/features'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/race" element={<RaceLobby />} />
        <Route path="/race/:id" element={<RaceBroadcast />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        {/* Spectate folded into Ranks — the live list is there now. */}
        <Route path="/spectate" element={<Navigate to="/leaderboard" replace />} />
        <Route path="/replay/:id" element={FEATURES.replay ? <RaceReplay /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={FEATURES.profile ? <Profile /> : <Navigate to="/" replace />} />
        <Route path="/guide" element={<Guide />} />
        {/* Component gallery, dev builds only — see pages/DevPreview.tsx. */}
        {import.meta.env.DEV && <Route path="/dev" element={<DevPreview />} />}
        {/* Redirects for old routes */}
        <Route path="/stable" element={<Navigate to="/collection" replace />} />
        <Route path="/treehouse" element={<Navigate to="/collection" replace />} />
        <Route path="/history" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
