import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Mint from './pages/Mint'
import Stable from './pages/Stable'
import RaceLobby from './pages/RaceLobby'
import RaceBroadcast from './pages/RaceBroadcast'
import Shop from './pages/Shop'
import RaceHistory from './pages/RaceHistory'

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
      </Route>
    </Routes>
  )
}
