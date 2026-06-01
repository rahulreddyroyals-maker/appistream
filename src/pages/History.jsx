import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { getHistory, clearHistory } from '../utils/db'
import { timeAgo, formatTime } from '../utils/helpers'

export default function History() {
  const { state, controls, notify, derived } = usePlayer()
  const { audioQueue, videoQueue } = state
  const { currentTrack, isPlaying } = derived
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getHistory().then(h => { setHistory(h); setLoading(false) }).catch(()=>setLoading(false))
  }, [])

  const clear = async () => {
    if (!confirm('Clear all history?')) return
    await clearHistory(); setHistory([]); notify('History cleared')
  }

  const play = (track) => {
    if (track.type === 'video') {
      const idx = videoQueue.findIndex(q => q.id === track.id)
      if (idx !== -1) { controls.playVideoAt(idx); navigate('/video') }
      else notify('Load this video in your library first', 'warning')
    } else {
      const idx = audioQueue.findIndex(q => q.id === track.id)
      if (idx !== -1) { controls.playAudioAt(idx); navigate('/') }
      else notify('Load this song in your library first', 'warning')
    }
  }

  // Group by date
  const grouped = history.reduce((acc, item) => {
    const key = new Date(item.playedAt).toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'var(--muted)',fontSize:13 }}>Loading…</div>

  return (
    <div style={{ minHeight:'100%',background:'var(--navy)' }}>
      <div style={{ padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--navy-border)' }}>
        <h1 style={{ fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)' }}>HISTORY</h1>
        {history.length>0&&<button onClick={clear} style={{ color:'var(--danger)',fontSize:11,background:'none',border:'1px solid var(--danger)',borderRadius:6,padding:'5px 10px',letterSpacing:0.5 }}>CLEAR</button>}
      </div>

      {history.length===0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 32px',gap:12,textAlign:'center' }}>
          <span style={{ fontSize:48,opacity:0.2 }}>🕐</span>
          <div style={{ fontSize:14,color:'var(--muted)',letterSpacing:1,fontWeight:600 }}>NO HISTORY YET</div>
          <div style={{ fontSize:12,color:'var(--dimmed)' }}>Your play history will appear here</div>
        </div>
      ) : (
        Object.entries(grouped).map(([date,items]) => (
          <div key={date}>
            <div style={{ padding:'10px 16px 4px',fontSize:10,color:'var(--sky)',letterSpacing:1,fontWeight:600,borderBottom:'1px solid rgba(42,58,82,0.4)' }}>{date}</div>
            {items.map((item,i) => {
              const isActive = currentTrack?.id === item.id
              return (
                <div key={`${item.hid}_${i}`} onClick={()=>play(item)}
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 16px',cursor:'pointer',background:isActive?'rgba(56,189,248,0.08)':'transparent',borderLeft:isActive?'2px solid var(--sky)':'2px solid transparent',transition:'background 0.15s' }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>{item.type==='video'?'🎬':'🎵'}</span>
                  <div style={{ flex:1,overflow:'hidden' }}>
                    <div style={{ fontSize:12,color:isActive?'var(--sky)':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.displayName}</div>
                    <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:1 }}>{timeAgo(item.playedAt)}</div>
                  </div>
                  <span style={{ color:'var(--sky)',fontSize:14 }}>▶</span>
                </div>
              )
            })}
          </div>
        ))
      )}
      <div style={{ height:16 }}/>
    </div>
  )
}
