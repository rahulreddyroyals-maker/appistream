import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { getPlaylists, savePlaylist, deletePlaylist } from '../utils/db'
import { generateId } from '../utils/helpers'

export default function Playlists() {
  const { state, controls, notify } = usePlayer()
  const { audioQueue } = state
  const [playlists, setPlaylists] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const navigate = useNavigate()

  useEffect(() => { getPlaylists().then(setPlaylists) }, [])

  const create = async () => {
    if (!newName.trim()) return
    const pl = { id:generateId(), name:newName.trim(), trackIds:[], createdAt:Date.now(), updatedAt:Date.now() }
    await savePlaylist(pl)
    setPlaylists(p => [...p, pl])
    setNewName(''); setShowCreate(false)
    notify(`Playlist "${pl.name}" created`)
  }

  const remove = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    await deletePlaylist(id)
    setPlaylists(p => p.filter(x => x.id !== id))
    notify('Playlist deleted')
  }

  const playAll = (pl) => {
    const tracks = pl.trackIds.map(id => audioQueue.find(t => t.id === id)).filter(Boolean)
    if (!tracks.length) { notify('No tracks from this playlist are in your library', 'warning'); return }
    controls.clearAudio()
    controls.addAudio(tracks)
    navigate('/')
  }

  return (
    <div style={{ minHeight:'100%',background:'var(--navy)' }}>
      <div style={{ padding:'14px 16px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--navy-border)' }}>
        <h1 style={{ fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)' }}>PLAYLISTS</h1>
        <button onClick={()=>setShowCreate(true)}
          style={{ background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'6px 14px',fontSize:11,fontWeight:600,letterSpacing:1 }}>+ NEW</button>
      </div>

      {showCreate && (
        <div style={{ padding:'12px 16px',background:'var(--navy-light)',borderBottom:'1px solid var(--navy-border)',display:'flex',gap:8 }}>
          <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&create()}
            placeholder="Playlist name…"
            style={{ flex:1,background:'var(--navy)',border:'1px solid var(--navy-border)',borderRadius:8,padding:'8px 12px',color:'var(--white)',fontSize:13,outline:'none' }}/>
          <button onClick={create} style={{ background:'var(--blue)',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700 }}>CREATE</button>
          <button onClick={()=>setShowCreate(false)} style={{ background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'8px 12px',fontSize:12 }}>✕</button>
        </div>
      )}

      {playlists.length === 0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 32px',gap:12,textAlign:'center' }}>
          <span style={{ fontSize:48,opacity:0.2 }}>📋</span>
          <div style={{ fontSize:14,color:'var(--muted)',letterSpacing:1,fontWeight:600 }}>NO PLAYLISTS YET</div>
          <div style={{ fontSize:12,color:'var(--dimmed)' }}>Create playlists to organize your music</div>
          <button onClick={()=>setShowCreate(true)}
            style={{ background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:10,padding:'10px 24px',fontSize:12,letterSpacing:1,fontWeight:600 }}>+ CREATE PLAYLIST</button>
        </div>
      ) : (
        <div style={{ padding:'8px 0' }}>
          {playlists.map(pl => (
            <div key={pl.id} onClick={()=>navigate(`/playlists/${pl.id}`)}
              style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',cursor:'pointer',borderBottom:'1px solid rgba(42,58,82,0.5)',transition:'background 0.15s' }}>
              <div style={{ width:50,height:50,borderRadius:12,background:'linear-gradient(135deg,var(--blue-dim),var(--sky-dim))',border:'1px solid var(--navy-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>📋</div>
              <div style={{ flex:1,overflow:'hidden' }}>
                <div style={{ fontSize:14,fontWeight:600,color:'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{pl.name}</div>
                <div style={{ fontSize:11,color:'var(--dimmed)',marginTop:2 }}>{pl.trackIds.length} tracks · {new Date(pl.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={e=>{e.stopPropagation();playAll(pl)}}
                  style={{ background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:6,padding:'7px 12px',fontSize:13 }}>▶</button>
                <button onClick={e=>{e.stopPropagation();remove(pl.id,pl.name)}}
                  style={{ background:'transparent',border:'1px solid var(--navy-border)',color:'var(--danger)',borderRadius:6,padding:'7px 12px',fontSize:13 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
