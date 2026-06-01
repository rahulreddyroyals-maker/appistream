import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { getPlaylists, savePlaylist } from '../utils/db'
import { formatSize } from '../utils/helpers'

export default function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, controls, notify, derived } = usePlayer()
  const { audioQueue } = state
  const { currentTrack, isPlaying } = derived
  const [playlist, setPlaylist] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPlaylists().then(pls => {
      const pl = pls.find(p => p.id === id)
      if (!pl) navigate('/playlists')
      else setPlaylist(pl)
    })
  }, [id])

  const tracks = playlist ? playlist.trackIds.map(tid => audioQueue.find(t => t.id === tid)).filter(Boolean) : []
  const available = audioQueue.filter(t => !playlist?.trackIds.includes(t.id))
    .filter(t => !search || t.displayName.toLowerCase().includes(search.toLowerCase()))

  const addTrack = async (track) => {
    const updated = { ...playlist, trackIds:[...playlist.trackIds, track.id], updatedAt:Date.now() }
    await savePlaylist(updated); setPlaylist(updated); notify(`Added "${track.displayName}"`)
  }
  const removeTrack = async (trackId) => {
    const updated = { ...playlist, trackIds:playlist.trackIds.filter(i=>i!==trackId), updatedAt:Date.now() }
    await savePlaylist(updated); setPlaylist(updated); notify('Removed from playlist')
  }
  const playAll = () => {
    if (!tracks.length) { notify('No tracks loaded in library from this playlist','warning'); return }
    controls.clearAudio(); controls.addAudio(tracks); navigate('/')
  }

  if (!playlist) return <div style={{ padding:32,color:'var(--muted)',textAlign:'center' }}>Loading…</div>

  return (
    <div style={{ minHeight:'100%',background:'var(--navy)' }}>
      <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--navy-border)' }}>
        <button onClick={()=>navigate('/playlists')} style={{ color:'var(--muted)',fontSize:12,marginBottom:8,background:'none',border:'none',display:'flex',alignItems:'center',gap:4 }}>← Back</button>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ width:54,height:54,borderRadius:12,background:'linear-gradient(135deg,var(--blue-dim),var(--sky-dim))',border:'1px solid var(--navy-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0 }}>📋</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16,fontWeight:700,color:'var(--sky)' }}>{playlist.name}</div>
            <div style={{ fontSize:11,color:'var(--dimmed)',marginTop:2 }}>{tracks.length} tracks in library</div>
          </div>
          <div style={{ display:'flex',gap:6 }}>
            <button onClick={playAll} style={{ background:'var(--blue)',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700 }}>▶ PLAY</button>
            <button onClick={()=>setShowAdd(a=>!a)} style={{ background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'8px 12px',fontSize:12 }}>+ ADD</button>
          </div>
        </div>
      </div>

      {showAdd && (
        <div style={{ background:'var(--navy-light)',borderBottom:'1px solid var(--navy-border)' }}>
          <div style={{ padding:'10px 16px',borderBottom:'1px solid var(--navy-border)',display:'flex',alignItems:'center',gap:8 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search library…"
              style={{ flex:1,background:'var(--navy)',border:'1px solid var(--navy-border)',borderRadius:8,padding:'7px 12px',color:'var(--white)',fontSize:12,outline:'none' }}/>
            <button onClick={()=>setShowAdd(false)} style={{ color:'var(--muted)',background:'none',border:'none',fontSize:18 }}>✕</button>
          </div>
          <div style={{ maxHeight:200,overflowY:'auto' }}>
            {available.length===0
              ? <div style={{ padding:'16px',color:'var(--dimmed)',fontSize:12,textAlign:'center' }}>No tracks to add</div>
              : available.map(t=>(
                <div key={t.id} onClick={()=>addTrack(t)}
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 16px',cursor:'pointer',borderBottom:'1px solid rgba(42,58,82,0.4)' }}>
                  <span style={{ fontSize:16 }}>🎵</span>
                  <span style={{ flex:1,fontSize:12,color:'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.displayName}</span>
                  <span style={{ color:'var(--sky)',fontSize:18 }}>+</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tracks.length===0
        ? <div style={{ padding:'40px 32px',textAlign:'center',color:'var(--dimmed)',fontSize:12 }}>No tracks from this playlist are in your library — tap + ADD</div>
        : tracks.map((track,i)=>{
          const isActive = currentTrack?.id === track.id
          return (
            <div key={track.id} onClick={()=>{controls.clearAudio();controls.addAudio(tracks);setTimeout(()=>controls.playAudioAt(i),80);navigate('/')}}
              style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 16px',cursor:'pointer',background:isActive?'rgba(56,189,248,0.08)':'transparent',borderLeft:isActive?'2px solid var(--sky)':'2px solid transparent',borderBottom:'1px solid rgba(42,58,82,0.3)' }}>
              <div style={{ width:34,height:34,borderRadius:7,background:isActive?'rgba(56,189,248,0.2)':'var(--navy-light)',border:`1px solid ${isActive?'rgba(56,189,248,0.4)':'var(--navy-border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:isActive?'var(--sky)':'var(--muted)',flexShrink:0 }}>
                {isActive&&isPlaying?<span style={{animation:'pulse 1s infinite'}}>▶</span>:<span style={{fontFamily:'monospace'}}>{i+1}</span>}
              </div>
              <div style={{ flex:1,overflow:'hidden' }}>
                <div style={{ fontSize:12,fontWeight:isActive?600:400,color:isActive?'var(--sky)':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{track.displayName}</div>
                <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:1 }}>{formatSize(track.size)}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();removeTrack(track.id)}}
                style={{ color:'var(--danger)',fontSize:13,background:'none',border:'none',padding:4 }}>✕</button>
            </div>
          )
        })
      }
    </div>
  )
}
