import { useState, useCallback, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { generateId, formatTime } from '../utils/helpers'

// Call OUR Netlify proxy function instead of JioSaavn directly (fixes CORS)
const PROXY = '/.netlify/functions/music-search'

// ── Normalise a JioSaavn song object ──────────────────────────────────────────
function normaliseTrack(song) {
  // Handle both saavn.dev and older API formats
  const downloadUrls = song.downloadUrl || song.media_url && [{ url: song.media_url, quality: '128kbps' }] || []
  const best =
    downloadUrls.find(u => u.quality === '320kbps') ||
    downloadUrls.find(u => u.quality === '160kbps') ||
    downloadUrls.find(u => u.quality === '128kbps') ||
    downloadUrls[downloadUrls.length - 1]

  const images = song.image || []
  const img = Array.isArray(images)
    ? (images.find(i => i.quality === '500x500') || images[images.length - 1])?.url || ''
    : images

  const primaryArtists = song.artists?.primary?.map(a => a.name).join(', ')
    || song.primaryArtists || song.primary_artists || ''

  return {
    id: song.id || generateId(),
    name: (song.name || song.title || 'Unknown') + '.mp3',
    displayName: song.name || song.title || 'Unknown',
    url: best?.url || '',
    type: 'audio', ext: 'mp3', size: 0,
    addedAt: Date.now(),
    duration: parseInt(song.duration) || 0,
    artist: primaryArtists,
    album: song.album?.name || song.album || '',
    image: img,
    language: song.language || '',
    year: song.year || '',
    online: true,
  }
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding:'0 16px' }}>
      {Array.from({length:6},(_,i)=>(
        <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(42,58,82,0.3)'}}>
          <div style={{width:52,height:52,borderRadius:10,background:'var(--navy-light)',flexShrink:0,animation:'pulse 1.5s ease-in-out infinite',animationDelay:`${i*0.1}s`}}/>
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
            <div style={{height:12,borderRadius:4,background:'var(--navy-light)',width:`${55+i*8}%`,animation:'pulse 1.5s ease-in-out infinite',animationDelay:`${i*0.1}s`}}/>
            <div style={{height:10,borderRadius:4,background:'var(--navy-light)',width:'38%',animation:'pulse 1.5s ease-in-out infinite',animationDelay:`${i*0.15}s`}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Song card ─────────────────────────────────────────────────────────────────
function SongCard({ song, onPlay, onAdd, isActive, isPlaying }) {
  return (
    <div onClick={onPlay}
      style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',cursor:'pointer',background:isActive?'rgba(56,189,248,0.09)':'transparent',borderLeft:isActive?'3px solid var(--sky)':'3px solid transparent',transition:'all 0.15s'}}>
      {/* Artwork */}
      <div style={{width:52,height:52,borderRadius:10,flexShrink:0,overflow:'hidden',position:'relative',boxShadow:isActive?'0 0 14px rgba(56,189,248,0.45)':'0 2px 8px rgba(0,0,0,0.4)'}}>
        {song.image
          ? <img src={song.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}}/>
          : null
        }
        <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#1e3a5f,#0f172a)',display:song.image?'none':'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🎵</div>
        {/* Playing animation overlay */}
        {isActive && isPlaying && (
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{display:'flex',gap:2.5,alignItems:'flex-end'}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{width:3,borderRadius:2,background:'var(--sky)',height:4+i*4,animation:`wave ${0.5+i*0.12}s ease-in-out ${i*0.1}s infinite alternate`,boxShadow:'0 0 4px var(--sky)'}}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{flex:1,overflow:'hidden',minWidth:0}}>
        <div style={{fontSize:13,fontWeight:isActive?600:400,color:isActive?'var(--sky)':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.4}}>
          {song.displayName}
        </div>
        {song.artist && (
          <div style={{fontSize:11,color:'var(--muted)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{song.artist}</div>
        )}
        <div style={{display:'flex',gap:6,marginTop:2,alignItems:'center'}}>
          {song.language && <span style={{fontSize:9,color:'var(--dimmed)',background:'var(--navy-border)',borderRadius:3,padding:'1px 5px',letterSpacing:0.5}}>{song.language.toUpperCase()}</span>}
          {song.duration>0 && <span style={{fontSize:9,color:'var(--dimmed)',fontFamily:'monospace'}}>{formatTime(song.duration)}</span>}
          {song.year && <span style={{fontSize:9,color:'var(--dimmed)'}}>{song.year}</span>}
        </div>
      </div>

      {/* Add to library button */}
      <button onClick={e=>{e.stopPropagation();onAdd()}}
        title="Add to library"
        style={{width:34,height:34,borderRadius:8,background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,transition:'all 0.2s'}}>
        ＋
      </button>
    </div>
  )
}

// ── Mood & artist quicklinks ──────────────────────────────────────────────────
const MOODS = [
  {label:'💔 Melody',   q:'Telugu melody songs 2024'},
  {label:'🔥 Mass',     q:'Telugu mass bgm 2024'},
  {label:'❤️ Love',     q:'Telugu love songs'},
  {label:'🕺 Dance',    q:'Telugu dance party hits'},
  {label:'🙏 Devotional',q:'Telugu devotional songs'},
  {label:'😂 Folk',     q:'Telugu folk songs'},
  {label:'🎬 2024 Hits',q:'Telugu new songs 2024'},
  {label:'😢 Sad',      q:'Telugu sad songs'},
  {label:'🏋️ Workout',  q:'Telugu workout BGM'},
]

const ARTISTS = [
  'Anirudh Telugu','Devi Sri Prasad','SS Thaman','Sid Sriram',
  'Mangli','Mickey J Meyer','Hesham Abdul Wahab','Gopi Sundar',
  'Thaman S','Kaala Bhairava','Vijay Prakash','Armaan Malik Telugu',
]

export default function OnlineMusic() {
  const { controls, notify, state } = usePlayer()
  const { audioQueue, audioIndex, audioPlaying } = state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  const [debugLog, setDebugLog] = useState([])
  const abortRef = useRef(null)
  const inputRef = useRef(null)

  const search = useCallback(async (q, pg=1, append=false) => {
    if (!q.trim()) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError('')
    if (!append) setResults([])

    try {
      const url = `${PROXY}?query=${encodeURIComponent(q.trim())}&page=${pg}&limit=20&type=songs`
      const res = await fetch(url, { signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json._log) setDebugLog(json._log)

      if (!json.success) {
        setDebugLog(json._log || [])
        throw new Error(json.error || 'API error')
      }

      const raw = json.data?.results || []
      const songs = raw.map(normaliseTrack).filter(t => t.url && t.displayName !== 'Unknown')

      setResults(prev => append ? [...prev, ...songs] : songs)
      setHasMore(raw.length >= 20)
      setPage(pg)
      if (!append) setTotalResults(json.data?.total || songs.length)
    } catch(e) {
      if (e.name === 'AbortError') return
      console.error('Music search error:', e)
      setError('Could not load songs. The music server may be temporarily down. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const playOnline = (track) => {
    if (!track.url) { notify('No stream URL for this song', 'warning'); return }
    const existing = audioQueue.findIndex(q => q.id === track.id)
    if (existing !== -1) { controls.playAudioAt(existing); return }
    const newIdx = audioQueue.length
    controls.addAudio([track])
    setTimeout(() => controls.playAudioAt(newIdx), 80)
    notify(`▶ Playing: ${track.displayName}`)
  }

  const addToLibrary = (track) => {
    if (audioQueue.find(q => q.id === track.id)) { notify('Already in your library', 'warning'); return }
    controls.addAudio([track])
    notify(`Added "${track.displayName}" to library ♪`)
  }

  const doSearch = (q) => {
    setQuery(q)
    search(q)
  }

  return (
    <div style={{ minHeight:'100%', background:'var(--navy)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid var(--navy-border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1d4ed8,var(--sky))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 0 14px rgba(56,189,248,0.4)', flexShrink:0 }}>🌐</div>
          <div>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:2, color:'var(--sky)' }}>ONLINE MUSIC</div>
            <div style={{ fontSize:9, color:'var(--dimmed)', letterSpacing:1.5, marginTop:1 }}>JIOSAAVN · FREE · NO LOGIN</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--dimmed)', pointerEvents:'none' }}>🔍</span>
            <input ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key==='Enter' && search(query)}
              placeholder="Song name, artist, movie…"
              style={{ width:'100%', background:'var(--navy-light)', border:'1px solid var(--navy-border)', borderRadius:10, padding:'11px 12px 11px 36px', color:'var(--white)', fontSize:13, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor='var(--blue)'}
              onBlur={e => e.target.style.borderColor='var(--navy-border)'}/>
          </div>
          <button onClick={()=>search(query)} disabled={loading||!query.trim()}
            style={{ background:(!query.trim()||loading)?'var(--navy-light)':'linear-gradient(135deg,var(--blue),var(--sky))', border:`1px solid ${(!query.trim()||loading)?'var(--navy-border)':'var(--sky)'}`, color:(!query.trim()||loading)?'var(--dimmed)':'var(--navy)', borderRadius:10, padding:'0 20px', fontSize:13, fontWeight:700, transition:'all 0.2s', cursor:(!query.trim()||loading)?'not-allowed':'pointer', flexShrink:0, letterSpacing:0.5 }}>
            {loading ? '…' : 'GO'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>

        {/* Discover section — shown when no results */}
        {!results.length && !loading && (
          <>
            {/* Mood chips */}
            <div style={{ padding:'14px 16px 8px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1.5, marginBottom:10, fontWeight:700 }}>BROWSE BY MOOD</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {MOODS.map(m => (
                  <button key={m.q} onClick={()=>doSearch(m.q)}
                    style={{ background:'var(--navy-light)', border:'1px solid var(--navy-border)', color:'var(--white)', borderRadius:20, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', letterSpacing:0.2 }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Top artists */}
            <div style={{ padding:'12px 16px 8px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:1.5, marginBottom:10, fontWeight:700 }}>TOP ARTISTS</div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                {ARTISTS.map(a => (
                  <button key={a} onClick={()=>doSearch(a)}
                    style={{ background:'var(--navy-light)', border:'1px solid rgba(56,189,248,0.2)', color:'var(--sky)', borderRadius:8, padding:'6px 12px', fontSize:11, cursor:'pointer', transition:'all 0.15s' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty hint */}
            {!error && (
              <div style={{ padding:'32px 16px', textAlign:'center' }}>
                <div style={{ fontSize:44, marginBottom:10, opacity:0.2 }}>🎵</div>
                <div style={{ fontSize:13, color:'var(--muted)' }}>Search any Telugu song or artist</div>
                <div style={{ fontSize:11, color:'var(--dimmed)', marginTop:4 }}>Streams from JioSaavn · Free · No login needed</div>
              </div>
            )}
          </>
        )}

        {/* Loading skeleton */}
        {loading && !results.length && <Skeleton />}

        {/* Error state */}
        {error && (
          <div style={{ margin:'16px', padding:'16px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
            <div style={{ fontSize:13, color:'#fca5a5', marginBottom:12, lineHeight:1.6 }}>{error}</div>
            <div style={{ fontSize:11, color:'var(--dimmed)', marginBottom:14, lineHeight:1.6, padding:'8px', background:'rgba(0,0,0,0.2)', borderRadius:8 }}>
              The music API may be temporarily down.<br/>
              Check: <span style={{color:'var(--sky)'}}>Netlify → Functions tab</span> to see error logs.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={()=>search(query)}
                style={{ background:'var(--blue-dim)', border:'1px solid var(--blue)', color:'var(--sky)', borderRadius:8, padding:'8px 20px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                🔄 Retry
              </button>
              <button onClick={()=>{ setQuery('Anirudh Ravichander telugu'); search('Anirudh Ravichander telugu') }}
                style={{ background:'transparent', border:'1px solid var(--navy-border)', color:'var(--muted)', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer' }}>
                Try Different Search
              </button>
            </div>
            {debugLog.length > 0 && (
              <details style={{ marginTop:12, textAlign:'left' }}>
                <summary style={{ fontSize:10, color:'var(--dimmed)', cursor:'pointer', letterSpacing:0.5 }}>▶ Debug Log ({debugLog.length} entries)</summary>
                <div style={{ marginTop:6, maxHeight:120, overflowY:'auto', background:'rgba(0,0,0,0.3)', borderRadius:6, padding:8 }}>
                  {debugLog.map((l,i) => <div key={i} style={{ fontSize:9, color:'#94a3b8', fontFamily:'monospace', marginBottom:2, wordBreak:'break-all' }}>{l}</div>)}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div style={{ padding:'8px 16px 4px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10, color:'var(--dimmed)', letterSpacing:0.5 }}>{results.length} SONGS{totalResults>results.length?` of ${totalResults}`:''}</span>
              <button onClick={()=>{
                const all = results.filter(s=>!audioQueue.find(q=>q.id===s.id))
                if (!all.length) { notify('All songs already in library','warning'); return }
                controls.addAudio(all)
                notify(`Added all ${all.length} songs to library ♪`)
              }} style={{ fontSize:10, color:'var(--sky)', background:'none', border:'none', cursor:'pointer', letterSpacing:0.5 }}>+ ADD ALL</button>
            </div>
            {results.map(song => (
              <SongCard key={song.id} song={song}
                isActive={audioQueue[audioIndex]?.id === song.id}
                isPlaying={audioPlaying}
                onPlay={() => playOnline(song)}
                onAdd={() => addToLibrary(song)}/>
            ))}
            {/* Load more */}
            {hasMore && (
              <div style={{ padding:'16px', textAlign:'center' }}>
                <button onClick={()=>search(query, page+1, true)} disabled={loading}
                  style={{ background:'var(--blue-dim)', border:'1px solid var(--blue)', color:'var(--sky)', borderRadius:10, padding:'11px 32px', fontSize:12, fontWeight:600, opacity:loading?0.5:1, cursor:'pointer', letterSpacing:0.5 }}>
                  {loading ? '⏳ Loading…' : 'LOAD MORE'}
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
