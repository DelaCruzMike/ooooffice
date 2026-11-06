import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowRight, Armchair, Check, ChevronDown, ChevronRight, Coffee, DoorOpen, Gamepad2, Headphones, HelpCircle, Leaf, LockKeyhole, Map, Menu, MessageCircle, Mic, MicOff, Monitor, MoreHorizontal, Move, PanelRightClose, Plus, Send, Settings2, ShieldCheck, Smile, Sparkles, Users, Volume2, VolumeX, Waves, X, Shirt, LogOut, ExternalLink, LoaderCircle } from 'lucide-react';
import { OfficeScene } from './scene';
import { LocalPreview, PREVIEW_ID } from './preview';
import { api, auth, configured, OfficeConnection, OfficeVoice, type VoiceState } from './network';
import { ROOMS, SEATS, DEFAULT_AVATAR, cleanAvatar, roomAt, type Avatar, type Snapshot, type ChatMessage, type Player, type Vec, type WorkLink } from '../shared/world';
import type { Session } from '@supabase/supabase-js';
const INITIAL = new LocalPreview().snapshot;
const DEPARTMENTS = ROOMS.filter(r => r.seats);
const SHARED = ROOMS.filter(r => !r.seats);
const palettes = { skin: ['#f2d1b0','#d6a079','#bd875c','#a56f50','#754b37','#50362a'], hair: ['#3b2c28','#221f21','#75503a','#b08b55','#d4bd86','#8f9291'], shirt: ['#7c8871','#8c9fba','#cc9f79','#bba3c7','#e4ce94','#c68072'], trousers: ['#384a46','#40536a','#7f7562','#56505f','#b1a48c','#e0d8c5'] };
const loadAvatar = () => { try { return cleanAvatar(JSON.parse(localStorage.getItem('ooooffice.avatar') || 'null')); } catch { return DEFAULT_AVATAR; } };
const readWelcome = () => { try { return !localStorage.getItem('ooooffice.visited'); } catch { return true; } };
export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<OfficeScene | null>(null);
  const preview = useRef(new LocalPreview(loadAvatar()));
  const connection = useRef<OfficeConnection | null>(null);
  const voice = useRef<OfficeVoice | null>(null);
  const snapRef = useRef<Snapshot>(preview.current.snapshot);
  const idRef = useRef(PREVIEW_ID);
  const modeRef = useRef<'preview' | 'live'>('preview');
  const inputAt = useRef(0), uiAt = useRef(0);
  const actionsRef = useRef<(type: string, data?: Record<string, unknown>) => void>(() => {});
  const interactRef = useRef<() => void>(() => {});
  const [snapshot, setSnapshot] = useState<Snapshot>(preview.current.snapshot);
  const [myId, setMyId] = useState(PREVIEW_ID);
  const [mode, setMode] = useState<'preview' | 'live'>('preview');
  const [session, setSession] = useState<Session | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [rightOpen, setRightOpen] = useState(window.innerWidth > 1180);
  const [leftOpen, setLeftOpen] = useState(false);
  const [modal, setModal] = useState<'' | 'avatar' | 'map' | 'help' | 'settings' | 'admin' | 'game' | 'join'>('');
  const [welcome, setWelcome] = useState(readWelcome);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scope, setScope] = useState<'office' | 'room'>('office');
  const [draft, setDraft] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(loadAvatar);
  const [destination, setDestination] = useState('');
  const [emotesOpen, setEmotesOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [lowQuality, setLowQuality] = useState(window.innerWidth < 900);
  const [ptt, setPtt] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({ connected: false, microphone: false, deafened: false, busy: false, speaking: [], error: '', wanted: false });
  const [clock, setClock] = useState(new Date());
  const chatEnd = useRef<HTMLDivElement>(null);
  const me = snapshot.players.find(p => p.id === myId) || INITIAL.players[0];
  const currentRoom = ROOMS.find(r => r.id === me.room);
  const selectedRoom = ROOMS.find(r => r.id === destination);
  const nearest = SEATS.filter(s => !snapshot.players.some(p => p.id !== myId && p.seat === s.id)).sort((a,b) => Math.hypot(a.x-me.x,a.z-me.z) - Math.hypot(b.x-me.x,b.z-me.z))[0];
  const nearSeat = nearest && Math.hypot(nearest.x-me.x,nearest.z-me.z) < 3;
  const canPlay = me.room === 'recreation' && Math.hypot(me.x-14,me.z-1) < 6;
  function notify(text: string) { setNotice(text); }
  function updateSnapshot(s: Snapshot, id = idRef.current) {
    snapRef.current = s; idRef.current = id; setSnapshot({ ...s, players: [...s.players] }); setMyId(id); world.current?.sync(s, id); voice.current?.sync(s.players, id);
  }
  function action(type: string, data: Record<string, unknown> = {}) {
    if (modeRef.current === 'live') connection.current?.send(type, data);
    else {
      const message = preview.current.action(type, data); if (message) setMessages(m => [...m, message].slice(-100));
      updateSnapshot(preview.current.snapshot);
    }
  }
  actionsRef.current = action;
  function interact() {
    const state = snapRef.current, p = state.players.find(p => p.id === idRef.current); if (!p) return;
    const seats = SEATS.filter(s => !state.players.some(q => q.id !== p.id && q.seat === s.id)).sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
    if (p.seat) action('seat');
    else if (p.room === 'recreation' && Math.hypot(p.x-14,p.z-1) < 4) setModal('game');
    else if (seats[0] && Math.hypot(seats[0].x-p.x,seats[0].z-p.z) < 3) action('seat', { id: seats[0].id });
    else notify('Walk closer to a chair or the Connect Four table to interact.');
  }
  interactRef.current = interact;
  useEffect(() => {
    if (!canvas.current) return;
    try {
      const scene = new OfficeScene(canvas.current, { input: { x:0,z:0 }, local: true, locked: false, interact: () => interactRef.current(), emote: e => actionsRef.current('emote', { emote: e }), onMove: (position, direction) => {
        const now = performance.now();
        if (modeRef.current === 'preview') { preview.current.move(position, direction); if (now - uiAt.current > 150) { uiAt.current = now; const s = preview.current.snapshot; snapRef.current = s; setSnapshot({ ...s, players: [...s.players] }); } }
        else if (now - inputAt.current > 50) { inputAt.current = now; connection.current?.send('input', direction); }
      }, onFps: setFps });
      world.current = scene; scene.sync(preview.current.snapshot, PREVIEW_ID);
      voice.current = new OfficeVoice(setVoiceState, (t,d) => connection.current?.send(t,d));
      return () => { scene.dispose(); world.current = null; void voice.current?.disconnect(false); void connection.current?.disconnect(); };
    } catch { setConnectionError('Your browser could not start 3D graphics. Try an updated browser with hardware acceleration enabled.'); }
  }, []);
  useEffect(() => { if(world.current) { world.current.controls.paused = Boolean(modal); world.current.keys.clear(); world.current.stick = { x:0,z:0 }; } }, [modal]);
  useEffect(() => {
    if (!modal) return;
    const previous=document.activeElement as HTMLElement | null;
    const dialog=document.querySelector('[role="dialog"]') as HTMLElement | null;
    const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') || []).filter(el=>el.offsetParent!==null);
    focusable()[0]?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setModal('');}if(e.key==='Tab'){const items=focusable(),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.isConnected&&previous.focus();};
  }, [modal]);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, rightOpen]);
  useEffect(() => {
    if (!auth) return;
    void auth.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.auth.onAuthStateChange((_event, s) => { setSession(s); if (!s && modeRef.current === 'live') void leaveOffice(); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!ptt) return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea,select,button') && !e.repeat && modeRef.current === 'live') { e.preventDefault(); if (voice.current?.state.connected) void voice.current.microphone(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') void voice.current?.microphone(false); };
    const blur = () => { void voice.current?.microphone(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [ptt]);
  async function joinOffice() {
    if (connecting) return;
    if (!configured || !auth) { setModal('join'); return; }
    if (!session) {
      const { error } = await auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + import.meta.env.BASE_URL } });
      if (error) notify(error.message); return;
    }
    setConnecting(true); setConnectionError(''); setModal('');
    try {
      await connection.current?.disconnect();
      const client = new OfficeConnection(); connection.current = client;
      await client.connect(session, {
        snapshot: (s, id) => { modeRef.current = 'live'; setMode('live'); updateSnapshot(s,id); },
        chat: m => setMessages(v => [...v,m].slice(-100)), notice: notify,
        removed: text => { void leaveOffice(); setConnectionError(text); },
        disconnected: () => { void voice.current?.disconnect(false); setConnectionError('Connection interrupted. Rejoin the office to reconnect.'); },
        voiceZone: () => { void voice.current?.zoneChanged(); }, muted: text => { void voice.current?.forcedMute(text); },
      });
      setMessages([]); setWelcome(false);
    } catch (e) { setConnectionError((e as Error).message || 'The office could not connect. Please try again.'); }
    finally { setConnecting(false); }
  }
  async function leaveOffice() {
    await voice.current?.disconnect(false); await connection.current?.disconnect(); connection.current = null;
    modeRef.current = 'preview'; setMode('preview'); preview.current = new LocalPreview(loadAvatar()); setMessages([]); updateSnapshot(preview.current.snapshot,PREVIEW_ID);
  }
  function dismissWelcome() { setWelcome(false); try { localStorage.setItem('ooooffice.visited','true'); } catch { /* storage can be disabled */ } }
  function chooseRoom(id: string) { setDestination(id); setLeftOpen(false); setModal(''); }
  function mic() { if (mode === 'preview') { notify('Microphones connect in the live team office. This preview stays on your device.'); return; } if (voice.current) { voice.current.identity = myId; void voice.current.microphone(!voiceState.microphone); } }
  function listen() { if (mode === 'preview') { notify('Join your team office to listen and talk.'); return; } if (voiceState.connected) voice.current?.deafen(); else void voice.current?.connect(myId,false); }
  function submitChat(e: FormEvent) { e.preventDefault(); if (!draft.trim()) return; action('chat',{ text: draft, scope }); setDraft(''); }
  function saveAvatar() { action('avatar',{ avatar }); if (mode === 'preview') { try { localStorage.setItem('ooooffice.avatar',JSON.stringify(avatar)); } catch { /* optional local persistence */ } notify('Your preview look is saved on this device.'); } setModal(''); }
  const statusColor = me.status === 'available' ? '#7c986b' : me.status === 'busy' ? '#c3876a' : '#b4afa2';
  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open room directory" onClick={() => setLeftOpen(!leftOpen)}><Menu size={21}/></button>
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Ooooffice home"><span className="brand-mark"><i/><i/><i/><i/></span><span>ooo<span className="brand-light">office</span><span className="brand-dot">.</span></span></a>
      <div className="header-divider"/><span className="office-name">Our little corner <ChevronDown size={13}/></span>
      <div className={`connection-pill ${mode === 'live' ? 'live' : ''}`}><span className="tiny-dot"/>{mode === 'live' ? 'Team office' : 'Local preview'}</div>
      <div className="header-spacer"/>
      <span className="manila-clock">{clock.toLocaleTimeString('en-US',{ timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit' })}<span>Manila</span></span>
      <button className="icon-button" aria-label="Help and controls" onClick={() => setModal('help')}><HelpCircle size={19}/></button>
      {mode === 'preview' ? <button className="button primary small join-header" onClick={() => void joinOffice()} disabled={connecting}>{connecting ? <LoaderCircle size={15} className="spin"/> : <DoorOpen size={15}/>}<span>{connecting ? 'Opening office…' : session ? 'Enter team office' : 'Join your team'}</span></button> : <button className="icon-button" aria-label="Leave team office" title="Leave office" onClick={() => void leaveOffice()}><LogOut size={18}/></button>}
      <button className="profile-dot" aria-label="Customize your character" onClick={() => { setAvatar(me.avatar); setModal('avatar'); }} style={{ background:me.avatar.shirt }}>{me.name[0]}</button>
    </header>
    <div className="workspace">
      {leftOpen && <div className="sidebar-scrim" onClick={() => setLeftOpen(false)}/>}
      <aside className={`sidebar ${leftOpen ? 'open' : ''}`}>
        <div className="sidebar-head"><span className="eyebrow">YOUR WORKPLACE</span><span className="floor-tag">Floor 01</span></div>
        <div className="sidebar-title">A place for everyone.</div>
        <button className={`room-item hub ${me.room === 'lounge' ? 'current' : ''}`} onClick={() => chooseRoom('lounge')}><span className="room-icon"><Sparkles size={16}/></span><span>The commons<small>Start here, say hello</small></span><ChevronRight size={13}/></button>
        <div className="section-label">WORK ROOMS <span>07</span></div>
        <nav aria-label="Work rooms">{DEPARTMENTS.map(r => <button key={r.id} className={`room-item ${me.room === r.id ? 'current' : ''} ${destination === r.id ? 'destination' : ''}`} onClick={() => chooseRoom(r.id)}><span className="room-dot" style={{ background:r.color }}/><span>{r.short}</span><span className="room-count">{snapshot.players.filter(p => p.room === r.id).length}</span></button>)}</nav>
        <div className="section-label">BEYOND THE DESK <span>04</span></div>
        <nav aria-label="Shared rooms">{SHARED.filter(r => r.id !== 'lounge').map(r => <button key={r.id} className={`room-item ${me.room === r.id ? 'current' : ''} ${destination === r.id ? 'destination' : ''}`} onClick={() => chooseRoom(r.id)}><span className="shared-icon">{r.id === 'pantry' ? <Coffee size={16}/> : r.id === 'recreation' ? <Gamepad2 size={16}/> : r.id === 'smoking' ? <Leaf size={16}/> : snapshot.locked ? <LockKeyhole size={16}/> : <Users size={16}/>}</span><span>{r.short}</span><span className="room-count">{snapshot.players.filter(p => p.room === r.id).length}</span></button>)}</nav>
        <button className="floor-plan-button" onClick={() => setModal('map')}><Map size={16}/><span>Explore the floor plan</span><ArrowRight size={15}/></button>
        <div className="sidebar-bottom"><div className="little-note"><span>☀</span><p>Good work starts with<br/>good company.</p></div><button className="self-card" onClick={() => { setAvatar(me.avatar); setModal('avatar'); }}><span className="self-avatar" style={{ background:me.avatar.shirt }}>{me.name[0]}<i style={{ background:statusColor }}/></span><span><strong>{me.name}</strong><small>{mode === 'preview' ? 'Exploring the preview' : me.department}</small></span><Settings2 size={16}/></button></div>
      </aside>
      <main className="world-container" aria-label="Interactive 3D office">
        <canvas ref={canvas} tabIndex={0} aria-label="3D office. Use WASD or arrow keys to walk, drag to rotate the camera, and E to interact."/>
        <div className="world-top"><div className="location-label"><span className="location-icon"><DoorOpen size={17}/></span><div><span className="eyebrow">YOU'RE IN</span><strong>{currentRoom?.short || 'The hallway'}</strong></div><span className="location-divider"/><span className="location-count"><Users size={14}/>{snapshot.players.filter(p => p.room === me.room).length}</span></div><div className="world-top-actions"><span className="view-chip"><span className="tiny-dot"/> Third-person view</span><button className="icon-button frosted" aria-label="Graphics and audio settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button></div></div>
        {selectedRoom && <div className="wayfinding"><span className="direction-arrow">↗</span><span>Head to <strong>{selectedRoom.short}</strong><small>{Math.round(Math.hypot(selectedRoom.x-me.x,selectedRoom.z-me.z))} m from the room center · follow the floor plan</small></span><button className="icon-button" aria-label="Clear destination" onClick={() => setDestination('')}><X size={15}/></button></div>}
        {welcome && <div className="welcome-card"><div className="welcome-top"><span className="welcome-tag"><Leaf size={13}/> A LITTLE CLOSER</span><button className="icon-button" aria-label="Dismiss welcome" onClick={dismissWelcome}><X size={16}/></button></div><h1>Your people.<br/>Your place.</h1><p>A shared space to do good work,<br/>take a breather, and feel together.</p><button className="button primary" onClick={dismissWelcome}>Take a look around <ArrowRight size={16}/></button><span className="preview-explanation">Local preview · demo characters<br/>No microphone or account needed</span></div>}
        {connectionError && <div className="error-card" role="alert"><strong>{connecting ? 'Opening your office' : 'Office connection'}</strong><p>{connectionError}</p><button className="button small" onClick={() => void joinOffice()}>Try joining again</button><button className="icon-button" aria-label="Dismiss connection message" onClick={() => setConnectionError('')}><X size={16}/></button></div>}
        {connecting && <div className="loading-pill"><LoaderCircle className="spin" size={17}/>Opening the office… The free server may take a minute to wake up.</div>}
        {me.seat && <div className="workstation-card"><strong><Monitor size={16}/> Your workstation</strong><p>Take a breath. Set your status, then open your usual tools.</p>{snapshot.links.length ? snapshot.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={13}/></a>) : <p>{mode === 'preview' ? 'Team work links will appear here once the live office is connected.' : 'No work links yet. An administrator can add your team’s tools.'}</p>}<button className="button small" onClick={()=>action('seat')}>Stand up <Armchair size={14}/></button></div>}
        <div className="world-bottom"><div className="controls-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span className="hint-divider"/><span><Move size={13}/> Drag to look</span><span className="hint-divider"/><span>Scroll to zoom</span></div><div className="world-caption"><span className="tiny-dot"/>{mode === 'preview' ? 'A small preview of a bigger together.' : `${snapshot.players.length} / 50 teammates in the office`}</div></div>
        {(nearSeat || me.seat || canPlay) && !welcome && <button className="interact-prompt" onClick={interact}><kbd>E</kbd>{me.seat ? 'Stand up' : canPlay ? 'Play Connect Four' : 'Take a seat'}<Armchair size={16}/></button>}
        <div className="touch-controls"><TouchJoystick onMove={v => { if (world.current) world.current.stick=v; }}/><button className="touch-interact" onClick={interact} aria-label="Interact"><Armchair size={23}/></button></div>
        <button className="mini-map" onClick={() => setModal('map')} aria-label="Open office map"><MiniMap players={snapshot.players} myId={myId} small/><span><Map size={12}/> Floor 01 <ArrowDownLeft size={12}/></span></button>
      </main>
      <aside className={`activity-panel ${rightOpen ? 'open' : ''}`}>
        <div className="activity-heading"><div><span className="eyebrow">BETTER TOGETHER</span><h2>The office lounge</h2></div><button className="icon-button" aria-label="Close activity panel" onClick={() => setRightOpen(false)}><PanelRightClose size={17}/></button></div>
        <div className="activity-tabs"><button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}><MessageCircle size={15}/>Chat</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><Users size={15}/>{mode === 'preview' ? 'Characters' : 'People'}<span>{snapshot.players.length}</span></button></div>
        {tab === 'chat' ? <><div className="chat-scope"><button onClick={() => setScope(scope === 'office' ? 'room' : 'office')}>{scope === 'office' ? 'Everyone in the office' : currentRoom?.short || 'The hallway'}<ChevronDown size={13}/></button><span className="tiny-dot"/></div><div className="chat-messages"><div className="chat-intro"><span className="chat-illustration"><MessageCircle size={28}/><Sparkles size={16}/></span><h3>A hello goes a long way.</h3><p>{mode === 'preview' ? 'Try the chat here. Preview messages stay on this device, and demo characters don’t reply.' : 'Say hello, share a thought, or ask someone to grab a virtual coffee.'}</p><span className="chat-day">{clock.toLocaleDateString('en-US',{ timeZone:'Asia/Manila',month:'long',day:'numeric' })}</span></div>{messages.filter(m => m.scope === 'office' || m.room === me.room).map(m => <div className="chat-message" key={m.id}><span className="chat-avatar">{m.author[0]}</span><div><div className="message-byline"><strong>{m.author}</strong><time>{new Date(m.at).toLocaleTimeString('en-US',{ hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila' })}</time></div><p>{m.text}</p></div></div>)}<div ref={chatEnd}/></div><form className="chat-compose" onSubmit={submitChat}><input aria-label="Message" placeholder={scope === 'office' ? 'Say something nice…' : 'Message this room…'} value={draft} maxLength={500} onChange={e => setDraft(e.target.value)}/><button aria-label="Send message" disabled={!draft.trim()}><Send size={16}/></button></form><div className="chat-footnote"><LockKeyhole size={11}/>Live conversations. No saved history.</div></> : <div className="people-list"><p className="muted panel-description">{mode === 'preview' ? 'These are sample characters in your local preview.' : 'Find your teammates and adjust how you hear them.'}</p>{snapshot.players.map(p => <div className="person" key={p.id}><span className={`person-avatar ${voiceState.speaking.includes(p.id) ? 'speaking' : ''}`} style={{ background:p.avatar.shirt }}>{p.name[0]}<i className={p.status}/></span><div className="person-details"><strong>{p.name}{p.id === myId ? ' (you)' : ''}</strong><small>{ROOMS.find(r=>r.id===p.room)?.short || 'Hallway'} · {p.status}</small>{p.id !== myId && mode === 'live' && voiceState.connected && <label className="volume-label"><Volume2 size={12}/><input type="range" aria-label={`Volume for ${p.name}`} min="0" max="100" defaultValue="100" onChange={e=>voice.current?.setVolume(p.id,Number(e.target.value)/100)}/></label>}</div>{p.mic ? <Mic size={14}/> : <MicOff size={14} className="muted"/>}{me.role !== 'member' && p.role !== 'owner' && p.id !== myId && mode === 'live' && <button className="icon-button" aria-label={`Manage ${p.name}`} onClick={()=>setModal('admin')}><MoreHorizontal size={16}/></button>}</div>)}</div>}
        <div className="room-note"><span>✳</span><p>Different places.<br/><strong>Same team.</strong></p><span className="note-lines">⌁</span></div>
      </aside>
    </div>
    <footer className="toolbar"><div className="status-select"><span className="tiny-dot" style={{ background:statusColor }}/><select aria-label="Your availability" value={me.status} onChange={e=>action('status',{ status:e.target.value })}><option value="available">Available</option><option value="busy">Busy</option><option value="away">Away</option></select><ChevronDown size={12}/></div><div className="toolbar-divider"/><div className="toolbar-center"><button className={`tool-button ${voiceState.microphone ? 'on' : ''}`} onClick={mic} disabled={voiceState.busy} aria-label={voiceState.microphone ? 'Mute microphone' : 'Enable microphone'}>{voiceState.busy ? <LoaderCircle size={20} className="spin"/> : voiceState.microphone ? <Mic size={20}/> : <MicOff size={20}/>}<span>{voiceState.microphone ? 'Mic on' : 'Mic off'}</span></button><button className={`tool-button ${voiceState.connected && !voiceState.deafened ? 'on' : ''}`} onClick={listen} disabled={voiceState.busy} aria-label={voiceState.connected ? 'Toggle deafen' : 'Connect listening'}>{voiceState.deafened ? <VolumeX size={20}/> : <Headphones size={20}/>}<span>{voiceState.connected ? voiceState.deafened ? 'Deafened' : 'Listening' : 'Listen'}</span></button>{voiceState.connected && <button className="voice-leave" aria-label="Disconnect voice" title="Disconnect voice" onClick={()=>void voice.current?.disconnect()}><X size={12}/></button>}<div className="toolbar-divider"/><div className="emote-wrapper"><button className={`tool-button ${emotesOpen?'on':''}`} onClick={()=>setEmotesOpen(!emotesOpen)} aria-label="Open emotes"><Smile size={20}/><span>Emotes</span></button>{emotesOpen && <div className="emotes-menu"><button onClick={()=>{ action('emote',{ emote:'wave' });setEmotesOpen(false); }}>👋 Wave <kbd>1</kbd></button><button onClick={()=>{ action('emote',{ emote:'dance' });setEmotesOpen(false); }}>🕺 Dance <kbd>2</kbd></button><button onClick={()=>{ action('emote',{ emote:'' });setEmotesOpen(false); }}>✳ Reset pose</button></div>}</div><button className="tool-button" onClick={()=>{ setAvatar(me.avatar);setModal('avatar'); }} aria-label="Customize character"><Shirt size={20}/><span>Your look</span></button><button className="tool-button map-tool" onClick={()=>setModal('map')} aria-label="Open floor plan"><Map size={20}/><span>Floor plan</span></button><button className={`tool-button ${rightOpen?'on':''}`} onClick={()=>{setRightOpen(!rightOpen);setTab('chat');}} aria-label="Toggle chat"><MessageCircle size={20}/><span>Chat</span></button></div><div className="toolbar-right"><span className="fps-label">{fps ? `${fps} fps` : 'LOW POLY, HIGH SPIRITS'}</span>{mode === 'live' && me.role !== 'member' && <button className="icon-button" aria-label="Office administration" onClick={()=>setModal('admin')}><ShieldCheck size={19}/></button>}<button className="icon-button" aria-label="Settings" onClick={()=>setModal('settings')}><Settings2 size={19}/></button></div></footer>
    {(notice || voiceState.error) && <div className="toast" role="status"><span>{notice || voiceState.error}</span><button aria-label="Dismiss notification" onClick={()=>{setNotice('');voice.current?.update({error:''});}}><X size={15}/></button></div>}
    {modal && <div className="modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('');}}><section className={`modal ${modal==='map'?'wide':''}`} role="dialog" aria-modal="true" aria-label={modal==='avatar'?'Customize your character':modal==='map'?'Office floor plan':modal==='admin'?'Office administration':'Office options'}><button className="modal-close icon-button" aria-label="Close dialog" onClick={()=>setModal('')}><X size={20}/></button>
      {modal==='avatar' && <><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2>A little more you.</h2><p className="muted">Simple choices. Your own character.</p><div className="avatar-summary" style={{background:avatar.shirt+'30'}}><div className="paper-avatar"><div className="paper-hair" style={{background:avatar.hair}}/><div className="paper-head" style={{background:avatar.skin}}><i/><i/></div><div className="paper-body" style={{background:avatar.shirt}}/><div className="paper-legs" style={{background:avatar.trousers}}/></div><span>{mode==='preview'?'Saved on this device':'Saved with your account'}</span></div>{Object.entries(palettes).map(([key, colors])=><div className="color-field" key={key}><label>{key==='shirt'?'Top':key==='trousers'?'Bottoms':key[0].toUpperCase()+key.slice(1)}</label><div className="swatches">{colors.map(color=><button key={color} aria-label={`${key} ${color}`} className={avatar[key as keyof Avatar]===color?'selected':''} style={{background:color}} onClick={()=>setAvatar({...avatar,[key]:color})}>{avatar[key as keyof Avatar]===color&&<Check size={15}/>}</button>)}<input type="color" aria-label={`Custom ${key} color`} value={avatar[key as 'skin']} onChange={e=>setAvatar({...avatar,[key]:e.target.value})}/></div></div>)}<div className="form-grid"><label>Hairstyle<select aria-label="Hairstyle" value={avatar.style} onChange={e=>setAvatar({...avatar,style:e.target.value as Avatar['style']})}><option value="crop">Short crop</option><option value="bob">Bob</option><option value="bun">Bun</option></select></label><label>Accessory<select aria-label="Accessory" value={avatar.accessory} onChange={e=>setAvatar({...avatar,accessory:e.target.value as Avatar['accessory']})}><option value="none">Keep it simple</option><option value="glasses">Glasses</option><option value="cap">Cap</option></select></label></div><button className="button primary full" onClick={saveAvatar}>Save my look <Check size={16}/></button></>}
      {modal==='map' && <><span className="eyebrow">ONE FLOOR. PLENTY OF POSSIBILITY.</span><h2>Find your corner.</h2><p className="muted">Choose a room to set your destination. Walk through the marked doorway to enter.</p><MiniMap players={snapshot.players} myId={myId} onSelect={chooseRoom}/><div className="map-legend"><span><i style={{background:'#718564'}}/> You</span><span><i style={{background:'#c3a986'}}/> Teammates</span><span>50 workstations · 11 rooms & areas + commons</span></div></>}
      {modal==='help' && <><span className="eyebrow">SETTLE IN</span><h2>A quick way around.</h2><div className="help-list"><p><kbd>W A S D</kbd><span>Walk around. Arrow keys work too.</span></p><p><Move size={22}/><span>Drag the office to rotate your camera. Scroll or pinch to zoom.</span></p><p><kbd>E</kbd><span>Take a nearby seat, stand up, or open the game table.</span></p><p><kbd>1 / 2</kbd><span>Wave hello or have a little dance.</span></p><p><MicOff size={22}/><span>Your microphone starts off. Enable it when you want to talk.</span></p><p><LockKeyhole size={22}/><span>Nearby audio in shared areas. Separate conversations in enclosed rooms.</span></p></div><p className="muted">On a phone, use the lower-left joystick to walk, drag elsewhere to look, and tap the chair button to interact. Landscape gives you more space.</p><button className="button primary full" onClick={()=>setModal('')}>Got it. Let's go.</button></>}
      {modal==='settings' && <><span className="eyebrow">YOUR COMFORT ZONE</span><h2>Make space for you.</h2><label className="toggle-row"><span><strong>Low graphics</strong><small>Lower resolution for smoother movement.</small></span><input type="checkbox" checked={lowQuality} onChange={e=>{setLowQuality(e.target.checked);world.current?.setQuality(e.target.checked);}}/></label><label className="toggle-row"><span><strong>Push to talk</strong><small>Connect listening, then hold Space to speak on a computer.</small></span><input type="checkbox" checked={ptt} onChange={e=>{setPtt(e.target.checked);if(e.target.checked)void voice.current?.microphone(false);}}/></label>{(me.room === 'meeting' || me.role !== 'member') && <label className="toggle-row"><span><strong>Lock the meeting room</strong><small>{snapshot.locked ? 'New arrivals cannot enter. People inside can leave.' : snapshot.host && snapshot.host !== myId && me.role === 'member' ? 'Only the meeting host can lock this room.' : 'The first person to lock becomes the host.'}</small></span><input type="checkbox" checked={snapshot.locked} disabled={me.role === 'member' && Boolean(snapshot.host) && snapshot.host !== myId} onChange={e=>action('meeting',{locked:e.target.checked})}/></label>}<div className="setting-note"><LockKeyhole size={18}/><p>We don't record your audio or save text chat. {mode==='preview'?'This preview stays on your device.':'Your appearance is saved with your account.'}</p></div>{voiceState.connected&&<button className="button full" onClick={()=>void voice.current?.disconnect()}>Disconnect voice</button>}{session&&<button className="button full" onClick={async()=>{await leaveOffice();await auth?.auth.signOut();setModal('');}}>Sign out of Google session</button>}</>}
      {modal==='join' && <><span className="eyebrow">YOUR TEAM, UNDER ONE ROOF</span><h2>The office is taking shape.</h2><p className="muted">Live team sign-in and voice aren't connected to this installation yet. You can explore all the rooms, customize your character, and try the controls in the local preview.</p><div className="setting-note"><ShieldCheck size={22}/><p>When connected, only approved teammates can enter using Google sign-in.</p></div><button className="button primary full" onClick={()=>{setModal('');dismissWelcome();}}>Explore the preview <ArrowRight size={16}/></button></>}
      {modal==='game' && <><span className="eyebrow">A LITTLE FRIENDLY COMPETITION</span><h2>Four in a row.</h2><p className="muted">{mode==='preview'?'Explore the board here. A second real player is needed in the live office.':snapshot.game.winner?`${snapshot.players.find(p=>p.id===snapshot.game.players[snapshot.game.winner!-1])?.name||'Player'} wins!`:snapshot.game.draw?'A draw. Nice game.':snapshot.game.players.length<2?'Waiting for two players at the recreation table.':`${snapshot.players.find(p=>p.id===snapshot.game.players[snapshot.game.turn-1])?.name||'Player'}’s turn`}</p><div className="connect-board">{Array.from({length:7},(_,col)=><button className="game-column" key={col} aria-label={`Drop disc in column ${col+1}`} disabled={snapshot.game.players[snapshot.game.turn-1]!==myId||snapshot.game.players.length!==2||Boolean(snapshot.game.winner)||snapshot.game.draw||me.room!=='recreation'} onClick={()=>action('game:drop',{column:col})}>{Array.from({length:6},(_,row)=><i key={row} className={`disc disc-${snapshot.game.board[row*7+col]}`}/>)}</button>)}</div><div className="game-actions">{!snapshot.game.players.includes(myId)?<button className="button primary" disabled={!canPlay||snapshot.game.players.length>=2} onClick={()=>action('game:join')}>Join a seat</button>:<button className="button" onClick={()=>action('game:leave')}>Leave game</button>}{(snapshot.game.winner||snapshot.game.draw)&&snapshot.game.players.includes(myId)&&<button className="button primary" onClick={()=>action('game:reset')}>Play again</button>}<span className="muted">{snapshot.game.players.length}/2 players · spectators welcome</span></div>{!canPlay&&<p className="muted">Walk to the Connect Four table in the recreation room to join.</p>}</>}
      {modal==='admin' && <AdminPanel snapshot={snapshot} myId={myId} notice={notify}/>}
    </section></div>}
  </div>;
}
function MiniMap({players,myId,small=false,onSelect}:{players:Player[];myId:string;small?:boolean;onSelect?:(id:string)=>void}) {
  const occupied=(id:string)=>players.filter(p=>p.room===id).length;
  return <svg viewBox="-42 -34 86 72" className={`office-map ${small?'small':''}`} role="img" aria-label="Single floor office map"><rect x="-41" y="-32" width="84" height="68" rx="2" fill="#ded8c8"/>{ROOMS.map(r=><g key={r.id} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={r.name} onClick={()=>onSelect?.(r.id)} onKeyDown={e=>{if(e.key==='Enter')onSelect?.(r.id);}} className={onSelect?'map-room':''}><rect x={r.x-r.w/2+.4} y={r.z-r.d/2+.4} width={r.w-.8} height={r.d-.8} rx=".8" fill={r.color} fillOpacity=".57" stroke="#fcfaf4" strokeWidth=".5"/>{!small&&<><text x={r.x} y={r.z-.5} textAnchor="middle" fontSize="1.75" fill="#414e41" fontWeight="600">{r.id==='social'?'Social Media':r.id==='csr'?'CSR':r.id==='qa'?'QA':r.id==='recreation'?'Recreation':r.short}</text><text x={r.x} y={r.z+2.4} textAnchor="middle" fontSize="1.2" fill="#666e5b">{occupied(r.id)} here{r.seats?` · ${r.seats} desks`:''}</text></>}</g>)}{players.map(p=><g key={p.id}>{p.id===myId&&<circle cx={p.x} cy={p.z} r={small?3:2} fill="#718564" opacity=".2"/>}<circle cx={p.x} cy={p.z} r={small?1.5:.85} fill={p.id===myId?'#536e47':'#b58f68'} stroke="#faf7ed" strokeWidth=".4"/></g>)}</svg>;
}
function TouchJoystick({onMove}:{onMove:(v:Vec)=>void}) {
  const [position,setPosition]=useState({x:0,y:0}); const active=useRef<number|null>(null);
  const end=()=>{active.current=null;setPosition({x:0,y:0});onMove({x:0,z:0});};
  return <div className="joystick" role="slider" aria-label="Touch movement joystick" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={position.y/30} onPointerDown={e=>{active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(active.current!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();let x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;const length=Math.hypot(x,y);if(length>30){x*=30/length;y*=30/length;}setPosition({x,y});onMove({x:x/30,z:y/30});}} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}><span style={{transform:`translate(${position.x}px,${position.y}px)`}}><Plus size={18}/></span></div>;
}
function AdminPanel({snapshot,myId,notice}:{snapshot:Snapshot;myId:string;notice:(s:string)=>void}) {
  const [members,setMembers]=useState<{email:string;role:string;approved:boolean;department:string}[]>([]);const [email,setEmail]=useState('');const [role,setRole]=useState('member');const [department,setDepartment]=useState('Team');const [links,setLinks]=useState<WorkLink[]>(snapshot.links);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const owner=snapshot.players.find(p=>p.id===myId)?.role==='owner';
  const refresh=async()=>{try{const data=await api('/admin/members');setMembers(data.members);}catch(e){setError((e as Error).message);}};
  useEffect(()=>{void refresh();},[]);
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();notice('Office settings updated.');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <><span className="eyebrow">OFFICE ADMINISTRATION</span><h2>Keep the door right.</h2>{error&&<p role="alert" className="inline-error">{error}</p>}<h3>Approve a teammate</h3><form onSubmit={e=>{e.preventDefault();void run(()=>api('/admin/members',{email,role,department,approved:true}));}} className="admin-form"><label>Google email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="teammate@example.com"/></label><div className="form-grid"><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option>Team</option>{DEPARTMENTS.map(r=><option key={r.id}>{r.name}</option>)}</select></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="member">Member</option>{owner&&<option value="administrator">Administrator</option>}</select></label></div><button className="button primary" disabled={busy}>Approve email</button></form><div className="admin-members">{members.map(m=><div key={m.email}><span><strong>{m.email}</strong><small>{m.role} · {m.approved?'approved':'revoked'}</small></span>{m.role!=='owner'&&<button className="button small" disabled={busy} onClick={()=>void run(()=>api('/admin/members',{...m,approved:!m.approved}))}>{m.approved?'Revoke':'Approve'}</button>}</div>)}</div><h3>Current participants</h3><div className="admin-members">{snapshot.players.filter(p=>p.id!==myId&&p.role!=='owner').map(p=><div key={p.id}><strong>{p.name}</strong><div><button className="button small" disabled={busy} onClick={()=>void run(()=>api('/admin/participant',{id:p.id,action:'mute'}))}>Mute</button><button className="button small" disabled={busy} onClick={()=>void run(()=>api('/admin/participant',{id:p.id,action:'remove'}))}>Remove</button></div></div>)}</div><h3>Work links</h3><p className="muted">Links open in a new tab when teammates are seated.</p>{links.map((link,i)=><div className="link-editor" key={i}><input aria-label={`Link ${i+1} title`} placeholder="Title" value={link.label} onChange={e=>setLinks(links.map((l,n)=>n===i?{...l,label:e.target.value}:l))}/><input aria-label={`Link ${i+1} URL`} placeholder="https://…" value={link.url} onChange={e=>setLinks(links.map((l,n)=>n===i?{...l,url:e.target.value}:l))}/><button className="icon-button" aria-label={`Delete link ${i+1}`} onClick={()=>setLinks(links.filter((_,n)=>n!==i))}><X size={15}/></button></div>)}<div className="game-actions"><button className="button small" disabled={links.length>=12} onClick={()=>setLinks([...links,{label:'',url:''}])}><Plus size={14}/>Add link</button><button className="button primary small" disabled={busy} onClick={()=>void run(()=>api('/admin/links',{links}))}>Save links</button></div><div className="setting-note"><ShieldCheck size={18}/><p>Revoking membership removes live access. Removing a participant ends their current visit; their approved account can join again.</p></div></>;
}
