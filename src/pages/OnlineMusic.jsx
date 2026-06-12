import { useState, useCallback, useRef, useEffect } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { generateId, formatTime } from '../utils/helpers'

const PROXY = '/.netlify/functions/music-search'

// ── YouTube IFrame Player ─────────────────────────────────────────────────────
function YouTubePlayer({ videoId, onClose, title }) {
  const ref = useRef(null)
  const [isFS, setIsFS] = useState(false)

  const toggleFS = () => {
    if (!ref.current) return
    if (!document.fullscreenElement) {
      ref.current.requestFullscreen?.() || ref.current.webkitRequestFullscreen?.()
      setIsFS(true)
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.()
      setIsFS(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFS(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (!videoId) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:2000, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(0,0,0,0.8)', flexShrink:0 }}>
        <div style={{ fontSize:12, color:'#fff', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:8 }}>{title}</div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={toggleFS}
            style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:6, padding:'6px 10px', fontSize:13, cursor:'pointer' }}>
            {isFS ? '⊡' : '⛶'}
          </button>
          <button onClick={onClose}
            style={{ background:'rgba(239,68,68,0.3)', border:'1px solid rgba(239,68,68,0.5)', color:'#fff', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer' }}>
            ✕
          </button>
        </div>
      </div>

      {/* YouTube embed */}
      <div ref={ref} style={{ flex:1, position:'relative', background:'#000' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>

      {/* Landscape hint */}
      <div style={{ padding:'6px', textAlign:'center', background:'rgba(0,0,0,0.8)', flexShrink:0 }}>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Tap ⛶ for fullscreen · Rotate phone for 16:9</span>
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding:'0 16px' }}>
      {Array.from({length:6},(_,i)=>(
        <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(42,58,82,0.3)' }}>
          <div style={{ width:90, height:52, borderRadius:8, background:'var(--navy-light)', flexShrink:0, animation:`pulse 1.5s ease-in-out ${i*0.1}s infinite` }}/>
          <div style={{ flex:1 }}>
            <div style={{ height:12, borderRadius:4, background:'var(--navy-light)', marginBottom:7, width:`${55+i*8}%`, animation:`pulse 1.5s ease-in-out ${i*0.1}s infinite` }}/>
            <div style={{ height:10, borderRadius:4, background:'var(--navy-light)', width:'40%', animation:`pulse 1.5s ease-in-out ${i*0.15}s infinite` }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Video card ────────────────────────────────────────────────────────────────
function VideoCard({ video, onPlay, isActive }) {
  const mins = Math.floor((video.duration||0)/60)
  const secs = String((video.duration||0)%60).padStart(2,'0')
  const dur = video.duration > 0 ? `${mins}:${secs}` : ''

  return (
    <div onClick={onPlay}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', cursor:'pointer', background:isActive?'rgba(255,0,0,0.08)':'transparent', borderLeft:isActive?'3px solid #ef4444':'3px solid transparent', transition:'background 0.15s' }}>
      {/* Thumbnail */}
      <div style={{ width:96, height:56, borderRadius:8, overflow:'hidden', flexShrink:0, position:'relative', boxShadow:isActive?'0 0 12px rgba(239,68,68,0.5)':'0 2px 8px rgba(0,0,0,0.5)' }}>
        {video.image
          ? <img src={video.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <div style={{ width:'100%', height:'100%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>▶</div>
        }
        {/* Duration badge */}
        {dur && (
          <div style={{ position:'absolute', bottom:3, right:3, background:'rgba(0,0,0,0.85)', color:'#fff', fontSize:9, padding:'1px 4px', borderRadius:3, fontFamily:'monospace' }}>{dur}</div>
        )}
        {/* YouTube badge */}
        <div style={{ position:'absolute', top:3, left:3, background:'#ff0000', color:'#fff', fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:700, letterSpacing:0.5 }}>YT</div>
        {/* Play overlay when active */}
        {isActive && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
              {[0,1,2].map(i=><div key={i} style={{ width:3, borderRadius:2, background:'#ef4444', height:6+i*4, animation:`wave ${0.5+i*0.15}s ease-in-out ${i*0.1}s infinite alternate` }}/>)}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex:1, overflow:'hidden', minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:isActive?600:400, color:isActive?'#f87171':'var(--white)', overflow:'hidden', textOverflow:'ellipsis', WebkitLineClamp:2, display:'-webkit-box', WebkitBoxOrient:'vertical', lineHeight:1.4 }}>
          {video.displayName}
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {video.artist}
        </div>
        {video.views > 0 && (
          <div style={{ fontSize:9, color:'var(--dimmed)', marginTop:2 }}>
            {(video.views/1000000).toFixed(1)}M views {video.year && `· ${video.year}`}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Quick search chips ────────────────────────────────────────────────────────
const MOODS = [
  {label:'💔 Melody',    q:'Telugu melody songs 2024'},
  {label:'🔥 Mass BGM',  q:'Telugu mass bgm 2025'},
  {label:'❤️ Love',      q:'Telugu love songs latest'},
  {label:'🕺 Dance',     q:'Telugu dance hits 2024'},
  {label:'🙏 Devotional',q:'Telugu devotional songs'},
  {label:'😢 Sad',       q:'Telugu sad songs melody'},
  {label:'🎬 Pushpa 2',  q:'Pushpa 2 Telugu songs'},
  {label:'🎭 Kalki',     q:'Kalki 2898 AD Telugu songs'},
  {label:'🏋️ Workout',   q:'Telugu workout bgm'},
  {label:'🌙 Nightcore', q:'Telugu songs nightcore'},
]
const ARTISTS = [
  'Devi Sri Prasad Telugu','Anirudh Ravichander Telugu','SS Thaman Telugu',
  'Sid Sriram Telugu','Mangli songs','Mickey J Meyer',
  'Hesham Abdul Wahab','Thaman S songs','Kaala Bhairava',
  'Armaan Malik Telugu',
]

// ── Main component ────────────────────────────────────────────────────────────
export default function OnlineMusic() {
  const { notify } = usePlayer()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [debugLog, setDebugLog] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [playerVideo, setPlayerVideo] = useState(null) // { videoId, title }
  const abortRef = useRef(null)

  const search = useCallback(async (q, pg=1, append=false) => {
    if (!q.trim()) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true); setError('')
    if (!append) { setResults([]); setSearched(false) }

    try {
      const url = `${PROXY}?query=${encodeURIComponent(q.trim())}&page=${pg}`
      const res = await fetch(url, { signal: abortRef.current.signal })
      const text = await res.text()

      let json
      try { json = JSON.parse(text) }
      catch(_) { throw new Error(`Server error (HTTP ${res.status}): ${text.slice(0,80)}`) }

      if (json._log) setDebugLog(json._log)
      if (!json.success) throw new Error(json.error || `API error (${res.status})`)

      const videos = json.data?.results || []
      setSearched(true)
      setResults(prev => append ? [...prev, ...videos] : videos)
      setHasMore(videos.length >= 18)
      setPage(pg)

      if (videos.length === 0) setError('No results found. Try a different search.')

    } catch(e) {
      if (e.name === 'AbortError') return
      setSearched(true)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const playVideo = (video) => {
    setActiveId(video.youtubeId || video.id)
    setPlayerVideo({ videoId: video.youtubeId || video.id, title: video.displayName })
  }

  const doSearch = (q) => { setQuery(q); search(q) }

  return (
    <div style={{ minHeight:'100%', background:'var(--navy)', display:'flex', flexDirection:'column' }}>

      {/* YouTube player overlay */}
      {playerVideo && (
        <YouTubePlayer
          videoId={playerVideo.videoId}
          title={playerVideo.title}
          onClose={() => setPlayerVideo(null)}
        />
      )}

      {/* Header */}
      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid var(--navy-border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#cc0000,#ff4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 0 14px rgba(239,68,68,0.5)', flexShrink:0 }}>▶</div>
          <div>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:2, color:'#f87171' }}>YOUTUBE MUSIC</div>
            <div style={{ fontSize:9, color:'var(--dimmed)', letterSpacing:1.5, marginTop:1 }}>FREE · NO LOGIN · UNLIMITED SONGS</div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--dimmed)', pointerEvents:'none' }}>🔍</span>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&search(query)}
              placeholder="Telugu songs, artist, movie…"
              style={{ width:'100%', background:'var(--navy-light)', border:'1px solid var(--navy-border)', borderRadius:10, padding:'11px 12px 11px 36px', color:'var(--white)', fontSize:13, outline:'none', boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor='#ef4444'}
              onBlur={e=>e.target.style.borderColor='var(--navy-border)'}/>
          </div>
          <button onClick={()=>search(query)} disabled={loading||!query.trim()}
            style={{ background:(!query.trim()||loading)?'var(--navy-light)':'linear-gradient(135deg,#cc0000,#ff4444)', border:'none', color:(!query.trim()||loading)?'var(--dimmed)':'#fff', borderRadius:10, padding:'0 20px', fontSize:13, fontWeight:700, cursor:(!query.trim()||loading)?'not-allowed':'pointer', flexShrink:0 }}>
            {loading?'…':'GO'}
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>

        {/* Loading */}
        {loading && <Skeleton/>}

        {/* Discover */}
        {!loading && !searched && !error && (
          <>
            <div style={{ padding:'14px 16px 8px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1.5, marginBottom:10, fontWeight:700 }}>BROWSE BY MOOD</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {MOODS.map(m=>(
                  <button key={m.q} onClick={()=>doSearch(m.q)}
                    style={{ background:'var(--navy-light)', border:'1px solid var(--navy-border)', color:'var(--white)', borderRadius:20, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding:'12px 16px 8px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1.5, marginBottom:10, fontWeight:700 }}>TOP ARTISTS</div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                {ARTISTS.map(a=>(
                  <button key={a} onClick={()=>doSearch(a)}
                    style={{ background:'var(--navy-light)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', borderRadius:8, padding:'6px 12px', fontSize:11, cursor:'pointer' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding:'32px 16px', textAlign:'center' }}>
              <div style={{ fontSize:44, marginBottom:10, opacity:0.2 }}>▶</div>
              <div style={{ fontSize:13, color:'var(--muted)' }}>Search any Telugu song, artist or movie</div>
              <div style={{ fontSize:11, color:'var(--dimmed)', marginTop:4 }}>Powered by YouTube · Free · No login needed</div>
            </div>
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ margin:'16px', padding:'16px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12 }}>
            <div style={{ fontSize:24, textAlign:'center', marginBottom:8 }}>⚠️</div>
            <div style={{ fontSize:12, color:'#fca5a5', marginBottom:12, lineHeight:1.6, textAlign:'center' }}>{error}</div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:12 }}>
              <button onClick={()=>search(query)}
                style={{ background:'rgba(239,68,68,0.2)', border:'1px solid #ef4444', color:'#f87171', borderRadius:8, padding:'7px 16px', fontSize:12, cursor:'pointer' }}>
                🔄 Retry
              </button>
              <button onClick={()=>doSearch('Devi Sri Prasad Telugu songs')}
                style={{ background:'transparent', border:'1px solid var(--navy-border)', color:'var(--muted)', borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer' }}>
                Try Popular Search
              </button>
            </div>
            {debugLog.length > 0 && (
              <details>
                <summary style={{ fontSize:10, color:'var(--dimmed)', cursor:'pointer', marginBottom:6 }}>▶ Debug info</summary>
                <pre style={{ fontSize:9, color:'#64748b', background:'rgba(0,0,0,0.3)', borderRadius:6, padding:8, overflow:'auto', maxHeight:180, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                  {debugLog.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length===0 && !error && (
          <div style={{ padding:'40px 16px', textAlign:'center' }}>
            <div style={{ fontSize:44, opacity:0.2, marginBottom:10 }}>🔍</div>
            <div style={{ fontSize:14, color:'var(--muted)', fontWeight:600, marginBottom:8 }}>No results found</div>
            <div style={{ fontSize:12, color:'var(--dimmed)', marginBottom:16 }}>Try a different search term</div>
            <button onClick={()=>doSearch('Devi Sri Prasad Telugu songs')}
              style={{ background:'rgba(239,68,68,0.2)', border:'1px solid #ef4444', color:'#f87171', borderRadius:8, padding:'8px 20px', fontSize:12, cursor:'pointer' }}>
              Try Popular Search
            </button>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div style={{ padding:'8px 16px 4px', fontSize:10, color:'var(--dimmed)', letterSpacing:0.5 }}>
              {results.length} YOUTUBE VIDEOS · Tap to watch & listen
            </div>
            {results.map(video=>(
              <VideoCard key={video.id||video.youtubeId} video={video}
                isActive={activeId === (video.youtubeId||video.id)}
                onPlay={()=>playVideo(video)}/>
            ))}
            {hasMore && (
              <div style={{ padding:'16px', textAlign:'center' }}>
                <button onClick={()=>search(query, page+1, true)} disabled={loading}
                  style={{ background:'rgba(239,68,68,0.2)', border:'1px solid #ef4444', color:'#f87171', borderRadius:10, padding:'11px 32px', fontSize:12, fontWeight:600, opacity:loading?0.5:1, cursor:'pointer' }}>
                  {loading?'⏳ Loading…':'LOAD MORE'}
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ height:80 }}/>
      </div>
    </div>
  )
}
