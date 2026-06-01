import { useState, useEffect } from 'react'
import { getPlaylists, savePlaylist } from '../utils/db'
import { generateId } from '../utils/helpers'

// Bottom sheet for adding a track to playlists
// Usage: <AddToPlaylistSheet track={track} onClose={()=>setOpen(false)} onNotify={notify}/>
export default function AddToPlaylistSheet({ track, onClose, onNotify }) {
  const [playlists, setPlaylists] = useState([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [added, setAdded] = useState({}) // playlistId -> bool

  useEffect(() => {
    getPlaylists().then(pls => {
      setPlaylists(pls.sort((a,b) => b.updatedAt - a.updatedAt))
      // Mark which playlists already contain this track
      const map = {}
      pls.forEach(pl => { if (pl.trackIds?.includes(track?.id)) map[pl.id] = true })
      setAdded(map)
    })
  }, [track?.id])

  const toggle = async (pl) => {
    if (!track) return
    const has = added[pl.id]
    const updated = {
      ...pl,
      trackIds: has
        ? pl.trackIds.filter(id => id !== track.id)
        : [...(pl.trackIds||[]), track.id],
      updatedAt: Date.now()
    }
    await savePlaylist(updated)
    setPlaylists(prev => prev.map(p => p.id === pl.id ? updated : p))
    setAdded(prev => ({ ...prev, [pl.id]: !has }))
    onNotify?.(has ? 'Removed from playlist' : `Added to "${pl.name}" ♪`)
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    const pl = { id:generateId(), name:newName.trim(), trackIds:track?[track.id]:[], createdAt:Date.now(), updatedAt:Date.now() }
    await savePlaylist(pl)
    setPlaylists(prev => [pl, ...prev])
    setAdded(prev => ({ ...prev, [pl.id]: true }))
    setNewName(''); setCreating(false)
    onNotify?.(`Created "${pl.name}" ♪`)
  }

  if (!track) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000 }}/>

      {/* Sheet */}
      <div className="animate-slideUp" style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'var(--navy-light)', borderRadius:'20px 20px 0 0',
        borderTop:'1px solid var(--navy-border)',
        zIndex:1001, maxHeight:'75vh', display:'flex', flexDirection:'column',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex',justifyContent:'center',padding:'10px 0 4px' }}>
          <div style={{ width:36,height:4,borderRadius:2,background:'var(--dimmed)' }}/>
        </div>

        {/* Header */}
        <div style={{ padding:'8px 16px 12px', borderBottom:'1px solid var(--navy-border)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:'var(--sky)',letterSpacing:1 }}>ADD TO PLAYLIST</div>
              <div style={{ fontSize:11,color:'var(--dimmed)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:260 }}>
                {track.displayName}
              </div>
            </div>
            <button onClick={onClose} style={{ color:'var(--muted)',fontSize:20,background:'none',border:'none',padding:4 }}>✕</button>
          </div>
        </div>

        {/* New playlist input */}
        {creating ? (
          <div style={{ padding:'10px 16px',borderBottom:'1px solid var(--navy-border)',display:'flex',gap:8 }}>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&createAndAdd()}
              placeholder="Playlist name…"
              style={{ flex:1,background:'var(--navy)',border:'1px solid var(--blue)',borderRadius:8,padding:'8px 12px',color:'var(--white)',fontSize:13,outline:'none' }}/>
            <button onClick={createAndAdd} style={{ background:'var(--blue)',color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700 }}>CREATE</button>
            <button onClick={()=>setCreating(false)} style={{ background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'8px 10px' }}>✕</button>
          </div>
        ) : (
          <button onClick={()=>setCreating(true)} style={{ margin:'10px 16px',background:'var(--blue-dim)',border:'1px dashed var(--blue)',color:'var(--sky)',borderRadius:10,padding:'10px',fontSize:12,fontWeight:600,letterSpacing:0.5,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
            <span style={{fontSize:16}}>+</span> NEW PLAYLIST
          </button>
        )}

        {/* Playlist list */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {playlists.length === 0 ? (
            <div style={{ padding:'24px',textAlign:'center',color:'var(--dimmed)',fontSize:12 }}>
              No playlists yet — create one above
            </div>
          ) : (
            playlists.map(pl => {
              const has = added[pl.id]
              return (
                <div key={pl.id} onClick={()=>toggle(pl)}
                  style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid rgba(42,58,82,0.4)',background:has?'rgba(56,189,248,0.06)':'transparent',transition:'background 0.15s' }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:has?'rgba(56,189,248,0.2)':'var(--navy)',border:`1px solid ${has?'rgba(56,189,248,0.4)':'var(--navy-border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>📋</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:has?600:400,color:has?'var(--sky)':'var(--white)' }}>{pl.name}</div>
                    <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:1 }}>{pl.trackIds?.length||0} tracks</div>
                  </div>
                  {/* Checkmark */}
                  <div style={{ width:26,height:26,borderRadius:'50%',background:has?'var(--sky)':'transparent',border:`2px solid ${has?'var(--sky)':'var(--dimmed)'}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',boxShadow:has?'0 0 10px rgba(56,189,248,0.5)':'none' }}>
                    {has && <span style={{ color:'var(--navy)',fontSize:14,fontWeight:700 }}>✓</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Bottom safe area */}
        <div style={{ height:'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}/>
      </div>
    </>
  )
}
