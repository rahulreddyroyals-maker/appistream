import { useState, useCallback, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { generateId, formatTime } from '../utils/helpers'

const PROXY = '/.netlify/functions/music-search'

function normaliseTrack(s) {
  const dlUrls = s.downloadUrl || []
  const best = dlUrls.find(u=>u.quality==='320kbps')
    || dlUrls.find(u=>u.quality==='160kbps')
    || dlUrls.find(u=>u.quality==='96kbps')
    || dlUrls[0]
  const imgs = Array.isArray(s.image) ? s.image : []
  const img = (imgs.find(i=>i.quality==='500x500') || imgs.find(i=>i.quality==='150x150') || imgs[0])?.url || ''
  const artists = Array.isArray(s.artists?.primary)
    ? s.artists.primary.map(a=>a.name).join(', ')
    : (s.primaryArtists || s.artist || '')
  return {
    id: s.id || generateId(),
    name: (s.name||s.displayName||s.title||'Unknown')+'.mp3',
    displayName: s.name || s.displayName || s.title || 'Unknown',
    url: s.url || best?.url || '',
    type: 'audio', ext: 'mp3', size: 0, addedAt: Date.now(),
    duration: parseInt(s.duration||0),
    artist: s.artist || artists || '',
    album: s.album?.name || s.album || '',
    image: s.image && !Array.isArray(s.image) ? s.image : img,
    language: s.language || '',
    year: s.year || '',
    online: true,
  }
}

function Skeleton() {
  return (
    <div style={{padding:'0 16px'}}>
      {Array.from({length:5},(_,i)=>(
        <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(42,58,82,0.3)'}}>
          <div style={{width:52,height:52,borderRadius:10,background:'var(--navy-light)',flexShrink:0,animation:`pulse 1.5s ease-in-out ${i*0.1}s infinite`}}/>
          <div style={{flex:1}}>
            <div style={{height:12,borderRadius:4,background:'var(--navy-light)',marginBottom:7,width:`${55+i*8}%`,animation:`pulse 1.5s ease-in-out ${i*0.1}s infinite`}}/>
            <div style={{height:10,borderRadius:4,background:'var(--navy-light)',width:'40%',animation:`pulse 1.5s ease-in-out ${i*0.15}s infinite`}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function SongCard({song, onPlay, onAdd, isActive, isPlaying}) {
  return (
    <div onClick={onPlay} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',cursor:'pointer',background:isActive?'rgba(56,189,248,0.09)':'transparent',borderLeft:isActive?'3px solid var(--sky)':'3px solid transparent',transition:'background 0.15s'}}>
      <div style={{width:52,height:52,borderRadius:10,flexShrink:0,overflow:'hidden',position:'relative',boxShadow:isActive?'0 0 14px rgba(56,189,248,0.45)':'0 2px 8px rgba(0,0,0,0.4)'}}>
        {song.image
          ? <img src={song.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
              onError={e=>{e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'}}/>
          : null}
        <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#1e3a5f,#0f172a)',display:song.image?'none':'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🎵</div>
        {isActive&&isPlaying&&(
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{display:'flex',gap:2.5,alignItems:'flex-end'}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:3,borderRadius:2,background:'var(--sky)',height:4+i*4,animation:`wave ${0.5+i*0.12}s ease-in-out ${i*0.1}s infinite alternate`}}/>)}
            </div>
          </div>
        )}
      </div>
      <div style={{flex:1,overflow:'hidden',minWidth:0}}>
        <div style={{fontSize:13,fontWeight:isActive?600:400,color:isActive?'var(--sky)':'var(--white)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{song.displayName}</div>
        {song.artist&&<div style={{fontSize:11,color:'var(--muted)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{song.artist}</div>}
        <div style={{display:'flex',gap:6,marginTop:2}}>
          {song.language&&<span style={{fontSize:9,color:'var(--dimmed)',background:'var(--navy-border)',borderRadius:3,padding:'1px 5px'}}>{song.language.toUpperCase()}</span>}
          {song.duration>0&&<span style={{fontSize:9,color:'var(--dimmed)',fontFamily:'monospace'}}>{formatTime(song.duration)}</span>}
          {song.year&&<span style={{fontSize:9,color:'var(--dimmed)'}}>{song.year}</span>}
        </div>
      </div>
      <button onClick={e=>{e.stopPropagation();onAdd()}}
        style={{width:34,height:34,borderRadius:8,background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>＋</button>
    </div>
  )
}

const MOODS = [
  {label:'💔 Melody',q:'Telugu melody songs 2024'},
  {label:'🔥 Mass',q:'Telugu mass bgm 2024'},
  {label:'❤️ Love',q:'Telugu love songs'},
  {label:'🕺 Dance',q:'Telugu dance party hits'},
  {label:'🙏 Devotional',q:'Telugu devotional songs'},
  {label:'😂 Folk',q:'Telugu folk songs'},
  {label:'🎬 2024 Hits',q:'Telugu new songs 2024'},
  {label:'😢 Sad',q:'Telugu sad songs'},
]
const ARTISTS = ['Anirudh Telugu','Devi Sri Prasad','SS Thaman','Sid Sriram','Mangli','Mickey J Meyer','Hesham Abdul Wahab','Gopi Sundar','Thaman S','Kaala Bhairava']

export default function OnlineMusic() {
  const {controls, notify, state} = usePlayer()
  const {audioQueue, audioIndex, audioPlaying} = state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false) // true after first search attempt
  const [statusMsg, setStatusMsg] = useState('') // what actually happened
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const abortRef = useRef(null)

  const search = useCallback(async (q, pg=1, append=false) => {
    if (!q.trim()) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError('')
    setStatusMsg('')
    if (!append) { setResults([]); setSearched(false) }

    try {
      const url = `${PROXY}?query=${encodeURIComponent(q.trim())}&page=${pg}&limit=20`
      console.log('[OnlineMusic] Fetching:', url)

      const res = await fetch(url, {
        signal: abortRef.current.signal,
        headers: { 'Accept': 'application/json' }
      })

      console.log('[OnlineMusic] Response status:', res.status)

      const text = await res.text()
      console.log('[OnlineMusic] Raw response (first 300):', text.slice(0,300))

      let json
      try { json = JSON.parse(text) }
      catch(pe) {
        // Not JSON - function probably returned HTML error page
        setDebugInfo({ httpStatus: res.status, rawResponse: text.slice(0,500) })
        throw new Error(`Function returned non-JSON (HTTP ${res.status}): ${text.slice(0,100)}`)
      }

      setDebugInfo({ httpStatus: res.status, source: json.source, log: json._log })

      if (!json.success) {
        throw new Error(json.error || `API failed (${res.status})`)
      }

      const raw = json.data?.results || []
      console.log('[OnlineMusic] Raw results count:', raw.length)

      const songs = raw.map(normaliseTrack).filter(t => {
        const valid = t.url && t.displayName && t.displayName !== 'Unknown'
        if (!valid) console.log('[OnlineMusic] Filtered out:', t.displayName, 'url:', t.url?.slice(0,50))
        return valid
      })

      console.log('[OnlineMusic] Valid songs with URL:', songs.length)

      setSearched(true)
      setResults(prev => append ? [...prev, ...songs] : songs)
      setHasMore(raw.length >= 20)
      setPage(pg)
      setStatusMsg(`Found ${songs.length} songs via ${json.source || 'API'}`)

      if (songs.length === 0 && raw.length > 0) {
        setError(`API returned ${raw.length} results but none had playable URLs. Source: ${json.source}`)
      }

    } catch(e) {
      if (e.name === 'AbortError') return
      console.error('[OnlineMusic] Search failed:', e)
      setSearched(true)
      setError(e.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const playOnline = (track) => {
    if (!track.url) { notify('No playable URL for this song', 'warning'); return }
    const existing = audioQueue.findIndex(q => q.id === track.id)
    if (existing !== -1) { controls.playAudioAt(existing); return }
    const newIdx = audioQueue.length
    controls.addAudio([track])
    setTimeout(() => controls.playAudioAt(newIdx), 80)
    notify(`▶ ${track.displayName}`)
  }

  const addToLib = (track) => {
    if (audioQueue.find(q => q.id === track.id)) { notify('Already in library', 'warning'); return }
    controls.addAudio([track])
    notify(`Added "${track.displayName}" ♪`)
  }

  const doSearch = (q) => { setQuery(q); search(q) }

  return (
    <div style={{minHeight:'100%',background:'var(--navy)',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--navy-border)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#1d4ed8,var(--sky))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:'0 0 14px rgba(56,189,248,0.4)',flexShrink:0}}>🌐</div>
          <div>
            <div style={{fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)'}}>ONLINE MUSIC</div>
            <div style={{fontSize:9,color:'var(--dimmed)',letterSpacing:1.5,marginTop:1}}>JIOSAAVN · FREE · NO LOGIN</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1,position:'relative'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:15,color:'var(--dimmed)',pointerEvents:'none'}}>🔍</span>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&search(query)}
              placeholder="Song name, artist, movie…"
              style={{width:'100%',background:'var(--navy-light)',border:'1px solid var(--navy-border)',borderRadius:10,padding:'11px 12px 11px 36px',color:'var(--white)',fontSize:13,outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='var(--blue)'}
              onBlur={e=>e.target.style.borderColor='var(--navy-border)'}/>
          </div>
          <button onClick={()=>search(query)} disabled={loading||!query.trim()}
            style={{background:(!query.trim()||loading)?'var(--navy-light)':'linear-gradient(135deg,var(--blue),var(--sky))',border:'none',color:(!query.trim()||loading)?'var(--dimmed)':'var(--navy)',borderRadius:10,padding:'0 20px',fontSize:13,fontWeight:700,cursor:(!query.trim()||loading)?'not-allowed':'pointer',flexShrink:0}}>
            {loading?'…':'GO'}
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>

        {/* Loading */}
        {loading && <Skeleton/>}

        {/* Discover — shown before first search */}
        {!loading && !searched && (
          <>
            <div style={{padding:'14px 16px 8px'}}>
              <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1.5,marginBottom:10,fontWeight:700}}>BROWSE BY MOOD</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {MOODS.map(m=>(
                  <button key={m.q} onClick={()=>doSearch(m.q)}
                    style={{background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--white)',borderRadius:20,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{padding:'12px 16px 8px'}}>
              <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1.5,marginBottom:10,fontWeight:700}}>TOP ARTISTS</div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                {ARTISTS.map(a=>(
                  <button key={a} onClick={()=>doSearch(a)}
                    style={{background:'var(--navy-light)',border:'1px solid rgba(56,189,248,0.2)',color:'var(--sky)',borderRadius:8,padding:'6px 12px',fontSize:11,cursor:'pointer'}}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div style={{padding:'32px 16px',textAlign:'center'}}>
              <div style={{fontSize:44,marginBottom:10,opacity:0.2}}>🎵</div>
              <div style={{fontSize:13,color:'var(--muted)'}}>Search any Telugu song or artist</div>
              <div style={{fontSize:11,color:'var(--dimmed)',marginTop:4}}>Streams from JioSaavn · Free · No login needed</div>
            </div>
          </>
        )}

        {/* No results after search */}
        {!loading && searched && results.length===0 && !error && (
          <div style={{padding:'32px 16px',textAlign:'center'}}>
            <div style={{fontSize:44,marginBottom:10,opacity:0.3}}>🎵</div>
            <div style={{fontSize:14,color:'var(--muted)',fontWeight:600,marginBottom:8}}>No results found</div>
            <div style={{fontSize:12,color:'var(--dimmed)',marginBottom:16}}>{statusMsg}</div>
            <button onClick={()=>doSearch(query)}
              style={{background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'8px 20px',fontSize:12,cursor:'pointer',marginBottom:12}}>
              🔄 Try Again
            </button>
            {debugInfo && (
              <details style={{textAlign:'left',marginTop:8}}>
                <summary style={{fontSize:10,color:'var(--dimmed)',cursor:'pointer',padding:'4px 0'}}>▶ Debug info</summary>
                <pre style={{fontSize:9,color:'#64748b',background:'rgba(0,0,0,0.3)',borderRadius:6,padding:8,marginTop:6,overflow:'auto',maxHeight:150,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                  {JSON.stringify(debugInfo,null,2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{margin:'16px',padding:'16px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:12}}>
            <div style={{fontSize:24,textAlign:'center',marginBottom:8}}>⚠️</div>
            <div style={{fontSize:12,color:'#fca5a5',marginBottom:12,lineHeight:1.6,textAlign:'center'}}>{error}</div>
            <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:12}}>
              <button onClick={()=>search(query)}
                style={{background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:8,padding:'7px 16px',fontSize:12,cursor:'pointer'}}>
                🔄 Retry
              </button>
              <button onClick={()=>doSearch('Anirudh Ravichander')}
                style={{background:'transparent',border:'1px solid var(--navy-border)',color:'var(--muted)',borderRadius:8,padding:'7px 14px',fontSize:12,cursor:'pointer'}}>
                Try Different
              </button>
            </div>
            {debugInfo && (
              <details>
                <summary style={{fontSize:10,color:'var(--dimmed)',cursor:'pointer',marginBottom:6}}>▶ Debug info (share this screenshot)</summary>
                <pre style={{fontSize:9,color:'#64748b',background:'rgba(0,0,0,0.3)',borderRadius:6,padding:8,overflow:'auto',maxHeight:200,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
{`HTTP: ${debugInfo.httpStatus}
Source: ${debugInfo.source || 'unknown'}
${debugInfo.log ? 'Log:\n' + debugInfo.log.join('\n') : ''}
${debugInfo.rawResponse ? 'Raw:\n' + debugInfo.rawResponse.slice(0,300) : ''}`}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div style={{padding:'8px 16px 4px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:10,color:'var(--dimmed)',letterSpacing:0.5}}>{results.length} SONGS · {statusMsg}</span>
              <button onClick={()=>{
                const newSongs=results.filter(s=>!audioQueue.find(q=>q.id===s.id))
                if(!newSongs.length){notify('All already in library','warning');return}
                controls.addAudio(newSongs); notify(`Added all ${newSongs.length} songs ♪`)
              }} style={{fontSize:10,color:'var(--sky)',background:'none',border:'none',cursor:'pointer'}}>+ ADD ALL</button>
            </div>
            {results.map(song=>(
              <SongCard key={song.id} song={song}
                isActive={audioQueue[audioIndex]?.id===song.id} isPlaying={audioPlaying}
                onPlay={()=>playOnline(song)} onAdd={()=>addToLib(song)}/>
            ))}
            {hasMore&&(
              <div style={{padding:'16px',textAlign:'center'}}>
                <button onClick={()=>search(query,page+1,true)} disabled={loading}
                  style={{background:'var(--blue-dim)',border:'1px solid var(--blue)',color:'var(--sky)',borderRadius:10,padding:'11px 32px',fontSize:12,fontWeight:600,opacity:loading?0.5:1,cursor:'pointer'}}>
                  {loading?'⏳ Loading…':'LOAD MORE'}
                </button>
              </div>
            )}
          </>
        )}

        <div style={{height:80}}/>
      </div>
    </div>
  )
}
