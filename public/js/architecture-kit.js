import * as T from './vendor/three.module.js';

// Small, deterministic textures and shared geometry: detail without model downloads.
function surfaceTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
  let seed=417;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=(seed>>>24)/255;
    const grain=kind==='wood'?Math.sin(y*.72+Math.sin(x*.12)*.7)*9:0;
    const joint=(kind==='stone'&&(y%32===0||x%64===((y>>5)%2)*32))||(kind==='roof'&&(y%64===0||x%64===0))?-11:0;
    const v=224+noise*13+grain+joint,i=(y*128+x)*4;
    image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  return texture;
}

export function createArchitectureKit(root) {
  let target=root;
  const materials=new Map(),textures=new Map(),batches=new Map(),labels=new Map();
  const geometries={box:new T.BoxGeometry(1,1,1),window:new T.PlaneGeometry(1,1),trunk:new T.CylinderGeometry(.65,1,1,8),crown:new T.IcosahedronGeometry(1,2)};
  function material(name,color,roughness=.8,metalness=0,texture) {
    if(!materials.has(name)) {
      if(texture&&!textures.has(texture))textures.set(texture,surfaceTexture(texture));
      materials.set(name,new T.MeshStandardMaterial({color,roughness,metalness,map:textures.get(texture)||null}));
    }
    return materials.get(name);
  }
  const m={
    stone:material('stone',0xd9d4c8,.88,0,'stone'),trim:material('trim',0xf0eee6,.7),
    concrete:material('concrete',0xa9aaa4,.92),plinth:material('plinth',0x8c8f89,.86),
    roof:material('roof',0x797f7d,.94,0,'roof'),wood:material('wood',0xc09564,.57,0,'wood'),
    metal:material('metal',0x66767b,.4,.5),blue:material('blue',0x477184,.57),
    glass:material('glass',0x608b9e,.2,.3),glassLight:material('glass-light',0xacc6cd,.28,.18),
    reveal:material('reveal',0x34434a,.83),green:material('green',0x55724f,.9),
    leafLight:material('leaf-light',0x758e5b,.9),bark:material('bark',0x726047,.94),
    lawn:material('lawn',0x859576,.95),paving:material('paving',0xd7d5cd,.94,0,'stone'),
    soil:material('soil',0x4c4537,.95),pot:material('pot',0xb6ab94,.85),
  };
  const windowCanvas=document.createElement('canvas');windowCanvas.width=windowCanvas.height=128;
  const wc=windowCanvas.getContext('2d');wc.fillStyle='#d6d6cc';wc.fillRect(0,0,128,128);
  wc.fillStyle='#37454b';wc.fillRect(7,7,114,111);
  const pane=wc.createLinearGradient(0,12,110,110);pane.addColorStop(0,'#b7cdd3');pane.addColorStop(.45,'#799aa8');pane.addColorStop(.46,'#6b8c9b');pane.addColorStop(1,'#425f71');
  wc.fillStyle=pane;wc.fillRect(15,14,98,96);
  wc.fillStyle='#ecebe0';for(const [x,y,w,h] of [[10,9,5,104],[113,9,5,104],[10,9,108,5],[10,110,108,6],[61,11,4,103],[12,40,104,3]])wc.fillRect(x,y,w,h);
  wc.fillStyle='#f3f1e9';wc.fillRect(4,116,120,6);wc.fillStyle='#8d948f';wc.fillRect(4,122,120,4);
  const windowMap=new T.CanvasTexture(windowCanvas);windowMap.colorSpace=T.SRGBColorSpace;windowMap.anisotropy=4;
  m.windowFlat=new T.MeshStandardMaterial({map:windowMap,roughness:.48,metalness:.08});
  function instance(geometry,mat,x,y,z,w,h,d,rotation=0,detail=0) {
    if(w<=0||h<=0||d<=0)return;
    let list=batches.get(target);if(!list){list=[];batches.set(target,list);}
    let batch=list.find((b)=>b.geometry===geometry&&b.mat===mat&&b.detail===detail);
    if(!batch){batch={geometry,mat,detail,items:[]};list.push(batch);}
    batch.items.push({x,y,z,w,h,d,rotation});
  }
  const box=(x,y,z,w,h,d,mat=m.stone,rotation=0,detail=0)=>instance(geometries.box,mat,x,y,z,w,h,d,rotation,detail);
  function prism(points,holes,height,bottom=0,cap=m.roof,side=m.stone,bevel=.025) {
    const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
    for(const pts of holes)shape.holes.push(new T.Path(pts.map(([x,z])=>new T.Vector2(x,-z))));
    const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});
    geometry.rotateX(-Math.PI/2);
    const mesh=new T.Mesh(geometry,[cap,side]);mesh.position.y=bottom;
    mesh.castShadow=mesh.receiveShadow=true;target.add(mesh);return mesh;
  }
  function text(value,x,y,z,size=1.3) {
    const list=labels.get(target)||[];list.push({value,x,y,z,size});labels.set(target,list);
  }
  function plant(x,z,y=0,scale=1,outdoor=false) {
    if(!outdoor){instance(geometries.trunk,m.pot,x,y+.16*scale,z,.22*scale,.32*scale,.22*scale);box(x,y+.33*scale,z,.31*scale,.025,.31*scale,m.soil);}
    instance(geometries.trunk,m.bark,x,y+.5*scale,z,.045*scale,scale,.045*scale);
    const lobes=outdoor?[[0,1.35,0,.45],[-.25,1.1,.08,.33],[.22,1.13,.18,.34],[.12,1.05,-.24,.35],[0,1.65,.05,.27]]:[[0,.68,0,.27],[-.14,.58,.06,.21],[.12,.59,-.1,.23]];
    lobes.forEach(([dx,dy,dz,r],i)=>instance(geometries.crown,i%2?m.leafLight:m.green,x+dx*scale,y+dy*scale,z+dz*scale,r*scale,r*scale*1.12,r*scale,i*.9));
  }
  function bench(x,z,y=0,rotation=0) {
    const part=(dx,dy,dz,w,h,d,mat)=>box(x+dx*Math.cos(rotation)+dz*Math.sin(rotation),y+dy,z-dx*Math.sin(rotation)+dz*Math.cos(rotation),w,h,d,mat,rotation);
    for(let i=0;i<4;i++)part(0,.38,i*.1,1.25,.045,.075,m.wood);
    part(-.45,.18,.15,.06,.36,.4,m.metal);part(.45,.18,.15,.06,.36,.4,m.metal);
    for(let i=0;i<3;i++)part(0,.57+i*.09,.4,1.25,.065,.04,m.wood);
  }
  // Opaque glass: recesses, two differently tinted panes, frame and a fine mullion.
  // All windows share these batches; thousands of parts are a handful of draws.
  function windowBay(x,y,z,w,h,rotation=0,variant=0) {
    instance(geometries.window,m.windowFlat,x+Math.sin(rotation)*.075,y,z+Math.cos(rotation)*.075,w+.18,h+.2,1,rotation,3);
    const part=(dx,dy,dz,ww,hh,dd,mat)=>box(x+dx*Math.cos(rotation)+dz*Math.sin(rotation),y+dy,z-dx*Math.sin(rotation)+dz*Math.cos(rotation),ww,hh,dd,mat,rotation,2);
    part(0,0,0,w+.12,h+.13,.055,m.reveal);
    part(-w*.245,0,.04,w*.46,h,.025,variant%3?m.glass:m.glassLight);
    part(w*.245,0,.04,w*.46,h,.025,variant%4?m.glassLight:m.glass);
    for(const sign of [-1,1]){part(sign*(w/2+.025),0,.065,.05,h+.1,.06,m.trim);part(0,sign*(h/2+.025),.065,w+.1,.05,.06,m.trim);}
    part(0,0,.075,.028,h,.035,m.trim,1);
    part(0,h*.17,.075,w,.022,.035,m.trim,1);
    part(0,-h/2-.065,.09,w+.18,.055,.18,m.trim);
  }
  function flush() {
    const dummy=new T.Object3D();
    for(const [group,list] of batches)for(const batch of list) {
      const mesh=new T.InstancedMesh(batch.geometry,batch.mat,batch.items.length);
      batch.items.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,v.rotation,0);dummy.scale.set(v.w,v.h,v.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.userData.detail=batch.detail;mesh.castShadow=batch.detail===0;mesh.receiveShadow=true;
      mesh.matrixAutoUpdate=false;group.add(mesh);
    }
    for(const [group,list] of labels) {
      const cols=8,rows=T.MathUtils.ceilPowerOfTwo(Math.ceil(list.length/cols));
      const c=document.createElement('canvas');c.width=cols*128;c.height=rows*64;
      const ctx=c.getContext('2d'),positions=[],uv=[],index=[];
      list.forEach((v,i)=>{
        const x=(i%cols)*128,y=Math.floor(i/cols)*64;
        ctx.fillStyle='#eeeae0';ctx.beginPath();ctx.roundRect(x+3,y+8,122,48,7);ctx.fill();
        ctx.strokeStyle='#d1d0c6';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#293d43';ctx.font='600 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(v.value,x+64,y+33,115);
        const w=v.size,h=w/2,first=i*4;
        positions.push(v.x-w/2,v.y,v.z+h/2,v.x+w/2,v.y,v.z+h/2,v.x+w/2,v.y,v.z-h/2,v.x-w/2,v.y,v.z-h/2);
        const u0=x/c.width,u1=(x+128)/c.width,v0=1-(y+64)/c.height,v1=1-y/c.height;
        uv.push(u0,v0,u1,v0,u1,v1,u0,v1);index.push(first,first+1,first+2,first,first+2,first+3);
      });
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);
      const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
      const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
      mesh.userData.labels=true;mesh.matrixAutoUpdate=false;group.add(mesh);
    }
    batches.clear();labels.clear();
  }
  return {m,material,box,prism,text,plant,bench,windowBay,flush,setGroup:(group)=>{target=group;}};
}

export function studioEnvironment() {
  const images=Array.from({length:6},(_,i)=>{
    const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,32);g.addColorStop(0,i===3?'#b9ad92':'#dbe9ef');g.addColorStop(.65,'#a9bcc3');g.addColorStop(1,'#bfb7a5');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
    if(i===0||i===4){ctx.fillStyle='#f5fafb';ctx.fillRect(5,2,12,22);}return c;
  });
  const texture=new T.CubeTexture(images);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
