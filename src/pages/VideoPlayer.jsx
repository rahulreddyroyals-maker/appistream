import { useCallback, useState, useRef, useEffect } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { addFolderToLibrary, addIndividualFiles, regrantAndRestore, pickFiles } from '../utils/folderScanner'
import { isVideoFile, formatTime, formatSize } from '../utils/helpers'
import logo from '../assets/logo.png'

// ── Scan overlay ──────────────────────────────────────────────────────────────
function ScanOverlay({ count, last }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,zIndex:9999 }}>
      <img src={logo} style={{ width:72,height:72,objectFit:'contain',borderRadius:14,filter:'drop-shadow(0 0 16px rgba(124,58,237,0.6))' }}/>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:12,fontWeight:700,color:'#a78bfa',letterSpacing:3,marginBottom:8 }}>SCANNING…</div>
        <div style={{ fontSize:28,fontWeight:700,color:'#fff',marginBottom:4 }}>{count} <span style={{ fontSize:12,color:'#94a3b8',fontWeight:400 }}>found</span></div>
        {last&&<div style={{ fontSize:10,color:'#475569',maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{last}</div>}
      </div>
      <div style={{ display:'flex',gap:4 }}>
        {[0,1,2,3,4].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'#a78bfa',opacity:0.2,animation:`pulse 1.2s ease-in-out ${i*0.15}s infinite` }}/>)}
      </div>
    </div>
  )
}

// ── Empty / Permission screen ─────────────────────────────────────────────────
function EmptyScreen({ onFolder, onFiles, onRestore, needsPermission, totalSaved }) {
  const hasFSA = 'showDirectoryPicker' in window
  if (needsPermission && totalSaved > 0) return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px',textAlign:'center',background:'#000' }}>
      <div style={{ fontSize:56,marginBottom:16,filter:'drop-shadow(0 0 24px rgba(124,58,237,0.5))' }}>🎬</div>
      <div style={{ fontSize:17,fontWeight:700,color:'#fff',marginBottom:8 }}>Videos Ready</div>
      <div style={{ fontSize:12,color:'#94a3b8',marginBottom:28,lineHeight:1.8,maxWidth:260 }}>{totalSaved} saved videos — tap to restore access.</div>
      <button onClick={onRestore} style={{ width:'100%',maxWidth:260,background:'linear-gradient(135deg,#4f46e5,#7c3aed)',border:'none',color:'#fff',borderRadius:14,padding:'14px',fontSize:14,fontWeight:700,marginBottom:10,boxShadow:'0 0 24px rgba(124,58,237,0.5)',cursor:'pointer',fontFamily:'inherit' }}>
        🔓 RESTORE VIDEOS
      </button>
      <button onClick={onFolder} style={{ background:'none',border:'1px solid #374151',color:'#9ca3af',borderRadius:10,padding:'10px 20px',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>📂 Open Different Folder</button>
    </div>
  )
  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px',textAlign:'center',background:'#000' }}>
      <div style={{ fontSize:64,marginBottom:20,filter:'drop-shadow(0 0 28px rgba(124,58,237,0.4))' }}>🎬</div>
      <div style={{ fontSize:18,fontWeight:700,color:'#fff',marginBottom:8 }}>No Videos</div>
      <div style={{ fontSize:12,color:'#6b7280',marginBottom:32,lineHeight:1.8,maxWidth:260 }}>Open your Videos folder — AppiStream finds everything automatically.</div>
      {hasFSA&&(
        <button onClick={onFolder} style={{ width:'100%',maxWidth:280,background:'linear-gradient(135deg,#4f46e5,#7c3aed)',border:'none',color:'#fff',borderRadius:14,padding:'15px',fontSize:14,fontWeight:700,marginBottom:12,boxShadow:'0 0 28px rgba(124,58,237,0.5)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}>
          <span style={{fontSize:20}}>📂</span> OPEN VIDEO FOLDER
        </button>
      )}
      <button onClick={onFiles} style={{ width:'100%',maxWidth:280,background:'rgba(124,58,237,0.15)',border:'1px solid #7c3aed',color:'#a78bfa',borderRadius:14,padding:'12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        <span style={{fontSize:18}}>🎞</span> SELECT VIDEO FILES
      </button>
      <div style={{ marginTop:14,fontSize:10,color:'#374151' }}>MP4 · WebM · MOV · MKV · AVI · M4V</div>
    </div>
  )
}

// ── Main VideoPlayer ──────────────────────────────────────────────────────────
export default function VideoPlayer() {
  const { state, controls, notify, dispatch, videoRef } = usePlayer()
  const {
    videoQueue, videoIndex,
    videoPlaying: isPlaying,
    videoTime: currentTime,
    videoDuration: duration,
    volume, isMuted, loop, shuffle,
    needsPermission, totalSaved
  } = state

  const currentTrack = videoIndex != null ? videoQueue[videoIndex] : null
  const progress = duration ? currentTime / duration : 0

  const [showQueue, setShowQueue] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanLast, setScanLast] = useState('')
  const [isFS, setIsFS] = useState(false)
  const [showCtrl, setShowCtrl] = useState(true)
  const containerRef = useRef(null)
  const ctrlTimer = useRef(null)

  const loopIcons = { none:'↩', one:'🔂', all:'🔁' }
  const nextLoop  = { none:'one', one:'all', all:'none' }

  // ── Fullscreen handling ────────────────────────────────────────────────────
  useEffect(() => {
    const onFS = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFS(fs)
      setShowCtrl(true)
      if (fs) startHideTimer()
    }
    document.addEventListener('fullscreenchange', onFS)
    document.addEventListener('webkitfullscreenchange', onFS)
    return () => {
      document.removeEventListener('fullscreenchange', onFS)
      document.removeEventListener('webkitfullscreenchange', onFS)
      clearTimeout(ctrlTimer.current)
    }
  }, [])

  const startHideTimer = () => {
    clearTimeout(ctrlTimer.current)
    ctrlTimer.current = setTimeout(() => setShowCtrl(false), 3500)
  }

  const handleVideoTap = () => {
    setShowCtrl(true)
    if (isFS) startHideTimer()
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

  // ── File loading ───────────────────────────────────────────────────────────
  const doScan = useCallback(async (fn) => {
    setScanning(true); setScanCount(0); setScanLast('')
    try {
      const tracks = await fn((c,n) => { setScanCount(c); setScanLast(n) })
      if (!tracks?.length) { notify('No media files found', 'warning'); return }
      const audio = tracks.filter(t=>t.type==='audio')
      const video = tracks.filter(t=>t.type==='video')
      if (audio.length) controls.addAudio(audio)
      if (video.length) controls.addVideo(video)
      dispatch({ type:'SET', payload:{ needsPermission:false, hasSavedFiles:true }})
      notify(`Added ${video.length} video${video.length!==1?'s':''}${audio.length?` + ${audio.length} songs`:''}`)
    } catch { notify('Could not access folder', 'error') }
    finally { setScanning(false) }
  }, [])

  const handleFolder  = useCallback(() => doScan(addFolderToLibrary), [doScan])
  const handleRestore = useCallback(() => doScan(regrantAndRestore),  [doScan])
  const handleFiles   = useCallback(async () => {
    const files = await pickFiles()
    const vids = files.filter(f => isVideoFile(f.name))
    if (!vids.length) { notify('No video files selected', 'warning'); return }
    const tracks = await addIndividualFiles(vids)
    controls.addVideo(tracks.filter(t => t.type === 'video'))
    notify(`Added ${tracks.length} video${tracks.length!==1?'s':''}`)
  }, [])

  // ── Seek bar ───────────────────────────────────────────────────────────────
  const seekBarRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragPct, setDragPct] = useState(0)

  const pctFromEvt = (e) => {
    const bar = seekBarRef.current
    if (!bar) return 0
    const { left, width } = bar.getBoundingClientRect()
    const x = e.touches ? e.touches[0].clientX : e.clientX
    return Math.min(1, Math.max(0, (x - left) / width))
  }
  const onSeekStart = (e) => { e.preventDefault(); setDragging(true); setDragPct(pctFromEvt(e)) }
  const onSeekMove  = useCallback((e) => { if (!dragging) return; e.preventDefault(); setDragPct(pctFromEvt(e)) }, [dragging])
  const onSeekEnd   = useCallback((e) => {
    if (!dragging) return
    const pct = pctFromEvt(e.changedTouches ? { clientX: e.changedTouches[0].clientX } : e)
    setDragging(false)
    controls.seek(pct * (duration || 0))
  }, [dragging, duration])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('mousemove', onSeekMove)
    window.addEventListener('mouseup', onSeekEnd)
    window.addEventListener('touchmove', onSeekMove, { passive:false })
    window.addEventListener('touchend', onSeekEnd)
    return () => {
      window.removeEventListener('mousemove', onSeekMove)
      window.removeEventListener('mouseup', onSeekEnd)
      window.removeEventListener('touchmove', onSeekMove)
      window.removeEventListener('touchend', onSeekEnd)
    }
  }, [dragging, onSeekMove, onSeekEnd])

  const displayPct = dragging ? dragPct : progress
  const displayTime = dragging ? dragPct * (duration || 0) : currentTime

  if (scanning) return <ScanOverlay count={scanCount} last={scanLast}/>

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!currentTrack) return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'#0a0a1a',flexShrink:0,borderBottom:'1px solid #1a1a2e' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <img src={logo} style={{ width:26,height:26,objectFit:'contain',borderRadius:6 }}/>
          <span style={{ fontSize:14,fontWeight:700,letterSpacing:2,color:'#a78bfa' }}>VIDEOS</span>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {'showDirectoryPicker' in window&&<button onClick={handleFolder} style={{ color:'#6b7280',fontSize:13,padding:'4px 8px',background:'rgba(124,58,237,0.1)',border:'1px solid #4c1d95',borderRadius:6 }}>📂 Folder</button>}
          <button onClick={handleFiles} style={{ color:'#a78bfa',fontSize:13,padding:'4px 8px',background:'rgba(124,58,237,0.15)',border:'1px solid #7c3aed',borderRadius:6 }}>+ File</button>
        </div>
      </div>
      <EmptyScreen onFolder={handleFolder} onFiles={handleFiles} onRestore={handleRestore} needsPermission={needsPermission} totalSaved={totalSaved}/>
    </div>
  )

  // ── Main player layout ─────────────────────────────────────────────────────
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#000', overflow:'hidden' }}>

      {/* ── VIDEO AREA ── */}
      <div
        ref={containerRef}
        onClick={handleVideoTap}
        style={{
          position: isFS ? 'fixed' : 'relative',
          inset: isFS ? 0 : 'auto',
          zIndex: isFS ? 9999 : 'auto',
          background: '#000',
          flexShrink: 0,
          width: '100%',
          // Normal mode: 16:9 ratio
          aspectRatio: isFS ? 'auto' : '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isFS ? '100vh' : 'auto',
        }}>

        {/* Fullscreen overlay controls */}
        {isFS && showCtrl && (
          <div style={{
            position:'absolute', inset:0, zIndex:1,
            background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 40%,rgba(0,0,0,0.4) 100%)',
            display:'flex', flexDirection:'column', justifyContent:'space-between', padding:16,
          }}>
            {/* FS Top bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#fff', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:12 }}>
                {currentTrack.displayName}
              </div>
              <button onClick={e=>{e.stopPropagation();exitFS()}}
                style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer',backdropFilter:'blur(4px)' }}>
                ✕ Exit
              </button>
            </div>

            {/* FS Bottom controls */}
            <div>
              {/* FS Seek */}
              <div ref={seekBarRef} style={{ position:'relative',height:32,display:'flex',alignItems:'center',cursor:'pointer',touchAction:'none',marginBottom:8 }}
                onMouseDown={onSeekStart} onTouchStart={e=>{e.preventDefault();onSeekStart(e)}}>
                <div style={{ position:'absolute',left:0,right:0,height:3,borderRadius:2,background:'rgba(255,255,255,0.2)' }}>
                  <div style={{ height:'100%',width:`${displayPct*100}%`,borderRadius:2,background:'linear-gradient(to right,#7c3aed,#a78bfa)',boxShadow:'0 0 8px #a78bfa' }}/>
                </div>
                <div style={{ position:'absolute',left:`${displayPct*100}%`,transform:'translateX(-50%)',width:14,height:14,borderRadius:'50%',background:'#fff',border:'2px solid #a78bfa',boxShadow:'0 0 8px #a78bfa',zIndex:2 }}/>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.6)',fontFamily:'monospace',marginBottom:12 }}>
                <span>{formatTime(displayTime)}</span><span>{formatTime(duration)}</span>
              </div>

              {/* FS Controls */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:20 }}>
                <button onClick={e=>{e.stopPropagation();controls.seekBy(-10)}} style={{ color:'rgba(255,255,255,0.85)',background:'none',border:'none',fontSize:22,cursor:'pointer' }}>⏪</button>
                <button onClick={e=>{e.stopPropagation();controls.prev('video')}} style={{ color:'rgba(255,255,255,0.85)',background:'none',border:'none',fontSize:22,cursor:'pointer' }}>⏮</button>
                <button onClick={e=>{e.stopPropagation();controls.toggle()}}
                  style={{ width:58,height:58,borderRadius:'50%',background:'linear-gradient(135deg,#4f46e5,#7c3aed)',border:'2px solid #a78bfa',color:'#fff',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 0 24px rgba(124,58,237,0.7)' }}>
                  {isPlaying?'⏸':'▶'}
                </button>
                <button onClick={e=>{e.stopPropagation();controls.next('video')}} style={{ color:'rgba(255,255,255,0.85)',background:'none',border:'none',fontSize:22,cursor:'pointer' }}>⏭</button>
                <button onClick={e=>{e.stopPropagation();controls.seekBy(10)}} style={{ color:'rgba(255,255,255,0.85)',background:'none',border:'none',fontSize:22,cursor:'pointer' }}>⏩</button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen buttons (top-right, always visible in normal mode) */}
        {!isFS && (
          <div style={{ position:'absolute',top:8,right:8,display:'flex',gap:6,zIndex:2 }}>
            <button onClick={e=>{e.stopPropagation();enterFS('portrait')}}
              title="Portrait fullscreen (9:16)"
              style={{ background:'rgba(0,0,0,0.65)',border:'1px solid rgba(167,139,250,0.4)',color:'#a78bfa',borderRadius:8,padding:'5px 8px',cursor:'pointer',backdropFilter:'blur(4px)',display:'flex',flexDirection:'column',alignItems:'center',gap:1 }}>
              <span style={{fontSize:13}}>⛶</span><span style={{fontSize:7,letterSpacing:0.5}}>9:16</span>
            </button>
            <button onClick={e=>{e.stopPropagation();enterFS('landscape')}}
              title="Landscape fullscreen (16:9)"
              style={{ background:'rgba(0,0,0,0.65)',border:'1px solid rgba(167,139,250,0.4)',color:'#a78bfa',borderRadius:8,padding:'5px 10px',fontSize:15,cursor:'pointer',backdropFilter:'blur(4px)' }}>
              ⛶
            </button>
          </div>
        )}
      </div>

      {/* ── CONTROLS PANEL ── */}
      <div style={{ background:'#050510', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Track info bar */}
        <div style={{ padding:'10px 16px 8px', background:'linear-gradient(to bottom,#0a0a1a,#050510)', borderBottom:'1px solid rgba(124,58,237,0.15)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ fontSize:14,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2 }}>
                {currentTrack.displayName}
              </div>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                <span style={{ fontSize:9,fontWeight:700,color:'#a78bfa',background:'rgba(124,58,237,0.2)',border:'1px solid rgba(124,58,237,0.3)',borderRadius:4,padding:'1px 6px',letterSpacing:1 }}>
                  {currentTrack.ext?.toUpperCase()}
                </span>
                <span style={{ fontSize:10,color:'#4b5563',fontFamily:'monospace' }}>
                  {(videoIndex??0)+1} / {videoQueue.length}
                </span>
                {currentTrack.size>0&&<span style={{ fontSize:10,color:'#4b5563' }}>{formatSize(currentTrack.size)}</span>}
              </div>
            </div>
            {/* Header actions */}
            <div style={{ display:'flex',gap:6,marginLeft:12,flexShrink:0 }}>
              <button onClick={()=>setShowQueue(q=>!q)}
                style={{ background:showQueue?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.06)',border:`1px solid ${showQueue?'rgba(124,58,237,0.5)':'rgba(255,255,255,0.1)'}`,color:showQueue?'#a78bfa':'#6b7280',borderRadius:8,padding:'5px 10px',fontSize:11,cursor:'pointer' }}>
                📋 {videoQueue.length}
              </button>
              {'showDirectoryPicker' in window&&(
                <button onClick={handleFolder}
                  style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#6b7280',borderRadius:8,padding:'5px 8px',fontSize:11,cursor:'pointer' }}>
                  📂
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── SEEK BAR ── */}
        <div style={{ padding:'10px 16px 4px' }}>
          <div ref={seekBarRef} style={{ position:'relative',height:28,display:'flex',alignItems:'center',cursor:'pointer',touchAction:'none' }}
            onMouseDown={onSeekStart}
            onTouchStart={e=>{e.preventDefault();onSeekStart(e)}}>
            {/* Track */}
            <div style={{ position:'absolute',left:0,right:0,height:dragging?5:3,borderRadius:3,background:'rgba(255,255,255,0.1)',transition:'height 0.15s' }}>
              {/* Fill */}
              <div style={{ height:'100%',width:`${displayPct*100}%`,borderRadius:3,background:'linear-gradient(to right,#4f46e5,#a78bfa)',boxShadow:dragging?'0 0 12px #a78bfa':'0 0 4px rgba(167,139,250,0.5)',transition:dragging?'none':'width 0.1s linear' }}/>
            </div>
            {/* Thumb */}
            <div style={{ position:'absolute',left:`${displayPct*100}%`,transform:'translateX(-50%)',width:dragging?18:14,height:dragging?18:14,borderRadius:'50%',background:'#fff',border:`3px solid #a78bfa`,boxShadow:dragging?'0 0 0 6px rgba(167,139,250,0.2),0 0 16px #a78bfa':'0 0 8px rgba(167,139,250,0.6)',transition:dragging?'none':'width 0.15s,height 0.15s',zIndex:2 }}/>
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'#4b5563',fontFamily:'monospace',marginTop:2 }}>
            <span style={{color:'#a78bfa'}}>{formatTime(displayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* ── MAIN CONTROLS ── */}
        <div style={{ padding:'4px 16px 8px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:16 }}>
            {/* Shuffle */}
            <button onClick={()=>controls.toggleShuffle()}
              style={{ color:shuffle?'#a78bfa':'#374151',background:'none',border:'none',fontSize:18,cursor:'pointer',filter:shuffle?'drop-shadow(0 0 6px #a78bfa)':'none' }}>⇄</button>

            {/* Seek back */}
            <button onClick={()=>controls.seekBy(-10)}
              style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none',cursor:'pointer' }}>
              <span style={{fontSize:19,color:'#9ca3af'}}>⏪</span>
              <span style={{fontSize:7,color:'#4b5563',letterSpacing:0.3}}>10s</span>
            </button>

            {/* Prev */}
            <button onClick={()=>controls.prev('video')}
              style={{ width:42,height:42,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>⏮</button>

            {/* Play/Pause */}
            <button onClick={()=>controls.toggle()}
              style={{ width:64,height:64,borderRadius:'50%',background:isPlaying?'linear-gradient(135deg,#4f46e5,#7c3aed)':'linear-gradient(135deg,#1e1b4b,#4f46e5)',border:`2px solid ${isPlaying?'#a78bfa':'#4f46e5'}`,color:'#fff',fontSize:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:isPlaying?'0 0 32px rgba(124,58,237,0.8),0 0 64px rgba(124,58,237,0.2)':'0 0 12px rgba(79,70,229,0.4)',transition:'all 0.3s',transform:isPlaying?'scale(1.05)':'scale(1)' }}>
              {isPlaying?'⏸':'▶'}
            </button>

            {/* Next */}
            <button onClick={()=>controls.next('video')}
              style={{ width:42,height:42,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>⏭</button>

            {/* Seek forward */}
            <button onClick={()=>controls.seekBy(10)}
              style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:1,background:'none',border:'none',cursor:'pointer' }}>
              <span style={{fontSize:19,color:'#9ca3af'}}>⏩</span>
              <span style={{fontSize:7,color:'#4b5563',letterSpacing:0.3}}>10s</span>
            </button>

            {/* Loop */}
            <button onClick={()=>controls.setLoop(nextLoop[loop])}
              style={{ color:loop!=='none'?'#a78bfa':'#374151',background:'none',border:'none',fontSize:18,cursor:'pointer',filter:loop!=='none'?'drop-shadow(0 0 6px #a78bfa)':'none' }}>
              {loopIcons[loop]}
            </button>
          </div>
        </div>

        {/* ── VOLUME + FULLSCREEN ── */}
        <div style={{ padding:'0 16px 10px',display:'flex',alignItems:'center',gap:10 }}>
          <button onClick={()=>controls.toggleMute()}
            style={{ color:'#6b7280',fontSize:17,background:'none',border:'none',cursor:'pointer',flexShrink:0 }}>
            {isMuted||volume===0?'🔇':volume<0.4?'🔈':'🔊'}
          </button>
          <div style={{ flex:1,position:'relative',height:28,display:'flex',alignItems:'center' }}>
            <div style={{ position:'absolute',left:0,right:0,height:3,borderRadius:2,background:'rgba(255,255,255,0.08)' }}>
              <div style={{ height:'100%',width:`${(isMuted?0:volume)*100}%`,borderRadius:2,background:'linear-gradient(to right,#4f46e5,#a78bfa)' }}/>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={isMuted?0:volume}
              onChange={e=>controls.setVolume(parseFloat(e.target.value))}
              style={{ position:'absolute',left:0,right:0,opacity:0,cursor:'pointer',height:'100%',width:'100%' }}/>
          </div>
          <span style={{ fontSize:10,color:'#4b5563',fontFamily:'monospace',minWidth:24,textAlign:'right' }}>{Math.round((isMuted?0:volume)*100)}</span>

          {/* Fullscreen buttons */}
          <button onClick={()=>enterFS('portrait')}
            title="9:16 Portrait"
            style={{ background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.3)',color:'#a78bfa',borderRadius:8,padding:'5px 7px',fontSize:12,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:0.5,lineHeight:1,flexShrink:0 }}>
            <span style={{fontSize:11}}>⛶</span>
            <span style={{fontSize:7}}>9:16</span>
          </button>
          <button onClick={()=>enterFS('landscape')}
            title="16:9 Landscape"
            style={{ background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.3)',color:'#a78bfa',borderRadius:8,padding:'5px 10px',fontSize:14,cursor:'pointer',flexShrink:0 }}>
            ⛶
          </button>
        </div>

        {/* ── VIDEO QUEUE ── */}
        {showQueue && (
          <div style={{ flex:1,overflowY:'auto',borderTop:'1px solid rgba(124,58,237,0.15)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px',position:'sticky',top:0,background:'#050510',borderBottom:'1px solid rgba(124,58,237,0.1)' }}>
              <span style={{ fontSize:10,color:'#6b7280',letterSpacing:1,fontWeight:600 }}>VIDEO QUEUE ({videoQueue.length})</span>
              <button onClick={()=>controls.clearVideo()} style={{ color:'#ef4444',fontSize:10,background:'none',border:'none',letterSpacing:0.5 }}>CLEAR ALL</button>
            </div>
            {videoQueue.map((t,i) => (
              <div key={t.id} onClick={()=>controls.playVideoAt(i)}
                style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 16px',cursor:'pointer',background:i===videoIndex?'rgba(124,58,237,0.12)':'transparent',borderLeft:i===videoIndex?'2px solid #a78bfa':'2px solid transparent',transition:'background 0.15s' }}>
                <div style={{ width:32,height:32,borderRadius:7,background:i===videoIndex?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.05)',border:`1px solid ${i===videoIndex?'rgba(167,139,250,0.4)':'rgba(255,255,255,0.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:i===videoIndex&&isPlaying?10:13,color:i===videoIndex?'#a78bfa':'#6b7280',flexShrink:0,fontFamily:'monospace' }}>
                  {i===videoIndex&&isPlaying?'▶':i+1}
                </div>
                <div style={{ flex:1,overflow:'hidden' }}>
                  <div style={{ fontSize:12,fontWeight:i===videoIndex?600:400,color:i===videoIndex?'#a78bfa':'#d1d5db',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.displayName}</div>
                  <div style={{ fontSize:9,color:'#374151',marginTop:1 }}>{t.ext?.toUpperCase()}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();controls.removeVideo(i)}}
                  style={{ color:'#374151',fontSize:14,background:'none',border:'none',padding:'0 4px' }}>×</button>
              </div>
            ))}
            <div style={{ height:8 }}/>
          </div>
        )}

        {/* ── ADD MORE ── */}
        {!showQueue && (
          <div style={{ padding:'0 16px 10px',display:'flex',gap:8,marginTop:'auto',flexShrink:0 }}>
            {'showDirectoryPicker' in window&&(
              <button onClick={handleFolder}
                style={{ flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#6b7280',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5,cursor:'pointer' }}>
                📂 ADD FOLDER
              </button>
            )}
            <button onClick={handleFiles}
              style={{ flex:1,background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.4)',color:'#a78bfa',borderRadius:8,padding:'8px',fontSize:11,fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:5,cursor:'pointer' }}>
              🎬 ADD VIDEOS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
