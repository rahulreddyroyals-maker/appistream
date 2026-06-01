import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { getFavorites, removeFavorite } from '../utils/db'
import { timeAgo, formatSize } from '../utils/helpers'

export default function Favorites() {
  const { state, controls, notify, derived } = usePlayer()
  const { audioQueue, videoQueue } = state
  const { currentTrack, isPlaying } = derived
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getFavorites()
      .then(f => {
        setFavorites(f.sort((a, b) => (b.favAt||0) - (a.favAt||0)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const remove = async (id, name) => {
    await removeFavorite(id)
    setFavorites(f => f.filter(t => t.id !== id))
    notify(`Removed from favorites`)
  }

  const playFav = (track) => {
    // Find in audio or video queue
    if (track.type === 'video') {
      const idx = videoQueue.findIndex(q => q.id === track.id)
      if (idx !== -1) { controls.playVideoAt(idx); navigate('/video') }
      else { notify('Add this video to your library first', 'warning') }
    } else {
      const idx = audioQueue.findIndex(q => q.id === track.id)
      if (idx !== -1) { controls.playAudioAt(idx); navigate('/') }
      else { notify('Add this song to your library first', 'warning') }
    }
  }

  const playAll = () => {
    const audioFavs = favorites.filter(f => f.type !== 'video')
    const inQueue = audioFavs.map(f => audioQueue.findIndex(q => q.id === f.id)).filter(i => i !== -1)
    if (!inQueue.length) { notify('Add favorites to your library first', 'warning'); return }
    controls.playAudioAt(inQueue[0]); navigate('/')
  }

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'var(--muted)',fontSize:13 }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight:'100%', background:'var(--navy)' }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--navy-border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:28, filter:'drop-shadow(0 0 8px #ef444488)' }}>♥</span>
          <h1 style={{ fontSize:18, fontWeight:700, letterSpacing:2, color:'var(--sky)' }}>FAVORITES</h1>
        </div>
        {favorites.length > 0 && (
          <button onClick={playAll} style={{ background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'6px 14px',fontSize:11,fontWeight:600,letterSpacing:1 }}>▶ PLAY ALL</button>
        )}
      </div>

      {favorites.length === 0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 32px',gap:14,textAlign:'center' }}>
          <span style={{ fontSize:64, opacity:0.2, filter:'drop-shadow(0 0 12px #ef4444)' }}>♡</span>
          <div style={{ fontSize:15, color:'var(--muted)', letterSpacing:1, fontWeight:600 }}>NO FAVORITES YET</div>
          <div style={{ fontSize:12, color:'var(--dimmed)', lineHeight:1.7 }}>
            Tap the <span style={{ color:'#ef4444', fontSize:16 }}>♥</span> heart icon on any track in the Library to add it here
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding:'8px 16px 4px', fontSize:10, color:'var(--dimmed)', letterSpacing:0.5 }}>
            {favorites.length} FAVORITE{favorites.length !== 1 ? 'S' : ''}
          </div>
          {favorites.map((track, i) => {
            const isActive = currentTrack?.id === track.id
            return (
              <div key={track.id} onClick={() => playFav(track)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', cursor:'pointer', background:isActive?'rgba(56,189,248,0.08)':'transparent', borderLeft:isActive?'2px solid var(--sky)':'2px solid transparent', transition:'background 0.15s' }}>
                {/* Big heart indicator */}
                <div style={{ width:42, height:42, borderRadius:10, background:isActive?'rgba(239,68,68,0.2)':'rgba(239,68,68,0.08)', border:`1px solid ${isActive?'rgba(239,68,68,0.5)':'rgba(239,68,68,0.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:22, filter:isActive?'drop-shadow(0 0 8px #ef4444)':'none' }}>
                    {isActive && isPlaying ? '▶' : track.type === 'video' ? '🎬' : '🎵'}
                  </span>
                </div>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:13, fontWeight:isActive?600:400, color:isActive?'var(--sky)':'var(--white)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {track.displayName}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:2, alignItems:'center' }}>
                    <span style={{ fontSize:9, color:track.type==='video'?'#a78bfa':'var(--sky)', border:'1px solid currentColor', borderRadius:3, padding:'0 4px', letterSpacing:0.5 }}>{track.ext?.toUpperCase()}</span>
                    <span style={{ fontSize:10, color:'var(--dimmed)' }}>{formatSize(track.size)}</span>
                    <span style={{ fontSize:10, color:'var(--dimmed)' }}>{timeAgo(track.favAt||Date.now())}</span>
                  </div>
                </div>
                {/* Big heart button */}
                <button onClick={e => { e.stopPropagation(); remove(track.id, track.displayName) }}
                  style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:22, color:'#ef4444', filter:'drop-shadow(0 0 6px #ef444488)' }}>♥</span>
                </button>
              </div>
            )
          })}
          <div style={{ height:80 }}/>
        </>
      )}
    </div>
  )
}
