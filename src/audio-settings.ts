export type AudioSettings={input:string;output:string;gain:number;master:number;voice:number;environment:number;music:number;ui:number;activation:boolean;threshold:number};
export const DEFAULT_AUDIO:AudioSettings={input:'default',output:'default',gain:1,master:1,voice:1,environment:1,music:.5,ui:1,activation:false,threshold:.025};
export function loadAudio():AudioSettings{try{return {...DEFAULT_AUDIO,...JSON.parse(localStorage.getItem('ooooffice.audio')||'{}')};}catch{return {...DEFAULT_AUDIO};}}
export class MicrophoneProcessor{
 name='Office input gain and voice gate';processedTrack?:MediaStreamTrack;private nodes:AudioNode[]=[];private timer?:ReturnType<typeof setInterval>;
 constructor(public settings:()=>AudioSettings){}
 async init({track,audioContext}:{track:MediaStreamTrack;audioContext?:AudioContext}){if(!audioContext)throw new Error('Audio processing is unavailable.');const source=audioContext.createMediaStreamSource(new MediaStream([track])),gain=audioContext.createGain(),analyser=audioContext.createAnalyser(),destination=audioContext.createMediaStreamDestination();analyser.fftSize=512;source.connect(analyser);source.connect(gain);gain.connect(destination);this.nodes=[source,gain,analyser,destination];this.processedTrack=destination.stream.getAudioTracks()[0];const samples=new Float32Array(512);let until=0;this.timer=setInterval(()=>{const s=this.settings();analyser.getFloatTimeDomainData(samples);const level=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);if(level>=s.threshold)until=performance.now()+180;gain.gain.setTargetAtTime(s.gain*(!s.activation||performance.now()<until?1:0),audioContext.currentTime,.015);},25);}
 async restart(options:{track:MediaStreamTrack;audioContext?:AudioContext}){await this.destroy();await this.init(options);}
 async destroy(){clearInterval(this.timer);this.nodes.forEach(n=>n.disconnect());this.nodes=[];this.processedTrack?.stop();this.processedTrack=undefined;}
}
