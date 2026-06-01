import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { addFavorite, removeFavorite, isFavorite } from '../utils/db'
import { openFolderAndScan, addFolderToLibrary, addIndividualFiles, regrantAndRestore, pickFiles } from '../utils/folderScanner'
import { formatTime, isMediaFile, buildTrackFromFile } from '../utils/helpers'
import SeekBar from '../components/SeekBar'
import AddToPlaylistSheet from '../components/AddToPlaylistSheet'
import LyricsSheet from '../components/LyricsSheet'
import logo from '../assets/logo.png'

// ── Animated visualizer bars ──────────────────────────────────────────────────
function VisualizerBars({ isPlaying, color = '#38BDF8', count = 24 }) {
  return (
    <div style={{ display:'flex', gap:2.5, alignItems:'flex-end', height:40 }}>
      {Array.from({length:count},(_,i) => {
        const h = 4 + Math.sin(i*0.7)*14 + Math.cos(i*0.4)*8
        return (
          <div key={i} style={{
            width: 3, borderRadius: 3,
            background: `linear-gradient(to top, ${color}88, ${color})`,
            flexShrink: 0,
            height: isPlaying ? `${Math.max(4,h)}px` : '3px',
            opacity: isPlaying ? 0.5 + (i%4)*0.12 : 0.15,
            animation: isPlaying ? `wave ${0.4+(i%8)*0.07}s ease-in-out ${i*0.025}s infinite alternate` : 'none',
            boxShadow: isPlaying ? `0 0 6px ${color}66` : 'none',
            transition: 'height 0.4s ease, opacity 0.4s',
          }}/>
        )
      })}
    </div>
  )
}

// ── Rotating vinyl disc ───────────────────────────────────────────────────────
function VinylDisc({ isPlaying, image, size = 160 }) {
  const r = useRef(0)
  const rafRef = useRef(null)
  const discRef = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    const animate = (ts) => {
      if (lastRef.current !== null && isPlaying) {
        r.current = (r.current + (ts - lastRef.current) * 0.04) % 360
        if (discRef.current) discRef.current.style.transform = `rotate(${r.current}deg)`
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying])

  const R = size
  return (
    <div style={{ position:'relative', width:R, height:R, flexShrink:0 }}>
      {/* Outer glow ring */}
      <div style={{
        position:'absolute', inset:-6, borderRadius:'50%',
        background: isPlaying
          ? 'conic-gradient(from 0deg, #2563EB44, #38BDF8cc, #2563EB44, #38BDF888, #2563EB44)'
          : 'transparent',
        animation: isPlaying ? 'spin 3s linear infinite' : 'none',
        transition: 'all 0.5s',
      }}/>

      {/* Vinyl disc */}
      <div ref={discRef} style={{
        position:'absolute', inset:0, borderRadius:'50%',
        background: image
          ? `url(${image}) center/cover`
          : 'radial-gradient(circle at 30% 30%, #1e3a5f, #0f172a)',
        boxShadow: isPlaying
          ? '0 0 40px rgba(56,189,248,0.35), 0 8px 32px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.4)'
          : '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.5s',
        overflow:'hidden',
      }}>
        {/* Groove rings */}
        {!image && [0.75, 0.6, 0.45, 0.32].map((f,i) => (
          <div key={i} style={{
            position:'absolute',
            top:`${(1-f)/2*100}%`, left:`${(1-f)/2*100}%`,
            width:`${f*100}%`, height:`${f*100}%`,
            borderRadius:'50%',
            border:'1px solid rgba(56,189,248,0.12)',
            pointerEvents:'none',
          }}/>
        ))}
        {/* Center label */}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width: R*0.28, height: R*0.28, borderRadius:'50%',
          background: 'radial-gradient(circle, #1a2744, #0f172a)',
          border: '2px solid rgba(56,189,248,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 12px rgba(56,189,248,0.2)',
        }}>
          {/* Center hole */}
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#000', border:'1px solid rgba(56,189,248,0.4)' }}/>
        </div>
      </div>

      {/* Needle arm */}
      <div style={{
        position:'absolute', top:-8, right:-12,
        width:3, height: R*0.55,
        background: 'linear-gradient(to bottom, #94a3b8, #475569)',
        borderRadius:3,
        transformOrigin:'top center',
        transform: isPlaying ? 'rotate(22deg)' : 'rotate(40deg)',
        transition:'transform 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        zIndex:3,
        boxShadow:'1px 1px 4px rgba(0,0,0,0.5)',
      }}>
        <div style={{ position:'absolute', bottom:-3, left:'50%', transform:'translateX(-50%)', width:7, height:7, borderRadius:'50%', background:'#38BDF8', boxShadow:'0 0 6px #38BDF8' }}/>
      </div>
    </div>
  )
}

// ── Particle burst on play ────────────────────────────────────────────────────
function Particles({ active }) {
  if (!active) return null
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', borderRadius:'50%' }}>
      {Array.from({length:12},(_,i)=>{
        const angle = (i/12)*360
        const dist = 40+Math.random()*30
        return (
          <div key={i} style={{
            position:'absolute', top:'50%', left:'50%',
            width:4, height:4, borderRadius:'50%',
            background: i%3===0?'#38BDF8':i%3===1?'#2563EB':'#60a5fa',
            transform:'translate(-50%,-50%)',
            animation:`particle_${i} 0.8s ease-out forwards`,
          }}/>
        )
      })}
    </div>
  )
}

// ── Scan overlay ──────────────────────────────────────────────────────────────
function ScanOverlay({ count, last, title }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(8,14,26,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,zIndex:9999}}>
      <img src={logo} style={{width:88,height:88,objectFit:'contain',borderRadius:14,filter:'drop-shadow(0 0 20px rgba(56,189,248,0.5))'}}/>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:700,color:'var(--sky)',letterSpacing:3,marginBottom:8}}>{title||'SCANNING…'}</div>
        <div style={{fontSize:30,fontWeight:700,color:'var(--white)',marginBottom:4}}>{count} <span style={{fontSize:12,color:'var(--muted)',fontWeight:400}}>files found</span></div>
        {last&&<div style={{fontSize:10,color:'var(--dimmed)',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 8px'}}>{last}</div>}
      </div>
      <div style={{display:'flex',gap:5}}>{[0,1,2,3,4].map(i=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'var(--sky)',opacity:0.2,animation:`pulse 1.3s ease-in-out ${i*0.18}s infinite`}}/>)}</div>
    </div>
  )
}

function RestoreScreen({ totalSaved, onRestore, onOpenFolder, onSelectFiles }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 28px',textAlign:'center'}}>
      <img src={logo} style={{width:108,height:108,objectFit:'contain',marginBottom:20,filter:'drop-shadow(0 0 24px rgba(56,189,248,0.45))'}}/>
      <div style={{fontSize:18,fontWeight:700,color:'var(--white)',marginBottom:8}}>Your Library Is Ready</div>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:8,lineHeight:1.8,maxWidth:290}}>{totalSaved} saved files found. Tap below to restore.</div>
      <div style={{fontSize:10,color:'var(--dimmed)',marginBottom:28,padding:'8px 12px',background:'var(--navy-light)',borderRadius:8,border:'1px solid var(--navy-border)',maxWidth:290,lineHeight:1.7}}>
        💡 Install as app (⋮ → Add to Home Screen) to skip this step permanently.
      </div>
      <button onClick={onRestore} style={{width:'100%',maxWidth:300,background:'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',color:'var(--navy)',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,letterSpacing:1,marginBottom:12,boxShadow:'0 0 28px rgba(56,189,248,0.5)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
        🔓 RESTORE {totalSaved} FILES
      </button>
      <button onClick={onOpenFolder} style={{width:'100%',maxWidth:300,background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:14,padding:'12px',fontSize:12,fontWeight:600,letterSpacing:1,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>📂 Open Different Folder</button>
      <button onClick={onSelectFiles} style={{width:'100%',maxWidth:300,background:'transparent',border:'none',color:'var(--dimmed)',padding:'8px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>+ Select individual files</button>
    </div>
  )
}

function EmptyState({ onFolder, onFiles }) {
  const hasFSA = 'showDirectoryPicker' in window
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 28px',textAlign:'center'}}>
      <img src={logo} style={{width:120,height:120,objectFit:'contain',marginBottom:20,filter:'drop-shadow(0 0 28px rgba(56,189,248,0.4))'}}/>
      <div style={{fontSize:20,fontWeight:700,color:'var(--white)',marginBottom:8}}>AppiStream</div>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:28,lineHeight:1.8,maxWidth:290}}>Open your Music folder once — AppiStream remembers it forever.</div>
      {hasFSA&&(
        <button onClick={onFolder} style={{width:'100%',maxWidth:300,background:'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',color:'var(--navy)',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,letterSpacing:1.5,marginBottom:12,boxShadow:'0 0 28px rgba(56,189,248,0.5)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <span style={{fontSize:22}}>📂</span> OPEN MUSIC FOLDER
        </button>
      )}
      <button onClick={onFiles} style={{width:'100%',maxWidth:300,background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:14,padding:'13px',fontSize:13,fontWeight:600,letterSpacing:1,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
        <span style={{fontSize:18}}>🎵</span> SELECT FILES
      </button>
      <div style={{marginTop:14,fontSize:10,color:'var(--dimmed)',opacity:0.6}}>MP3 · WAV · FLAC · AAC · M4A · OGG · MP4 · MKV…</div>
    </div>
  )
}

export default function NowPlaying() {
  const { state, controls, derived, restoreLastRef, notify, dispatch } = usePlayer()
  const {
    audioQueue, audioIndex, audioPlaying:isPlaying, audioTime:currentTime, audioDuration:duration,
    loop, shuffle, playbackRate, sleepTimerEnd, restoring, needsPermission, totalSaved, hasSavedFiles,
    eqEnabled, volume, isMuted
  } = state
  const { currentAudioTrack:currentTrack } = derived
  const navigate = useNavigate()
  const [isFav, setIsFav] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanLast, setScanLast] = useState('')
  const [scanTitle, setScanTitle] = useState('')
  const progress = duration ? currentTime/duration : 0
  const timerLeft = sleepTimerEnd ? Math.max(0,Math.ceil((sleepTimerEnd-Date.now())/60000)) : null
  const loopIcons={none:'↩',one:'🔂',all:'🔁'}, nextLoop={none:'one',one:'all',all:'none'}

  useEffect(()=>{ if(!currentTrack) return; isFavorite(currentTrack.id).then(setIsFav) },[currentTrack?.id])

  const doScan = useCallback(async (scanFn, title) => {
    setScanning(true); setScanCount(0); setScanLast(''); setScanTitle(title||'SCANNING…')
    try {
      const tracks = await scanFn((c,n)=>{ setScanCount(c); setScanLast(n) })
      if (!tracks||!tracks.length) { notify(tracks===null?'Folder scan not supported':'No media files found','warning'); return }
      const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
      if(audio.length) controls.addAudio(audio)
      if(video.length) controls.addVideo(video)
      dispatch({type:'SET',payload:{needsPermission:false,hasSavedFiles:true,totalSaved:tracks.length}})
      notify(`Loaded ${audio.length} songs + ${video.length} videos`)
    } catch { notify('Error accessing folder','error') }
    finally { setScanning(false) }
  }, [])

  const handleFolder = useCallback(()=>doScan(addFolderToLibrary,'ADDING FOLDER…'),[doScan])
  const handleRestore = useCallback(()=>doScan(regrantAndRestore,'RESTORING LIBRARY…'),[doScan])
  const handleFiles = useCallback(async()=>{
    const files = await pickFiles()
    if (!files.length) return
    const tracks = await addIndividualFiles(files)
    const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
    if(audio.length) controls.addAudio(audio)
    if(video.length) controls.addVideo(video)
    dispatch({type:'SET',payload:{hasSavedFiles:true}})
    notify(`Added ${tracks.length} files`)
  },[])

  const handleFav = async()=>{
    if(!currentTrack) return
    if(isFav){await removeFavorite(currentTrack.id);setIsFav(false);notify('Removed from favorites')}
    else{await addFavorite(currentTrack);setIsFav(true);notify('Added to favorites ♥')}
  }

  if (restoring) return <ScanOverlay count={state.totalSaved} last={restoreLastRef.current} title="LOADING LIBRARY…"/>
  if (scanning) return <ScanOverlay count={scanCount} last={scanLast} title={scanTitle}/>

  return (
    <div style={{minHeight:'100%',background:'var(--navy)',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      {/* Animated background blobs when playing */}
      {isPlaying && currentTrack && (
        <>
          <div style={{position:'absolute',top:-60,left:-60,width:220,height:220,borderRadius:'50%',background:'radial-gradient(circle,rgba(37,99,235,0.18),transparent 70%)',animation:'pulse 3s ease-in-out infinite',pointerEvents:'none',zIndex:0}}/>
          <div style={{position:'absolute',top:80,right:-80,width:280,height:280,borderRadius:'50%',background:'radial-gradient(circle,rgba(56,189,248,0.1),transparent 70%)',animation:'pulse 4s ease-in-out 1s infinite',pointerEvents:'none',zIndex:0}}/>
          <div style={{position:'absolute',bottom:120,left:-40,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%)',animation:'pulse 5s ease-in-out 2s infinite',pointerEvents:'none',zIndex:0}}/>
        </>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px 6px',flexShrink:0,position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <img src={logo} style={{width:32,height:32,objectFit:'contain',borderRadius:7,filter:'drop-shadow(0 0 7px rgba(56,189,248,0.5))'}}/>
          <div>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:2.5,color:'var(--sky)',lineHeight:1,textShadow:'0 0 12px rgba(56,189,248,0.6)'}}>APPISTREAM</div>
            <div style={{fontSize:7,color:'var(--dimmed)',letterSpacing:2.5,marginTop:1}}>PLAY · STREAM · ENJOY</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>navigate('/online')} style={{color:'var(--muted)',fontSize:13,padding:'4px 8px',background:'var(--navy-light)',border:'1px solid var(--navy-border)',borderRadius:6}} title="Online Music">🌐</button>
          <button onClick={()=>navigate('/equalizer')} style={{color:eqEnabled?'var(--sky)':'var(--muted)',fontSize:16,padding:4,background:'none',border:'none'}}>🎚</button>
          <button onClick={()=>setShowTimer(t=>!t)} style={{color:timerLeft?'var(--warning)':'var(--muted)',fontSize:13,padding:4,background:'none',border:'none'}}>{timerLeft?`⏱${timerLeft}m`:'⏱'}</button>
        </div>
      </div>

      {/* Content */}
      {needsPermission && !currentTrack ? (
        <RestoreScreen totalSaved={totalSaved} onRestore={handleRestore} onOpenFolder={handleFolder} onSelectFiles={handleFiles}/>
      ) : !currentTrack ? (
        <EmptyState onFolder={handleFolder} onFiles={handleFiles}/>
      ) : (
        <div style={{flex:1,display:'flex',flexDirection:'column',padding:'4px 16px 8px',position:'relative',zIndex:1}}>

          {/* ── VINYL DISC ── */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:14,flexShrink:0}}>
            <VinylDisc isPlaying={isPlaying} image={currentTrack.image||null} size={160}/>
          </div>

          {/* Track info + visualizer */}
          <div style={{textAlign:'center',marginBottom:10,flexShrink:0}}>
            <div style={{fontSize:16,fontWeight:700,color:'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3,textShadow:isPlaying?'0 0 20px rgba(56,189,248,0.3)':'none',transition:'text-shadow 0.5s'}}>
              {currentTrack.displayName}
            </div>
            {currentTrack.artist&&<div style={{fontSize:12,color:'var(--muted)',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{currentTrack.artist}</div>}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <span style={{fontSize:9,color:currentTrack.online?'#f59e0b':'var(--sky)',border:`1px solid ${currentTrack.online?'#f59e0b':'var(--sky)'}`,borderRadius:3,padding:'1px 5px',letterSpacing:1}}>
                {currentTrack.online?'ONLINE':currentTrack.ext?.toUpperCase()}
              </span>
              <VisualizerBars isPlaying={isPlaying} count={20} color="var(--sky)"/>
              <span style={{fontSize:10,color:'var(--dimmed)',fontFamily:'monospace'}}>{(audioIndex??0)+1}/{audioQueue.length}</span>
            </div>
          </div>

          {/* Seek */}
          <SeekBar currentTime={currentTime} duration={duration} onSeek={controls.seek} color="var(--sky)"/>

          {/* Controls */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:14,flexShrink:0}}>
            <button onClick={()=>controls.toggleShuffle()} style={{color:shuffle?'var(--sky)':'var(--dimmed)',fontSize:19,padding:5,filter:shuffle?'drop-shadow(0 0 6px var(--sky))':'none',background:'none',border:'none'}}>⇄</button>
            <button onClick={()=>controls.seekBy(-10)} style={{color:'var(--muted)',padding:5,display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none'}}>
              <span style={{fontSize:17}}>⏪</span><span style={{fontSize:8,color:'var(--dimmed)'}}>10s</span>
            </button>
            <button onClick={()=>controls.prev()} style={{background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--white)',width:42,height:42,borderRadius:'50%',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>⏮</button>
            <button onClick={()=>controls.toggle()}
              style={{background:isPlaying?'linear-gradient(135deg,var(--blue),var(--sky))':'linear-gradient(135deg,#1e3a5f,var(--blue))',border:'none',color:isPlaying?'var(--navy)':'var(--sky)',width:64,height:64,borderRadius:'50%',fontSize:26,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:isPlaying?'0 0 28px rgba(56,189,248,0.7), 0 0 60px rgba(56,189,248,0.2)':'0 0 12px rgba(37,99,235,0.4)',fontWeight:700,transition:'all 0.3s',transform:isPlaying?'scale(1.05)':'scale(1)'}}>
              {isPlaying?'⏸':'▶'}
            </button>
            <button onClick={()=>controls.next()} style={{background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--white)',width:42,height:42,borderRadius:'50%',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>⏭</button>
            <button onClick={()=>controls.seekBy(10)} style={{color:'var(--muted)',padding:5,display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none'}}>
              <span style={{fontSize:17}}>⏩</span><span style={{fontSize:8,color:'var(--dimmed)'}}>10s</span>
            </button>
            <button onClick={()=>controls.setLoop(nextLoop[loop])} style={{color:loop!=='none'?'var(--sky)':'var(--dimmed)',fontSize:19,padding:5,filter:loop!=='none'?'drop-shadow(0 0 6px var(--sky))':'none',background:'none',border:'none'}}>{loopIcons[loop]}</button>
          </div>

          {/* Volume */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexShrink:0}}>
            <button onClick={()=>controls.toggleMute()} style={{color:'var(--muted)',fontSize:16,background:'none',border:'none'}}>{isMuted||volume===0?'🔇':volume<0.4?'🔈':'🔊'}</button>
            <input type="range" min={0} max={1} step={0.01} value={isMuted?0:volume} onChange={e=>controls.setVolume(parseFloat(e.target.value))}
              style={{flex:1,background:`linear-gradient(to right,var(--blue) ${(isMuted?0:volume)*100}%,var(--dimmed) ${(isMuted?0:volume)*100}%)`}}/>
            <span style={{fontSize:11,color:'var(--muted)',fontFamily:'monospace',minWidth:26}}>{Math.round((isMuted?0:volume)*100)}</span>
          </div>

          {/* Secondary controls — 6 buttons in 3 cols */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,flexShrink:0}}>
            {[
              {icon:isFav?'♥':'♡', label:'Favorite', color:isFav?'#ef4444':undefined, glow:isFav, fn:handleFav},
              {icon:'📋', label:'Queue', active:showQueue, fn:()=>setShowQueue(q=>!q)},
              {icon:'➕', label:'Playlist', fn:()=>setShowPlaylist(true)},
              {icon:`${playbackRate}×`, label:'Speed', fn:()=>setShowSpeed(s=>!s)},
              {icon:'🎤', label:'Lyrics', fn:()=>setShowLyrics(true)},
              {icon:'🎚', label:'EQ', active:eqEnabled, fn:()=>navigate('/equalizer')},
            ].map(b=>(
              <button key={b.label} onClick={b.fn} style={{background:b.active?'var(--blue-dim)':'var(--navy-light)',border:`1px solid ${b.active?'var(--blue)':'var(--navy-border)'}`,borderRadius:8,padding:'8px 4px',color:b.color||(b.active?'var(--sky)':'var(--muted)'),display:'flex',flexDirection:'column',alignItems:'center',gap:3,transition:'all 0.2s',filter:b.glow?'drop-shadow(0 0 6px #ef444466)':'none'}}>
                <span style={{fontSize:18}}>{b.icon}</span>
                <span style={{fontSize:9,letterSpacing:0.5}}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Panels */}
      {showSpeed&&(
        <div style={{padding:'10px 16px',background:'var(--navy-light)',borderTop:'1px solid var(--navy-border)',flexShrink:0,position:'relative',zIndex:1}}>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:8,letterSpacing:1}}>PLAYBACK SPEED</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[0.5,0.75,1,1.25,1.5,2].map(s=><button key={s} onClick={()=>{controls.setPlaybackRate(s);setShowSpeed(false)}} style={{background:playbackRate===s?'var(--blue-dim)':'var(--navy)',border:`1px solid ${playbackRate===s?'var(--blue)':'var(--navy-border)'}`,color:playbackRate===s?'var(--sky)':'var(--muted)',borderRadius:6,padding:'6px 14px',fontSize:12,fontWeight:600}}>{s}×</button>)}
          </div>
        </div>
      )}
      {showTimer&&(
        <div style={{padding:'10px 16px',background:'var(--navy-light)',borderTop:'1px solid var(--navy-border)',flexShrink:0,position:'relative',zIndex:1}}>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:8,letterSpacing:1}}>SLEEP TIMER {timerLeft&&`(${timerLeft}m left)`}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:sleepTimerEnd?8:0}}>
            {[5,10,15,30,45,60].map(m=><button key={m} onClick={()=>{controls.setSleepTimer(m);setShowTimer(false)}} style={{background:'var(--navy)',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:6,padding:'6px 12px',fontSize:12}}>{m}m</button>)}
          </div>
          {sleepTimerEnd&&<button onClick={()=>{controls.setSleepTimer(null);setShowTimer(false)}} style={{color:'var(--danger)',fontSize:11,background:'none',border:'none'}}>Cancel</button>}
        </div>
      )}
      {showQueue&&(
        <div style={{background:'var(--navy-light)',borderTop:'1px solid var(--navy-border)',maxHeight:220,overflowY:'auto',flexShrink:0,position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px',borderBottom:'1px solid var(--navy-border)',position:'sticky',top:0,background:'var(--navy-light)'}}>
            <span style={{fontSize:11,color:'var(--muted)',letterSpacing:1}}>QUEUE ({audioQueue.length})</span>
            <button onClick={controls.clearAudio} style={{color:'var(--danger)',fontSize:10,background:'none',border:'none'}}>CLEAR</button>
          </div>
          {audioQueue.map((t,i)=>(
            <div key={t.id} onClick={()=>controls.playAudioAt(i)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',cursor:'pointer',background:i===audioIndex?'rgba(56,189,248,0.08)':'transparent',borderLeft:i===audioIndex?'2px solid var(--sky)':'2px solid transparent'}}>
              {t.image?<img src={t.image} style={{width:32,height:32,borderRadius:6,objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>:<span style={{fontSize:13,color:i===audioIndex?'var(--sky)':'var(--muted)',flexShrink:0}}>{i===audioIndex&&isPlaying?'▶':t.online?'🌐':'🎵'}</span>}
              <span style={{flex:1,fontSize:12,color:i===audioIndex?'var(--sky)':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.displayName}</span>
              <button onClick={e=>{e.stopPropagation();controls.removeAudio(i)}} style={{color:'var(--dimmed)',fontSize:14,background:'none',border:'none'}}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{padding:'8px 16px',borderTop:'1px solid var(--navy-border)',display:'flex',gap:8,flexShrink:0,position:'relative',zIndex:1}}>
        {'showDirectoryPicker' in window&&<button onClick={handleFolder} style={{flex:1,background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>📂 ADD FOLDER</button>}
        <button onClick={handleFiles} style={{flex:1,background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🎵 ADD FILES</button>
      </div>

      <div style={{height:2,background:'linear-gradient(to right,transparent,var(--sky),transparent)',opacity:isPlaying?1:0.1,transition:'opacity 0.5s',position:'relative',zIndex:1}}/>

      {/* Sheets */}
      {showPlaylist&&currentTrack&&<AddToPlaylistSheet track={currentTrack} onClose={()=>setShowPlaylist(false)} onNotify={notify}/>}
      {showLyrics&&currentTrack&&<LyricsSheet track={currentTrack} isPlaying={isPlaying} currentTime={currentTime} duration={duration} onClose={()=>setShowLyrics(false)}/>}
    </div>
  )
}
