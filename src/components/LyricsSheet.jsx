import { useState, useEffect, useRef } from 'react'
import { getLyrics, saveLyrics, deleteLyrics } from '../utils/db'

// Lyrics bottom sheet with edit, display, and auto-scroll
export default function LyricsSheet({ track, isPlaying, currentTime, duration, onClose }) {
  const [lyrics, setLyrics] = useState(null)   // null = not loaded, '' = no lyrics
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!track) return
    getLyrics(track.id).then(l => {
      setLyrics(l?.text || '')
      setDraft(l?.text || '')
    })
  }, [track?.id])

  // Auto-scroll lyrics proportionally to playback position
  useEffect(() => {
    if (!isPlaying || editing || !scrollRef.current || !lyrics) return
    const pct = duration ? currentTime / duration : 0
    const el = scrollRef.current
    const target = (el.scrollHeight - el.clientHeight) * pct
    el.scrollTo({ top: target, behavior: 'smooth' })
  }, [Math.floor(currentTime / 3)]) // update every 3 seconds

  const save = async () => {
    if (!track) return
    setSaving(true)
    await saveLyrics(track.id, draft, track.displayName)
    setLyrics(draft)
    setEditing(false)
    setSaving(false)
  }

  const remove = async () => {
    if (!track || !confirm('Remove lyrics?')) return
    await deleteLyrics(track.id)
    setLyrics('')
    setDraft('')
    setEditing(false)
  }

  if (!track) return null

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000 }}/>
      <div className="animate-slideUp" style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'var(--navy)', borderRadius:'20px 20px 0 0',
        borderTop:'1px solid var(--navy-border)',
        zIndex:1001, height:'82vh', display:'flex', flexDirection:'column',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex',justifyContent:'center',padding:'10px 0 4px',flexShrink:0 }}>
          <div style={{ width:36,height:4,borderRadius:2,background:'var(--dimmed)' }}/>
        </div>

        {/* Header */}
        <div style={{ padding:'4px 16px 12px',borderBottom:'1px solid var(--navy-border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:'var(--sky)',letterSpacing:1 }}>🎤 LYRICS</div>
            <div style={{ fontSize:11,color:'var(--dimmed)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:220 }}>
              {track.displayName}
            </div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {!editing ? (
              <>
                {lyrics && (
                  <button onClick={remove} style={{ color:'var(--danger)',fontSize:11,background:'none',border:'1px solid rgba(239,68,68,0.3)',borderRadius:6,padding:'5px 10px' }}>
                    Remove
                  </button>
                )}
                <button onClick={()=>{ setEditing(true); setTimeout(()=>textareaRef.current?.focus(),100) }}
                  style={{ color:'var(--sky)',fontSize:11,background:'var(--blue-dim)',border:'1px solid var(--blue)',borderRadius:6,padding:'5px 12px',fontWeight:600 }}>
                  {lyrics ? '✏️ Edit' : '+ Add'}
                </button>
              </>
            ) : (
              <>
                <button onClick={()=>{ setEditing(false); setDraft(lyrics) }} style={{ color:'var(--muted)',fontSize:11,background:'none',border:'1px solid var(--navy-border)',borderRadius:6,padding:'5px 10px' }}>Cancel</button>
                <button onClick={save} disabled={saving}
                  style={{ color:'var(--navy)',fontSize:11,background:'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',borderRadius:6,padding:'5px 14px',fontWeight:700,opacity:saving?0.7:1 }}>
                  {saving ? '…' : 'SAVE'}
                </button>
              </>
            )}
            <button onClick={onClose} style={{ color:'var(--muted)',fontSize:20,background:'none',border:'none',padding:4 }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1,overflow:'hidden',display:'flex',flexDirection:'column' }}>
          {editing ? (
            <div style={{ flex:1,display:'flex',flexDirection:'column',padding:'12px 16px',gap:8 }}>
              <div style={{ fontSize:11,color:'var(--dimmed)',letterSpacing:0.5 }}>
                Paste or type lyrics below. They'll auto-scroll as the song plays.
              </div>
              <textarea ref={textareaRef} value={draft} onChange={e=>setDraft(e.target.value)}
                placeholder={"Verse 1:\nLyrics here...\n\nChorus:\n..."}
                style={{ flex:1,background:'var(--navy-light)',border:'1px solid var(--navy-border)',borderRadius:10,padding:'12px',color:'var(--white)',fontSize:13,lineHeight:1.8,outline:'none',resize:'none',fontFamily:'inherit' }}/>
            </div>
          ) : lyrics ? (
            <div ref={scrollRef} style={{ flex:1,overflowY:'auto',padding:'16px 20px' }}>
              {/* Progress indicator */}
              {duration > 0 && (
                <div style={{ marginBottom:16,height:2,background:'var(--dimmed)',borderRadius:1,overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${(currentTime/duration)*100}%`,background:'linear-gradient(to right,var(--blue),var(--sky))',transition:'width 1s linear',boxShadow:'0 0 6px var(--sky)' }}/>
                </div>
              )}
              <pre style={{ color:'var(--white)',fontSize:15,lineHeight:2,whiteSpace:'pre-wrap',wordBreak:'break-word',fontFamily:"'Rajdhani',sans-serif",fontWeight:500,letterSpacing:0.3 }}>
                {lyrics}
              </pre>
            </div>
          ) : (
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:32,textAlign:'center' }}>
              <span style={{ fontSize:52,opacity:0.2 }}>🎤</span>
              <div style={{ fontSize:15,color:'var(--muted)',fontWeight:600 }}>No Lyrics Added</div>
              <div style={{ fontSize:12,color:'var(--dimmed)',lineHeight:1.7,maxWidth:260 }}>
                Tap <span style={{ color:'var(--sky)',fontWeight:600 }}>+ Add</span> to paste lyrics for this song. They'll auto-scroll as the music plays.
              </div>
              <button onClick={()=>{ setEditing(true); setTimeout(()=>textareaRef.current?.focus(),100) }}
                style={{ background:'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',color:'var(--navy)',borderRadius:12,padding:'12px 28px',fontSize:13,fontWeight:700,letterSpacing:1,boxShadow:'0 0 20px rgba(56,189,248,0.4)',cursor:'pointer',fontFamily:'inherit' }}>
                + ADD LYRICS
              </button>
            </div>
          )}
        </div>

        <div style={{ height:'calc(env(safe-area-inset-bottom,0px) + 8px)',flexShrink:0 }}/>
      </div>
    </>
  )
}
