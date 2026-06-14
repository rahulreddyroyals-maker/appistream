import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import logo from './assets/logo.png'
import { PlayerProvider, usePlayer } from './context/PlayerContext'
import MiniPlayer from './components/MiniPlayer'
import Notification from './components/Notification'
import NowPlaying from './pages/NowPlaying'
import VideoPlayer from './pages/VideoPlayer'
import OnlineMusic from './pages/OnlineMusic'
import Library from './pages/Library'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Favorites from './pages/Favorites'
import History from './pages/History'
import Settings from './pages/Settings'
import Equalizer from './pages/Equalizer'

function AppShell() {
  const { audioRef, videoRef, audioHandlers, videoHandlers, state } = usePlayer()
  const { videoPlaying } = state
  const loc = useLocation()
  const onPlayer = loc.pathname === '/' || loc.pathname === '/video'
  const isVideoRoute = loc.pathname === '/video'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--navy)', paddingTop:'var(--safe-top)' }}>
      {/* Audio — always mounted, always hidden */}
      <audio ref={audioRef} style={{ display:'none' }}
        onTimeUpdate={audioHandlers.onTimeUpdate} onLoadedMetadata={audioHandlers.onLoadedMetadata}
        onPlay={audioHandlers.onPlay} onPause={audioHandlers.onPause}
        onEnded={audioHandlers.onEnded} onError={audioHandlers.onError}/>

      {/* Video — always mounted, ONLY visible on /video route, fills page there */}
      <video ref={videoRef} playsInline
        style={{
          display: isVideoRoute ? 'block' : 'none',
          width: '100%',
          background: '#000',
          flexShrink: 0,
          objectFit: 'contain',
          // Height controlled by VideoPlayer page
        }}
        onTimeUpdate={videoHandlers.onTimeUpdate} onLoadedMetadata={videoHandlers.onLoadedMetadata}
        onPlay={videoHandlers.onPlay} onPause={videoHandlers.onPause}
        onEnded={videoHandlers.onEnded} onError={videoHandlers.onError}/>

      {/* Pages */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' }}>
        <Routes>
          <Route path="/" element={<NowPlaying />} />
          <Route path="/video" element={<VideoPlayer />} />
          <Route path="/online" element={<OnlineMusic />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlists/:id" element={<PlaylistDetail />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/equalizer" element={<Equalizer />} />
        </Routes>
      </div>

      {!onPlayer && <MiniPlayer />}

      {/* Bottom nav */}
      <nav style={{ display:'flex', background:'var(--navy-light)', borderTop:'1px solid var(--navy-border)', paddingBottom:'var(--safe-bottom)', flexShrink:0 }}>
        {[
          { to:'/',        icon:null, label:'Music',   active:'var(--sky)',   border:'var(--sky)'   },
          { to:'/video',   icon:'🎬', label:'Videos',  active:'#a78bfa',     border:'#7c3aed'      },
          { to:'/online',  icon:'▶',  label:'YouTube', active:'#f87171',     border:'#ef4444'      },
          { to:'/library', icon:'🎵', label:'Library', active:'var(--sky)',   border:'var(--sky)'   },
          { to:'/settings',icon:'⚙',  label:'More',    active:'var(--sky)',   border:'var(--sky)'   },
        ].map(({ to, icon, label, active, border }) => (
          <NavLink key={to} to={to} end={to==='/'||to==='/video'||to==='/online'}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'7px 4px', textDecoration:'none', gap:2,
              color: isActive ? active : 'var(--muted)',
              fontSize:10, letterSpacing:0.5, fontWeight:600,
              borderTop: isActive ? `2px solid ${border}` : '2px solid transparent',
              transition:'color 0.15s',
            })}>
            {icon
              ? <span style={{fontSize:17}}>{icon}</span>
              : <img src={logo} alt="Music" style={{width:20,height:20,objectFit:'contain',borderRadius:4}}/>}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Notification />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <AppShell />
      </PlayerProvider>
    </BrowserRouter>
  )
}
