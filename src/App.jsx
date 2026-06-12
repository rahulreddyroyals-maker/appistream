import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'
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

// ── Video fullscreen overlay (handles actual <video> element) ─────────────────
function VideoArea({ videoRef, videoHandlers, isVideoRoute, isPlaying }) {
  const [isFS, setIsFS] = useState(false)
  const [showCtrl, setShowCtrl] = useState(true)
  const [isTouching, setIsTouching] = useState(false)
  const containerRef = useRef(null)
  const hideTimer = useRef(null)
  const { controls, state } = usePlayer()
  const { videoTime: currentTime, videoDuration: duration, volume, isMuted, loop, shuffle, videoQueue, videoIndex } = state
  const currentTrack = videoIndex != null ? videoQueue[videoIndex] : null
  const loopIcons = { none:'↩', one:'🔂', all:'🔁' }
  const nextLoop = { none:'one', one:'all', all:'none' }

  useEffect(() => {
    const onFS = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFS(fs)
      setShowCtrl(true)
    }
    document.addEventListener('fullscreenchange', onFS)
    document.addEventListener('webkitfullscreenchange', onFS)
    return () => {
      document.removeEventListener('fullscreenchange', onFS)
      document.removeEventListener('webkitfullscreenchange', onFS)
      clearTimeout(hideTimer.current)
    }
  }, [])

  const showControls = () => {
    setShowCtrl(true)
    clearTimeout(hideTimer.current)
    if (isFS) hideTimer.current = setTimeout(() => setShowCtrl(false), 3500)
  }

  const enterFS = (orientation = 'landscape') => {
    const el = containerRef.current
    if (!el) return
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) req.call(el)
    try { screen.orientation?.lock(orientation).catch(() => {}) } catch(_) {}
  }

  const exitFS = () => {
    const ex = document.exitFullscreen || document.webkitExitFullscreen
    if (ex) ex.call(document)
    try { screen.orientation?.unlock() } catch(_) {}
  }

  if (!isVideoRoute) return null

  return (
    <div
      ref={containerRef}
      onClick={showControls}
      style={{
        position: isFS ? 'fixed' : 'relative',
        inset: isFS ? 0 : 'auto',
        zIndex: isFS ? 9999 : 'auto',
        background: '#000',
        width: '100%',
        ...(isFS ? {} : { aspectRatio: '16/9', maxHeight: '45vw' }),
        flexShrink: 0,
      }}>

      {/* ── The actual <video> element ── */}
      <video
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: isFS ? 'contain' : 'cover', display: 'block' }}
        {...videoHandlers}
      />

      {/* ── Controls overlay ── */}
      {(showCtrl || !isFS) && currentTrack && (
        <div style={{
          position: 'absolute', inset: 0,
          background: isFS
            ? 'linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 35%,transparent 65%,rgba(0,0,0,0.6) 100%)'
            : 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 50%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: isFS ? 16 : '6px 10px',
          transition: 'opacity 0.3s',
        }}>
          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isFS && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
                {currentTrack.displayName}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {/* Portrait fullscreen (9:16 - WhatsApp/Reels videos) */}
              {!isFS && (
                <button onClick={e => { e.stopPropagation(); enterFS('portrait') }}
                  title="Portrait fullscreen (9:16)"
                  style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                  <span style={{fontSize:12}}>⛶</span>
                  <span style={{fontSize:7}}>9:16</span>
                </button>
              )}
              {/* Landscape fullscreen (16:9 - normal videos) */}
              <button onClick={e => { e.stopPropagation(); isFS ? exitFS() : enterFS('landscape') }}
                title={isFS ? 'Exit fullscreen' : 'Landscape fullscreen (16:9)'}
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 14, cursor: 'pointer' }}>
                {isFS ? '✕' : '⛶'}
              </button>
            </div>
          </div>

          {/* Bottom controls */}
          <div>
            {/* Seek bar */}
            <div style={{ marginBottom: 8 }}>
              <input type="range" min={0} max={duration || 1} step={0.5} value={currentTime}
                onChange={e => { e.stopPropagation(); controls.seek(parseFloat(e.target.value)) }}
                onClick={e => e.stopPropagation()}
                style={{ width: '100%', background: `linear-gradient(to right,#818cf8 ${(duration ? currentTime/duration : 0)*100}%,rgba(255,255,255,0.3) ${(duration ? currentTime/duration : 0)*100}%)` }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', marginTop: 2 }}>
                <span>{Math.floor(currentTime/60)}:{String(Math.floor(currentTime%60)).padStart(2,'0')}</span>
                <span>{Math.floor((duration||0)/60)}:{String(Math.floor((duration||0)%60)).padStart(2,'0')}</span>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={e=>{e.stopPropagation();controls.seekBy(-10)}} style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',fontSize:18,cursor:'pointer' }}>⏪</button>
                <button onClick={e=>{e.stopPropagation();controls.prev('video')}} style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',fontSize:18,cursor:'pointer' }}>⏮</button>
                <button onClick={e=>{e.stopPropagation();controls.toggle()}}
                  style={{ background:'rgba(124,58,237,0.8)',border:'2px solid #a78bfa',color:'#fff',width:isFS?52:38,height:isFS?52:38,borderRadius:'50%',fontSize:isFS?20:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                  {isPlaying?'⏸':'▶'}
                </button>
                <button onClick={e=>{e.stopPropagation();controls.next('video')}} style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',fontSize:18,cursor:'pointer' }}>⏭</button>
                <button onClick={e=>{e.stopPropagation();controls.seekBy(10)}} style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',fontSize:18,cursor:'pointer' }}>⏩</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={e=>{e.stopPropagation();controls.toggleMute()}} style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',fontSize:16,cursor:'pointer' }}>
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <button onClick={e=>{e.stopPropagation();controls.setLoop(nextLoop[loop])}}
                  style={{ color:loop!=='none'?'#a78bfa':'rgba(255,255,255,0.5)',background:'none',border:'none',fontSize:16,cursor:'pointer' }}>
                  {loopIcons[loop]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppShell() {
  const { state, audioRef, videoRef, audioHandlers, videoHandlers } = usePlayer()
  const { activeMode, videoPlaying } = state
  const loc = useLocation()
  const onPlayer = loc.pathname === '/' || loc.pathname === '/video'
  const isVideoRoute = loc.pathname === '/video'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--navy)', paddingTop:'var(--safe-top)' }}>
      {/* Always-mounted audio */}
      <audio ref={audioRef} style={{ display:'none' }}
        onTimeUpdate={audioHandlers.onTimeUpdate} onLoadedMetadata={audioHandlers.onLoadedMetadata}
        onPlay={audioHandlers.onPlay} onPause={audioHandlers.onPause}
        onEnded={audioHandlers.onEnded} onError={audioHandlers.onError}/>

      {/* Video area — sits at top of video route */}
      <VideoArea
        videoRef={videoRef}
        videoHandlers={videoHandlers}
        isVideoRoute={isVideoRoute}
        isPlaying={videoPlaying}
      />

      {/* Page content */}
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
          { to:'/',        icon:null,  label:'Music'   },
          { to:'/video',   icon:'🎬',  label:'Videos'  },
          { to:'/online',  icon:'▶',   label:'YouTube' },
          { to:'/library', icon:'🎵',  label:'Library' },
          { to:'/settings',icon:'⚙',   label:'More'    },
        ].map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'||to==='/video'||to==='/online'}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'7px 4px', textDecoration:'none', gap:2,
              color: isActive ? (to==='/online'?'#f87171':to==='/video'?'#a78bfa':'var(--sky)') : 'var(--muted)',
              fontSize:10, letterSpacing:0.5, fontWeight:600,
              borderTop: isActive ? `2px solid ${to==='/online'?'#ef4444':to==='/video'?'#7c3aed':'var(--sky)'}` : '2px solid transparent',
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
