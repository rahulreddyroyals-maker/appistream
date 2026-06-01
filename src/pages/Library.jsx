import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { addFolderToLibrary, pickFiles } from '../utils/folderScanner'
import { formatTime, formatSize, isVideoFile, buildTrackFromFile } from '../utils/helpers'
import { addFavorite, removeFavorite, isFavorite } from '../utils/db'
import AddToPlaylistSheet from '../components/AddToPlaylistSheet'
import LyricsSheet from '../components/LyricsSheet'

function TrackItem({ track, index, isActive, isPlaying, onPlay, onFav, isFav, onRemove, onPlaylist, onLyrics, color='var(--sky)' }) {
  return (
    <div onClick={onPlay} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 16px',cursor:'pointer',background:isActive?`${color}12`:'transparent',borderLeft:isActive?`2px solid ${color}`:'2px solid transparent',transition:'background 0.15s' }}>
      <div style={{ width:36,height:36,borderRadius:8,background:isActive?`${color}22`:'var(--navy-light)',border:`1px solid ${isActive?color+'44':'var(--navy-border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isActive?12:14,color:isActive?color:'var(--muted)',flexShrink:0 }}>
        {isActive&&isPlaying?<span style={{animation:'pulse 1s infinite'}}>▶</span>:<span style={{fontSize:11,fontFamily:'monospace'}}>{index+1}</span>}
      </div>
      <div style={{ flex:1,overflow:'hidden' }}>
        <div style={{ fontSize:13,fontWeight:isActive?600:400,color:isActive?color:'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{track.displayName}</div>
        <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:1,display:'flex',gap:5 }}>
          <span style={{ background:'var(--navy-border)',padding:'0 4px',borderRadius:3,letterSpacing:0.5 }}>{track.ext?.toUpperCase()}</span>
          <span>{formatSize(track.size)}</span>
        </div>
      </div>
      <button onClick={e=>{e.stopPropagation();onFav()}} style={{ color:isFav?'#ef4444':'var(--dimmed)',fontSize:24,background:'none',border:'none',padding:'0 3px',filter:isFav?'drop-shadow(0 0 8px #ef444499)':'none' }}>{isFav?'♥':'♡'}</button>
      {onPlaylist&&<button onClick={e=>{e.stopPropagation();onPlaylist()}} style={{ color:'var(--dimmed)',fontSize:16,background:'none',border:'none',padding:'0 3px' }} title="Add to playlist">➕</button>}
      {onLyrics&&track.type==='audio'&&<button onClick={e=>{e.stopPropagation();onLyrics()}} style={{ color:'var(--dimmed)',fontSize:16,background:'none',border:'none',padding:'0 3px' }} title="Lyrics">🎤</button>}
      <button onClick={e=>{e.stopPropagation();onRemove()}} style={{ color:'var(--dimmed)',fontSize:16,background:'none',border:'none',padding:'0 3px' }}>×</button>
    </div>
  )
}

export default function Library() {
  const { state, controls, notify } = usePlayer()
  const { audioQueue, audioIndex, audioPlaying, videoQueue, videoIndex, videoPlaying } = state
  const [tab, setTab] = useState('audio')
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)
  const [playlistTrack, setPlaylistTrack] = useState(null)
  const [lyricsTrack, setLyricsTrack] = useState(null)
  const navigate = useNavigate()

  const handleFolder = useCallback(async () => {
    setScanning(true)
    try {
      const tracks = await addFolderToLibrary()
      if(!tracks?.length) return
      const audio=tracks.filter(t=>t.type==='audio'), video=tracks.filter(t=>t.type==='video')
      if(audio.length) controls.addAudio(audio)
      if(video.length) controls.addVideo(video)
      notify(`Loaded ${tracks.length} files`)
    } catch { notify('Could not access folder','error') }
    finally { setScanning(false) }
  }, [])

  const handleFiles = useCallback(async () => {
    const files = await pickFiles()
    if(!files.length) return
    const audio=files.filter(f=>!isVideoFile(f.name)).map(buildTrackFromFile)
    const video=files.filter(f=>isVideoFile(f.name)).map(buildTrackFromFile)
    if(audio.length) controls.addAudio(audio)
    if(video.length) controls.addVideo(video)
    notify(`Added ${files.length} files`)
  }, [])

  const queue = tab==='audio' ? audioQueue : videoQueue
  const ci = tab==='audio' ? audioIndex : videoIndex
  const playing = tab==='audio' ? audioPlaying : videoPlaying
  const color = tab==='audio' ? 'var(--sky)' : '#818cf8'
  const filtered = queue.filter(t=>!search||t.displayName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight:'100%' }}>
      <div style={{ padding:'14px 16px 8px',position:'sticky',top:0,background:'var(--navy)',zIndex:10,borderBottom:'1px solid var(--navy-border)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8 }}>
          <h1 style={{ fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)' }}>LIBRARY</h1>
          <div style={{ display:'flex',gap:6 }}>
            {'showDirectoryPicker' in window&&<button onClick={handleFolder} style={{ background:'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',color:'var(--navy)',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4,boxShadow:'0 0 10px rgba(56,189,248,0.3)' }}>📂 FOLDER</button>}
            <button onClick={handleFiles} style={{ background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:600 }}>+ FILES</button>
          </div>
        </div>
        {/* Audio / Video tabs */}
        <div style={{ display:'flex',gap:0,background:'var(--navy-light)',borderRadius:10,padding:3,marginBottom:10 }}>
          {[['audio','🎵 MUSIC',audioQueue.length],['video','🎬 VIDEOS',videoQueue.length]].map(([t,label,count])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,background:tab===t?'var(--blue)':'transparent',border:'none',color:tab===t?'#fff':'var(--muted)',borderRadius:8,padding:'7px',fontSize:11,fontWeight:700,letterSpacing:0.5,display:'flex',alignItems:'center',justifyContent:'center',gap:5,boxShadow:tab===t?'0 0 12px rgba(37,99,235,0.4)':'none',transition:'all 0.2s' }}>
              {label} <span style={{ background:tab===t?'rgba(255,255,255,0.2)':'var(--navy-border)',borderRadius:10,padding:'1px 6px',fontSize:9 }}>{count}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`🔍  Search ${tab==='audio'?'music':'videos'}…`}
          style={{ width:'100%',background:'var(--navy-light)',border:'1px solid var(--navy-border)',borderRadius:8,padding:'8px 12px',color:'var(--white)',fontSize:12,outline:'none' }}/>
      </div>

      {filtered.length===0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 28px',gap:14,textAlign:'center' }}>
          <span style={{ fontSize:50,opacity:0.2 }}>{tab==='audio'?'🎵':'🎬'}</span>
          <div style={{ fontSize:14,color:'var(--muted)',letterSpacing:1,fontWeight:600 }}>NO {tab==='audio'?'MUSIC':'VIDEOS'} YET</div>
          <button onClick={handleFolder} style={{ background:tab==='audio'?'linear-gradient(135deg,var(--blue),var(--sky))':'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',color:'#fff',borderRadius:12,padding:'12px 24px',fontSize:13,fontWeight:700,letterSpacing:1,boxShadow:tab==='audio'?'0 0 20px rgba(56,189,248,0.4)':'0 0 20px rgba(124,58,237,0.4)',display:'flex',alignItems:'center',gap:8 }}>
            📂 OPEN FOLDER
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding:'6px 16px',fontSize:10,color:'var(--dimmed)',letterSpacing:0.5 }}>{filtered.length} {tab==='audio'?'TRACKS':'VIDEOS'}</div>
          {filtered.map((track,displayIdx) => {
            const realIdx = queue.findIndex(q=>q.id===track.id)
            return (
              <TrackItem key={track.id} track={track} index={realIdx} isActive={realIdx===ci} isPlaying={playing} color={color}
                onPlay={()=>{ if(tab==='audio'){controls.setMode('audio');controls.playAudioAt(realIdx);navigate('/')} else{controls.setMode('video');controls.playVideoAt(realIdx);navigate('/video')} }}
                onFav={async()=>{const f=await isFavorite(track.id);if(f){await removeFavorite(track.id);notify('Removed')}else{await addFavorite(track);notify('Added ♥')}}}
                isFav={false}
                onRemove={()=>tab==='audio'?controls.removeAudio(realIdx):controls.removeVideo(realIdx)}
                onPlaylist={()=>setPlaylistTrack(track)}
                onLyrics={track.type==='audio'?()=>setLyricsTrack(track):undefined}/>
            )
          })}
          <div style={{height:80}}/>
        </>
      )}

      {playlistTrack && <AddToPlaylistSheet track={playlistTrack} onClose={()=>setPlaylistTrack(null)} onNotify={notify}/>}
      {lyricsTrack && <LyricsSheet track={lyricsTrack} isPlaying={false} currentTime={0} duration={0} onClose={()=>setLyricsTrack(null)}/>}
    </div>
  )
}
