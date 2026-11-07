// Bounded, versioned cosmetic slots. Extend a slot without changing player/network structure.
export const COSMETICS={
 build:['regular','slim','broad'],height:['average','short','tall'],headShape:['oval','round','square'],face:['soft','angular','wide'],
 hairstyle:['legacy','buzz','sidepart','long','braids','messy','mohawk'],eyeColor:['brown','blue','green','gray'],eyebrows:['natural','fine','bold'],nose:['straight','small','wide'],mouth:['neutral','smile','full'],facialHair:['none','stubble','beard','mustache'],makeup:['none','rose','plum'],
 headAccessory:['none','cap','beanie','hat','headphones'],faceAccessory:['none','glasses','sunglasses','mask'],earAccessory:['none','studs','hoops'],piercing:['none','nose','eyebrow'],neckAccessory:['none','chain','pendant'],wristAccessory:['none','watch','bracelet'],
 topStyle:['legacy','office','sweater','crop','tank','jersey','oversized'],outerwear:['none','jacket','blazer'],bottomStyle:['legacy','skirt','cargo','joggers'],shoeStyle:['legacy','boots','heels','sandals','casual'],
 leftArmTattoo:['none','bands','chevron','stars'],rightArmTattoo:['none','bands','chevron','stars'],neckTattoo:['none','bands','chevron','stars'],legTattoo:['none','bands','chevron','stars'],faceTattoo:['none','stars'],
} as const;
export type Cosmetics=Partial<{-readonly [K in keyof typeof COSMETICS]:typeof COSMETICS[K][number]}> & {highlight?:string;eyeTint?:string;shoeColor?:string;outerColor?:string};
export function cleanCosmetics(value:unknown):Cosmetics{const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>,out:Record<string,string>={};for(const [key,choices]of Object.entries(COSMETICS))out[key]=choices.includes(v[key] as never)?String(v[key]):choices[0];for(const key of ['highlight','eyeTint','shoeColor','outerColor'])if(typeof v[key]==='string'&&/^#[0-9a-f]{6}$/i.test(v[key] as string))out[key]=v[key] as string;return out as Cosmetics;}
