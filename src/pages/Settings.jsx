import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { clearHistory } from '../utils/db'
import logo from '../assets/logo.png'

function Toggle({ value, onChange }) {
  return (
    <div onClick={onChange} style={{ width:46,height:26,borderRadius:13,background:value?'var(--blue)':'var(--dimmed)',position:'relative',cursor:'pointer',transition:'background 0.2s',boxShadow:value?'0 0 8px rgba(56,189,248,0.5)':'none',flexShrink:0 }}>
      <div style={{ position:'absolute',top:3,left:value?23:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}/>
    </div>
  )
}

function Row({ icon, label, desc, right, onClick, danger }) {
  return (
    <div onClick={onClick} style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:'1px solid rgba(42,58,82,0.4)',cursor:onClick?'pointer':'default' }}>
      <span style={{ fontSize:20,flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13,color:danger?'var(--danger)':'var(--white)',fontWeight:500 }}>{label}</div>
        {desc&&<div style={{ fontSize:10,color:'var(--dimmed)',marginTop:1,lineHeight:1.5 }}>{desc}</div>}
      </div>
      {right}
    </div>
  )
}

function Section({ title }) {
  return <div style={{ padding:'12px 16px 4px',fontSize:10,color:'var(--sky)',letterSpacing:1.5,fontWeight:700 }}>{title}</div>
}

export default function Settings() {
  const { state, controls, notify } = usePlayer()
  const { eqEnabled, noiseCancelEnabled, loop, shuffle, playbackRate, volume, isMuted } = state
  const navigate = useNavigate()

  const clearHist = async () => {
    if (confirm('Clear all play history?')) { await clearHistory(); notify('History cleared') }
  }

  return (
    <div style={{ minHeight:'100%',background:'var(--navy)' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--navy-border)' }}>
        <img src={logo} style={{ width:28,height:28,objectFit:'contain',borderRadius:6 }}/>
        <h1 style={{ fontSize:17,fontWeight:700,letterSpacing:2,color:'var(--sky)' }}>SETTINGS</h1>
      </div>

      <Section title="AUDIO QUALITY"/>
      <Row icon="🎧" label="Noise Cancellation"
        desc={noiseCancelEnabled
          ? "ON — High-pass (60Hz), low-pass (18kHz) + dynamics compressor active"
          : "OFF — Raw audio output"}
        right={<Toggle value={noiseCancelEnabled} onChange={()=>controls.toggleNoiseCancel()}/>}/>
      <Row icon="🎚" label="10-Band Equalizer"
        desc={eqEnabled?"EQ is active":"EQ bypassed"}
        onClick={()=>navigate('/equalizer')}
        right={<div style={{display:'flex',alignItems:'center',gap:8}}><Toggle value={eqEnabled} onChange={e=>{e.stopPropagation();controls.toggleEQ()}}/><span style={{color:'var(--dimmed)',fontSize:16}}>›</span></div>}/>

      <Section title="PLAYBACK"/>
      <Row icon="🔁" label="Loop Mode"
        desc={loop==='none'?'Off':loop==='one'?'Repeat one track':'Repeat all'}
        right={
          <div style={{display:'flex',gap:4}}>
            {['none','one','all'].map(m=>(
              <button key={m} onClick={()=>controls.setLoop(m)}
                style={{background:loop===m?'var(--blue-dim)':'transparent',border:`1px solid ${loop===m?'var(--blue)':'var(--navy-border)'}`,color:loop===m?'var(--sky)':'var(--muted)',borderRadius:5,padding:'3px 8px',fontSize:10}}>
                {m==='none'?'Off':m==='one'?'1':'All'}
              </button>
            ))}
          </div>}/>
      <Row icon="⇄" label="Shuffle" desc="Play tracks in random order"
        right={<Toggle value={shuffle} onChange={()=>controls.toggleShuffle()}/>}/>
      <Row icon="⚡" label="Playback Speed" desc={`${playbackRate}× speed`}
        right={
          <select value={playbackRate} onChange={e=>controls.setPlaybackRate(parseFloat(e.target.value))}
            onClick={e=>e.stopPropagation()}
            style={{background:'var(--navy-light)',border:'1px solid var(--navy-border)',color:'var(--sky)',borderRadius:6,padding:'4px 8px',fontSize:11}}>
            {[0.5,0.75,1,1.25,1.5,2].map(s=><option key={s} value={s}>{s}×</option>)}
          </select>}/>
      <Row icon="🔊" label="Volume" desc={`${Math.round((isMuted?0:volume)*100)}%`}
        right={
          <input type="range" min={0} max={1} step={0.05} value={isMuted?0:volume}
            onChange={e=>controls.setVolume(parseFloat(e.target.value))}
            onClick={e=>e.stopPropagation()}
            style={{width:90,background:`linear-gradient(to right,var(--blue) ${(isMuted?0:volume)*100}%,var(--dimmed) ${(isMuted?0:volume)*100}%)`}}/>}/>

      <Section title="LIBRARY"/>
      <Row icon="📋" label="Playlists" desc="Manage your playlists" onClick={()=>navigate('/playlists')} right={<span style={{color:'var(--dimmed)',fontSize:16}}>›</span>}/>
      <Row icon="♥" label="Favorites" desc="Your favorited tracks" onClick={()=>navigate('/favorites')} right={<span style={{color:'var(--dimmed)',fontSize:16}}>›</span>}/>
      <Row icon="🕐" label="History" desc="Recently played" onClick={()=>navigate('/history')} right={<span style={{color:'var(--dimmed)',fontSize:16}}>›</span>}/>

      <Section title="DATA"/>
      <Row icon="🗑" label="Clear Play History" onClick={clearHist} right={<span style={{color:'var(--danger)',fontSize:16}}>›</span>} danger/>
      <Row icon="⊗" label="Clear Library & Start Over"
        desc="Removes all saved files and folder access"
        onClick={async()=>{ if(confirm('Clear entire library?')){ await controls.clearAll(); notify('Library cleared') }}}
        right={<span style={{color:'var(--danger)',fontSize:16}}>›</span>} danger/>

      {/* About */}
      <div style={{ padding:'28px 16px 16px',textAlign:'center' }}>
        <img src={logo} style={{ width:60,height:60,objectFit:'contain',borderRadius:12,marginBottom:10,filter:'drop-shadow(0 0 12px rgba(56,189,248,0.4))' }}/>
        <div style={{ fontSize:18,fontWeight:700,letterSpacing:3,color:'var(--sky)',textShadow:'0 0 16px rgba(56,189,248,0.5)',marginBottom:4 }}>APPISTREAM</div>
        <div style={{ fontSize:10,color:'var(--dimmed)',letterSpacing:1 }}>v2.1 · PWA · Offline Ready</div>
        <div style={{ fontSize:10,color:'var(--dimmed)',marginTop:2 }}>Audio & Video Media Player</div>
        <div style={{ fontSize:9,color:'var(--dimmed)',marginTop:6,opacity:0.6 }}>
          Audio chain: High-pass → Low-pass → Compressor → 10-band EQ
        </div>
      </div>
    </div>
  )
}
