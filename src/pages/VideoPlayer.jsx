import { useCallback, useState, useRef, useEffect } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { addFolderToLibrary, addIndividualFiles, regrantAndRestore, pickFiles } from '../utils/folderScanner'
import { isVideoFile, buildTrackFromFile } from '../utils/helpers'
import SeekBar from '../components/SeekBar'
import logo from '../assets/logo.png'

function ScanOverlay({ count, last }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(8,14,26,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,zIndex:9999 }}>
      <img src={logo} style={{ width:80,height:80,objectFit:'contain',borderRadius:14 }}/>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13,fontWeight:700,color:'#a78bfa',letterSpacing:3,marginBottom:8 }}>SCANNING…</div>
        <div style={{ fontSize:26,fontWeight:700,color:'#fff',marginBottom:4 }}>{count} <span style={{ fontSize:12,color:'#94a3b8',fontWeight:400 }}>files found</span></div>
        {last&&<div style={{ fontSize:10,color:'#475569',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{last}</div>}
      </div>
    </div>
  )
}

function EmptyState({ onFolder, onFiles, needsPermission, totalSaved, onRestore }) {
  const hasFSA = 'showDirectoryPicker' in window
  if (needsPermission && totalSaved > 0) {
    return (
      <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 28px',textAlign:'center' }}>
        <span style={{ fontSize:64,marginBottom:16 }}>🎬</span>
        <div style={{ fontSize:17,fontWeight:700,color:'#fff',marginBottom:8 }}>Your Videos Are Saved</div>
        <div style={{ fontSize:12,color:'#94a3b8',marginBottom:24,lineHeight:1.8,maxWidth:280 }}>Tap to restore access to your video library.</div>
        <button onClick={onRestore} style={{ width:'100%',maxWidth:280,background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',color:'#fff',borderRadius:14,padding:'14px',fontSize:14,fontWeight:700,letterSpacing:1,boxShadow:'0 0 24px rgba(124,58,237,0.5)',cursor:'pointer',fontFamily:'inherit',marginBottom:12 }}>
          🔓 RESTORE VIDEOS
        </button>
        <button onClick={onFolder} style={{ width:'100%',maxWidth:280,background:'rgba(124,58,237,0.15)',border:'1px solid #7c3aed',color:'#a78bfa',borderRadius:14,padding:'11px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>
          📂 Open Different Folder
        </button>
      </div>
    )
  }
  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 28px',textAlign:'center' }}>
      <span style={{ fontSize:64,marginBottom:16,filter:'drop-shadow(0 0 20px rgba(124,58,237,0.4))' }}>🎬</span>
      <div style={{ fontSize:17,fontWeight:700,color:'#fff',marginBottom:8 }}>No Videos</div>
      <div style={{ fontSize:12,color:'#94a3b8',marginBottom:28,lineHeight:1.8,maxWidth:260 }}>Open a folder — AppiStream scans all subfolders automatically.</div>
      {hasFSA&&(
        <button onClick={onFolder} style={{ width:'100%',maxWidth:280,background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',color:'#fff',borderRadius:14,padding:'14px',fontSize:14,fontWeight:700,letterSpacing:1,marginBottom:12,boxShadow:'0 0 24px rgba(124,58,237,0.5)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}>
          <span style={{fontSize:20}}>📂</span> OPEN FOLDER
        </button>
      )}
      <button onClick={onFiles} style={{ width:'100%',maxWidth:280,background:'rgba(124,58,237,0.2)',border:'1px solid #7c3aed',color:'#a78bfa',borderRadius:14,padding:'12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}>
        <span style={{fontSize:18}}>🎬</span> SELECT VIDEO FILES
      </button>
      <div style={{ marginTop:14,fontSize:10,color:'#475569',opacity:0.7 }}>MP4 · WebM · MOV · MKV · AVI · M4V · 3GP</div>
    </div>
  )
}

export default function VideoPlayer() {
  const { state, controls, notify, dispatch } = usePlayer()
  const { videoQueue, videoIndex, videoPlaying:isPlaying, videoTime:currentTime, videoDuration:duration, volume, isMuted, loop, shuffle, needsPermission, totalSaved } = state
  const currentTrack = videoIndex!=null ? videoQueue[videoIndex] : null
  const [showQueue, setShowQueue] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanLast, setScanLast] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimer = useRef(null)
  const progress = duration ? currentTime/duration : 0
  const loopIcons = { none:'↩', one:'🔂', all:'🔁' }
  const nextLoop = { none:'one', one:'all', all:'none' }

  // Auto-hide controls after 3s in fullscreen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    if (isFullscreen) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [isFullscreen])

  useEffect(() => {
    const onFSChange = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFullscreen(fs)
      setShowControls(true)
    }
    document.addEventListener('fullscreenchange', onFSChange)
    document.addEventListener('webkitfullscreenchange', onFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange)
      document.removeEventListener('webkitfullscreenchange', onFSChange)
      clearTimeout(controlsTimer.current)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!isFullscreen) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen
      if (req) req.call(el)
      // Also try to lock to landscape for better viewing
      try { screen.orientation?.lock('landscape').catch(()=>{}) } catch(_){}
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      if (exit) exit.call(document)
      try { screen.orientation?.unlock() } catch(_){}
    }
  }, [isFullscreen])

  // Portrait fullscreen (9:16 videos like WhatsApp/Reels)
  const togglePortraitFS = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!isFullscreen) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen
      if (req) req.call(el)
      try { screen.orientation?.lock('portrait').catch(()=>{}) } catch(_){}
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      if (exit) exit.call(document)
      try { screen.orientation?.unlock() } catch(_){}
    }
  }, [isFullscreen])

  const doScan = useCallback(async (scanFn) => {
    setScanning(true); setScanCount(0); setScanLast('')
    try {
      const tracks = await scanFn((c,n)=>{ setScanCount(c); setScanLast(n) })
      if (!tracks?.length) { notify('No media files found','warning'); return }
      const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
      if (audio.length) controls.addAudio(audio)
      if (video.length) controls.addVideo(video)
      dispatch({type:'SET',payload:{needsPermission:false,hasSavedFiles:true}})
      notify(`Added ${video.length} video${video.length!==1?'s':''}${audio.length?` + ${audio.length} songs`:''}`)
    } catch { notify('Could not access folder','error') }
    finally { setScanning(false) }
  }, [])

  const handleFolder = useCallback(()=>doScan(addFolderToLibrary),[doScan])
  const handleRestore = useCallback(()=>doScan(regrantAndRestore),[doScan])
  const handleFiles = useCallback(async () => {
    const files = await pickFiles()
    const videos = files.filter(f=>isVideoFile(f.name))
    if (!videos.length) { notify('No video files selected','warning'); return }
    const tracks = await addIndividualFiles(videos)
    controls.addVideo(tracks.filter(t=>t.type==='video'))
    notify(`Added ${tracks.length} video${tracks.length!==1?'s':''}`)
  }, [])

  return (
    <div style={{ minHeight:'100%',background:'#000',display:'flex',flexDirection:'column' }}>
      {scanning && <ScanOverlay count={scanCount} last={scanLast}/>}

      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--navy)',flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <img src={logo} style={{ width:28,height:28,objectFit:'contain',borderRadius:6 }}/>
          <span style={{ fontSize:14,fontWeight:700,letterSpacing:2,color:'#a78bfa' }}>VIDEOS</span>
          <span style={{ fontSize:11,color:'#475569',marginLeft:4 }}>{videoQueue.length} files</span>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {videoQueue.length>0&&<button onClick={()=>setShowQueue(q=>!q)} style={{ color:showQueue?'#a78bfa':'var(--muted)',fontSize:13,padding:4,background:'none',border:'none' }}>📋 {videoQueue.length}</button>}
          {'showDirectoryPicker' in window&&<button onClick={handleFolder} style={{ color:'var(--muted)',fontSize:13,padding:4,background:'none',border:'none' }}>📂</button>}
          <button onClick={handleFiles} style={{ color:'var(--muted)',fontSize:13,padding:4,background:'none',border:'none' }}>+ FILE</button>
        </div>
      </div>

      {/* Content */}
      {!currentTrack ? (
        <div style={{ flex:1,display:'flex',flexDirection:'column',background:'var(--navy)' }}>
          <EmptyState onFolder={handleFolder} onFiles={handleFiles} onRestore={handleRestore}
            needsPermission={needsPermission} totalSaved={totalSaved}/>
        </div>
      ) : (
        <>
          {/* ── VIDEO CONTAINER with fullscreen ── */}
          <div ref={containerRef}
            onClick={resetControlsTimer}
            style={{ position:'relative',background:'#000',flexShrink:0,
              // In fullscreen this fills the screen
              width:'100%', aspectRatio: isFullscreen ? 'auto' : '16/9',
              ...(isFullscreen ? { position:'fixed',inset:0,zIndex:9998,aspectRatio:'auto' } : {})
            }}>

            {/* The actual video element from App.jsx is wired here via state */}
            {/* We show a placeholder since the real <video> is in App.jsx */}
            <div style={{ width:'100%',height:'100%',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',minHeight: isFullscreen ? '100vh' : 200 }}>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)' }}>Video plays in the area above</div>
            </div>

            {/* Fullscreen overlay controls */}
            {isFullscreen && showControls && (
              <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 40%,transparent 70%,rgba(0,0,0,0.5) 100%)',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:16 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.8)',flex:1,marginRight:12 }}>{currentTrack.displayName}</div>
                  <button onClick={toggleFullscreen} style={{ color:'#fff',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'6px 10px',fontSize:14,cursor:'pointer' }}>✕ Exit</button>
                </div>
                <div>
                  <SeekBar currentTime={currentTime} duration={duration} onSeek={controls.seek} color="#a78bfa"/>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:16,marginTop:8 }}>
                    <button onClick={()=>controls.seekBy(-10)} style={{ color:'#fff',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,fontSize:16,cursor:'pointer' }}>⏪</button>
                    <button onClick={()=>controls.prev('video')} style={{ color:'#fff',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,fontSize:16,cursor:'pointer' }}>⏮</button>
                    <button onClick={()=>controls.toggle()} style={{ background:'rgba(124,58,237,0.8)',border:'2px solid #a78bfa',color:'#fff',width:56,height:56,borderRadius:'50%',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                      {isPlaying?'⏸':'▶'}
                    </button>
                    <button onClick={()=>controls.next('video')} style={{ color:'#fff',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,fontSize:16,cursor:'pointer' }}>⏭</button>
                    <button onClick={()=>controls.seekBy(10)} style={{ color:'#fff',background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,fontSize:16,cursor:'pointer' }}>⏩</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Track info */}
          <div style={{ background:'rgba(0,0,0,0.8)',padding:'6px 14px',flexShrink:0 }}>
            <div style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{currentTrack.displayName}</div>
            <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1,display:'flex',gap:8,alignItems:'center' }}>
              <span>{(videoIndex??0)+1} of {videoQueue.length}</span>
              <span>·</span>
              <span>{currentTrack.ext?.toUpperCase()}</span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ background:'var(--navy)',padding:'10px 16px',flexShrink:0 }}>
            <SeekBar currentTime={currentTime} duration={duration} onSeek={controls.seek} color="#818cf8"/>

            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:12 }}>
              <button onClick={()=>controls.toggleShuffle()} style={{ color:shuffle?'#818cf8':'var(--dimmed)',fontSize:18,background:'none',border:'none',filter:shuffle?'drop-shadow(0 0 6px #818cf8)':'none' }}>⇄</button>
              <button onClick={()=>controls.seekBy(-10)} style={{ color:'var(--muted)',display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none' }}>
                <span style={{fontSize:17}}>⏪</span><span style={{fontSize:8,color:'var(--dimmed)'}}>10s</span>
              </button>
              <button onClick={()=>controls.prev('video')} style={{ background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--white)',width:40,height:40,borderRadius:'50%',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>⏮</button>
              <button onClick={()=>controls.toggle()} style={{ background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',color:'#fff',width:60,height:60,borderRadius:'50%',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 24px rgba(124,58,237,0.6)',fontWeight:700 }}>
                {isPlaying?'⏸':'▶'}
              </button>
              <button onClick={()=>controls.next('video')} style={{ background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--white)',width:40,height:40,borderRadius:'50%',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>⏭</button>
              <button onClick={()=>controls.seekBy(10)} style={{ color:'var(--muted)',display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none' }}>
                <span style={{fontSize:17}}>⏩</span><span style={{fontSize:8,color:'var(--dimmed)'}}>10s</span>
              </button>
              <button onClick={()=>controls.setLoop(nextLoop[loop])} style={{ color:loop!=='none'?'#818cf8':'var(--dimmed)',fontSize:18,background:'none',border:'none',filter:loop!=='none'?'drop-shadow(0 0 6px #818cf8)':'none' }}>{loopIcons[loop]}</button>
            </div>

            {/* Volume + Fullscreen buttons */}
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <button onClick={()=>controls.toggleMute()} style={{ color:'var(--muted)',fontSize:16,background:'none',border:'none',flexShrink:0 }}>{isMuted?'🔇':volume<0.4?'🔈':'🔊'}</button>
              <input type="range" min={0} max={1} step={0.01} value={isMuted?0:volume}
                onChange={e=>controls.setVolume(parseFloat(e.target.value))}
                style={{ flex:1,background:`linear-gradient(to right,#7c3aed ${(isMuted?0:volume)*100}%,var(--dimmed) ${(isMuted?0:volume)*100}%)` }}/>
              {/* Fullscreen buttons */}
              <button onClick={toggleFullscreen}
                title="Fullscreen (16:9 landscape)"
                style={{ background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'#a78bfa',borderRadius:7,padding:'6px 10px',fontSize:13,cursor:'pointer',flexShrink:0 }}>
                ⛶
              </button>
              <button onClick={togglePortraitFS}
                title="Fullscreen (9:16 portrait)"
                style={{ background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'#a78bfa',borderRadius:7,padding:'6px 8px',fontSize:11,cursor:'pointer',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:0,lineHeight:1 }}>
                <span style={{fontSize:10}}>⛶</span><span style={{fontSize:7,letterSpacing:0.3}}>9:16</span>
              </button>
            </div>
          </div>

          {/* Queue */}
          {showQueue && (
            <div style={{ background:'var(--navy-light)',flex:1,overflowY:'auto' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px',borderBottom:'1px solid var(--navy-border)',position:'sticky',top:0,background:'var(--navy-light)' }}>
                <span style={{ fontSize:11,color:'var(--muted)',letterSpacing:1 }}>VIDEO QUEUE ({videoQueue.length})</span>
                <button onClick={()=>controls.clearVideo()} style={{ color:'var(--danger)',fontSize:10,background:'none',border:'none' }}>CLEAR ALL</button>
              </div>
              {videoQueue.map((t,i)=>(
                <div key={t.id} onClick={()=>controls.playVideoAt(i)}
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 16px',cursor:'pointer',background:i===videoIndex?'rgba(124,58,237,0.12)':'transparent',borderLeft:i===videoIndex?'2px solid #818cf8':'2px solid transparent' }}>
                  <span style={{ fontSize:13,color:i===videoIndex?'#818cf8':'var(--muted)',flexShrink:0 }}>{i===videoIndex&&isPlaying?'▶':'🎬'}</span>
                  <span style={{ flex:1,fontSize:12,color:i===videoIndex?'#818cf8':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.displayName}</span>
                  <button onClick={e=>{e.stopPropagation();controls.removeVideo(i)}} style={{ color:'var(--dimmed)',fontSize:14,background:'none',border:'none' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Add more */}
          {!showQueue && (
            <div style={{ padding:'8px 14px',background:'var(--navy)',borderTop:'1px solid var(--navy-border)',display:'flex',gap:8,flexShrink:0 }}>
              {'showDirectoryPicker' in window&&<button onClick={handleFolder} style={{ flex:1,background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>📂 FOLDER</button>}
              <button onClick={handleFiles} style={{ flex:1,background:'rgba(124,58,237,0.2)',border:'1px solid #7c3aed',color:'#a78bfa',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>🎬 ADD VIDEOS</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
