import { useCallback, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { addFolderToLibrary, addIndividualFiles, regrantAndRestore, pickFiles } from '../utils/folderScanner'
import { isVideoFile, buildTrackFromFile } from '../utils/helpers'
import SeekBar from '../components/SeekBar'
import AddToPlaylistSheet from '../components/AddToPlaylistSheet'
import logo from '../assets/logo.png'

function ScanOverlay({ count, last }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(8,14,26,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,zIndex:9999 }}>
      <img src={logo} style={{ width:80,height:80,objectFit:'contain',borderRadius:14,filter:'drop-shadow(0 0 20px rgba(124,58,237,0.5))' }}/>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13,fontWeight:700,color:'#a78bfa',letterSpacing:3,marginBottom:8 }}>SCANNING…</div>
        <div style={{ fontSize:26,fontWeight:700,color:'#fff',marginBottom:4 }}>{count} <span style={{ fontSize:12,color:'#94a3b8',fontWeight:400 }}>files found</span></div>
        {last&&<div style={{ fontSize:10,color:'#475569',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{last}</div>}
      </div>
    {showPlaylist && currentTrack && (
      <AddToPlaylistSheet track={currentTrack} onClose={()=>setShowPlaylist(false)} onNotify={notify}/>
    )}
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
      <div style={{ fontSize:12,color:'#94a3b8',marginBottom:28,lineHeight:1.8,maxWidth:260 }}>Open a folder containing videos — AppiStream scans all subfolders automatically.</div>
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
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanLast, setScanLast] = useState('')
  const progress = duration ? currentTime/duration : 0
  const loopIcons = { none:'↩', one:'🔂', all:'🔁' }
  const nextLoop = { none:'one', one:'all', all:'none' }

  const doScan = useCallback(async (scanFn) => {
    setScanning(true); setScanCount(0); setScanLast('')
    try {
      const tracks = await scanFn((c,n)=>{ setScanCount(c); setScanLast(n) })
      if (!tracks?.length) { notify('No media files found','warning'); return }
      const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
      // MERGE — never clears audio while adding video, deduplicates
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
          {currentTrack&&<button onClick={()=>setShowPlaylist(true)} style={{ color:'var(--muted)',fontSize:13,padding:4,background:'none',border:'none' }} title="Add to Playlist">➕</button>}
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
          {/* Track name */}
          <div style={{ background:'rgba(0,0,0,0.8)',padding:'6px 14px',flexShrink:0 }}>
            <div style={{ fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{currentTrack.displayName}</div>
            <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1 }}>{(videoIndex??0)+1} of {videoQueue.length} · {currentTrack.ext?.toUpperCase()}</div>
          </div>

          {/* Controls */}
          <div style={{ background:'var(--navy)',padding:'10px 16px',flexShrink:0 }}>
            <SeekBar currentTime={currentTime} duration={duration} onSeek={controls.seek} color="#818cf8"/>

            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:12 }}>
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

            {/* Volume */}
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <button onClick={()=>controls.toggleMute()} style={{ color:'var(--muted)',fontSize:16,background:'none',border:'none' }}>{isMuted?'🔇':volume<0.4?'🔈':'🔊'}</button>
              <input type="range" min={0} max={1} step={0.01} value={isMuted?0:volume}
                onChange={e=>controls.setVolume(parseFloat(e.target.value))}
                style={{ flex:1,background:`linear-gradient(to right,#7c3aed ${(isMuted?0:volume)*100}%,var(--dimmed) ${(isMuted?0:volume)*100}%)` }}/>
              <span style={{ fontSize:11,color:'var(--muted)',fontFamily:'monospace',minWidth:26 }}>{Math.round((isMuted?0:volume)*100)}</span>
            </div>
          </div>

          {/* Queue */}
          {showQueue && (
            <div style={{ background:'var(--navy-light)',flex:1,overflowY:'auto' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px',borderBottom:'1px solid var(--navy-border)',position:'sticky',top:0,background:'var(--navy-light)' }}>
                <span style={{ fontSize:11,color:'var(--muted)',letterSpacing:1 }}>VIDEOS ({videoQueue.length})</span>
                <button onClick={controls.clearVideo} style={{ color:'var(--danger)',fontSize:10,background:'none',border:'none' }}>CLEAR ALL</button>
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
