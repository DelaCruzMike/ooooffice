import {loadAudio} from './audio-settings';
let context:AudioContext|undefined;
export function playSound(kind:'ui'|'game'){
 try{context??=new AudioContext();if(context.state==='suspended')void context.resume();const s=loadAudio(),level=s.master*(kind==='ui'?s.ui:s.environment);if(!level)return;const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type=kind==='ui'?'sine':'triangle';osc.frequency.setValueAtTime(kind==='ui'?660:180,now);osc.frequency.exponentialRampToValueAtTime(kind==='ui'?440:70,now+.08);gain.gain.setValueAtTime(level*.045,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.1);osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(now+.11);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch{/* Audio is optional when the browser blocks playback. */}
}
