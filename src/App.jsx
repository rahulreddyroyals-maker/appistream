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
  const { state, audioRef, videoRef, audioHandlers, videoHandlers } = usePlayer()
  const { activeMode } = state
  const loc = useLocation()
  const onPlayer = loc.pathname === '/' || loc.pathname === '/video'

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',background:'var(--navy)',paddingTop:'var(--safe-top)' }}>
      <audio ref={audioRef} style={{ display:'none' }}
        onTimeUpdate={audioHandlers.onTimeUpdate} onLoadedMetadata={audioHandlers.onLoadedMetadata}
        onPlay={audioHandlers.onPlay} onPause={audioHandlers.onPause}
        onEnded={audioHandlers.onEnded} onError={audioHandlers.onError}/>

      <video ref={videoRef} playsInline
        style={{ display:loc.pathname==='/video'?'block':'none', width:'100%', background:'#000', flexShrink:0, maxHeight:'42vh', objectFit:'contain' }}
        onTimeUpdate={videoHandlers.onTimeUpdate} onLoadedMetadata={videoHandlers.onLoadedMetadata}
        onPlay={videoHandlers.onPlay} onPause={videoHandlers.onPause}
        onEnded={videoHandlers.onEnded} onError={videoHandlers.onError}/>

      <div style={{ flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch' }}>
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

      <nav style={{ display:'flex',background:'var(--navy-light)',borderTop:'1px solid var(--navy-border)',paddingBottom:'var(--safe-bottom)',flexShrink:0 }}>
        {[
          { to:'/',        icon:null,  label:'Music'   },
          { to:'/video',   icon:'🎬',  label:'Videos'  },
          { to:'/online',  icon:'🌐',  label:'Online'  },
          { to:'/library', icon:'🎵',  label:'Library' },
          { to:'/settings',icon:'⚙',   label:'More'    },
        ].map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'||to==='/video'||to==='/online'}
            style={({ isActive }) => ({
              flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              padding:'7px 4px',textDecoration:'none',gap:2,
              color:isActive?'var(--sky)':'var(--muted)',
              fontSize:10,letterSpacing:0.5,fontWeight:600,
              borderTop:isActive?'2px solid var(--sky)':'2px solid transparent',
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
