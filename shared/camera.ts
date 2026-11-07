export type CameraSettings={sensitivity:number;invertX:boolean;invertY:boolean};
export const DEFAULT_CAMERA:CameraSettings={sensitivity:1,invertX:false,invertY:false};
export function lookDelta(x:number,y:number,s:CameraSettings,scale=.003){return {yaw:x*scale*s.sensitivity*(s.invertX?-1:1),pitch:y*scale*s.sensitivity*(s.invertY?-1:1)};}
export function wavePose(t:number){const blend=Math.min(1,t/.3,Math.max(0,(3-t)/.35));return {shoulder:1.05*blend,elbow:(1.5+Math.sin(t*8)*.22)*blend};}
