import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Mint from './pages/Mint'
import Stable from './pages/Stable'
import RaceLobby from './pages/RaceLobby'
import RaceBroadcast from './pages/RaceBroadcast'
import Shop from './pages/Shop'
import RaceHistory from './pages/RaceHistory'
import Leaderboard from './pages/Leaderboard'
import MiniGames from './pages/MiniGames'
import Spectate from './pages/Spectate'
import RaceReplay from './pages/RaceReplay'
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
        <Route path="/history" element={<RaceHistory />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/mini-games" element={<MiniGames />} />
        <Route path="/spectate" element={<Spectate />} />
        <Route path="/replay/:id" element={<RaceReplay />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
