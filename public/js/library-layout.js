// Pack the projected bounds of the rotating books, including perspective.
// Each corner is affine in the book's horizontal translation: screenX = a*x + b.
export function shelfLayout(position, count, {height, spine, depth, gap, tiltX=0, tiltY=0, perspective=2200}) {
  const cycle=count*3, mod=(n,m)=>(n%m+m)%m, rad=Math.PI/180;
  const items=Array.from({length:cycle},(_,v)=>{
    const r=mod(v-position+cycle/2,cycle)-cycle/2;
    const k=Math.max(0,1-Math.abs(r)), open=k*k*(3-2*k);
    const yaw=(-90+tiltY)*open*rad, pitch=tiltX*open*rad, roll=-4.5*open*rad;
    const corners=[],spineCorners=[];
    for(const x of [-spine/2,spine/2])for(const y of [-height/2,height/2])for(const z of [-depth/2,depth/2]){
      const xx=x*Math.cos(yaw)+z*Math.sin(yaw), zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
      const yy=y*Math.cos(pitch)-zz*Math.sin(pitch), zzz=y*Math.sin(pitch)+zz*Math.cos(pitch);
      const worldX=xx*Math.cos(roll)-yy*Math.sin(roll);
      const a=perspective/(perspective-zzz-open*(depth*.5+height*.2));
      const corner={a,b:worldX*a};
      corners.push(corner);
      if(z===depth/2)spineCorners.push(corner);
    }
    return {v,r,open,corners,spineCorners};
  }).sort((a,b)=>a.r-b.r);
  // Closed books keep the original compact row of spines. Reserve the full
  // volume only around a turning cover; hidden side faces do not widen the row.
  const faces=(item,solid=false)=>solid||item.open>0?item.corners:item.spineCorners;
  const bounds=(item,x,solid=false)=>{const points=faces(item,solid).map(c=>c.a*x+c.b);return {left:Math.min(...points),right:Math.max(...points)};};
  const rightOf=(item,edge,solid=false)=>Math.max(...faces(item,solid).map(c=>(edge+gap-c.b)/c.a));
  const leftOf=(item,edge,solid=false)=>Math.min(...faces(item,solid).map(c=>(edge-gap-c.b)/c.a));
  const anchor=items.findIndex(item=>item.r<=0&&item.r>-1), fraction=-items[anchor].r;
  const pair=(x)=>{
    const a=bounds(items[anchor],x), nx=rightOf(items[anchor+1],a.right), b=bounds(items[anchor+1],nx);
    return {center:(1-fraction)*(a.left+a.right)/2+fraction*(b.left+b.right)/2,nx};
  };
  let lo=-10000,hi=10000;
  for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(pair(mid).center<0)lo=mid;else hi=mid;}
  items[anchor].x=(lo+hi)/2;
  for(let i=anchor+1;i<items.length;i++){
    const solid=items[i].open>0||items[i-1].open>0;
    items[i].x=rightOf(items[i],bounds(items[i-1],items[i-1].x,solid).right,solid);
  }
  for(let i=anchor-1;i>=0;i--){
    const solid=items[i].open>0||items[i+1].open>0;
    items[i].x=leftOf(items[i],bounds(items[i+1],items[i+1].x,solid).left,solid);
  }
  return items.map(item=>({...item,...bounds(item,item.x)}));
}
