import * as T from './vendor/three.module.js';

// Small, deterministic textures and shared geometry: detail without model downloads.
function surfaceTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
  let seed=417;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=(seed>>>24)/255;
    const grain=kind==='wood'?Math.sin(y*.72+Math.sin(x*.12)*.7)*9:kind==='grass'?(noise-.5)*26:0;
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
  // Match the renderer's quality profile; keep optional roof equipment off mobile.
  const mobile=matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory || 8)<=4;
  const materials=new Map(),textures=new Map(),batches=new Map(),labels=new Map();
  const geometries={box:new T.BoxGeometry(1,1,1),window:new T.PlaneGeometry(1,1),trunk:new T.CylinderGeometry(.65,1,1,8),crown:new T.IcosahedronGeometry(1,2),conifer:new T.ConeGeometry(1,1,10),hedge:new T.BoxGeometry(1,1,1,4,4,4)};
  // Round a shared unit box; instances retain a clipped, architectural hedge silhouette.
  const hedgePositions=geometries.hedge.attributes.position,corner=new T.Vector3(),offset=new T.Vector3();
  for(let i=0;i<hedgePositions.count;i++) {
    offset.fromBufferAttribute(hedgePositions,i);
    corner.copy(offset).clampScalar(-.34,.34);
    offset.sub(corner).normalize().multiplyScalar(.16).add(corner);
    hedgePositions.setXYZ(i,offset.x,offset.y,offset.z);
  }
  geometries.hedge.computeVertexNormals();
  function material(name,color,roughness=.8,metalness=0,texture) {
    if(!materials.has(name)) {
      if(texture&&!textures.has(texture))textures.set(texture,surfaceTexture(texture));
      materials.set(name,new T.MeshStandardMaterial({color,roughness,metalness,map:textures.get(texture)||null}));
    }
    return materials.get(name);
  }
  const m={
    stone:material('stone',0xe9e1d2,.86,0,'stone'),trim:material('trim',0xf6f3ec,.62),
    concrete:material('concrete',0x9c9d97,.92),plinth:material('plinth',0x7d817d,.82),
    roof:material('roof',0x8d9392,.9,0,'roof'),wood:material('wood',0xc09564,.57,0,'wood'),
    metal:material('metal',0x66767b,.4,.5),blue:material('blue',0x477184,.57),
    glass:material('glass',0x4d7891,.1,.62),glassLight:material('glass-light',0x9dbfd0,.14,.48),
    reveal:material('reveal',0x34434a,.83),green:material('green',0x4b7442,.88),
    leafLight:material('leaf-light',0x76a056,.86),leafWarm:material('leaf-warm',0x9aa857,.86),bark:material('bark',0x726047,.94),
    lawn:material('lawn',0x8eab72,.97,0,'grass'),paving:material('paving',0xd9d3c7,.92,0,'stone'),
    soil:material('soil',0x4c4537,.95),pot:material('pot',0xb6ab94,.85),
  };
  const lampMetal=material('lamp-metal',0x303c40,.38,.65);
  const lampGlow=material('lamp-glow',0xffe8bd,.45);
  lampGlow.emissive.setHex(0xffd69a);lampGlow.emissiveIntensity=.65;
  const windowCanvas=document.createElement('canvas');windowCanvas.width=windowCanvas.height=128;
  const wc=windowCanvas.getContext('2d');wc.fillStyle='#d6d6cc';wc.fillRect(0,0,128,128);
  wc.fillStyle='#37454b';wc.fillRect(7,7,114,111);
  const pane=wc.createLinearGradient(0,12,110,110);pane.addColorStop(0,'#b7cdd3');pane.addColorStop(.45,'#799aa8');pane.addColorStop(.46,'#6b8c9b');pane.addColorStop(1,'#425f71');
  wc.fillStyle=pane;wc.fillRect(15,14,98,96);
  wc.fillStyle='#ecebe0';for(const [x,y,w,h] of [[10,9,5,104],[113,9,5,104],[10,9,108,5],[10,110,108,6],[61,11,4,103],[12,40,104,3]])wc.fillRect(x,y,w,h);
  wc.fillStyle='#f3f1e9';wc.fillRect(4,116,120,6);wc.fillStyle='#8d948f';wc.fillRect(4,122,120,4);
  // Fine contact shadow beneath the pale sill, baked into the existing window plane.
  wc.fillStyle='#6e7d81';wc.fillRect(6,122,116,1);
  wc.fillStyle='#aab3af';wc.fillRect(6,123,116,1);
  const windowMap=new T.CanvasTexture(windowCanvas);windowMap.colorSpace=T.SRGBColorSpace;windowMap.anisotropy=4;
  m.windowFlat=new T.MeshStandardMaterial({map:windowMap,roughness:.24,metalness:.32});
  // Two shared sets preserve instancing and the same lit windows across LODs.
  const glowingWindows=[m.windowFlat,m.glass,m.glassLight].map((mat)=>{
    mat.emissive.setHex(0xffbd70);mat.emissiveIntensity=0;
    const glow=mat.clone();return glow;
  });
  function setEvening(evening) {
    glowingWindows.forEach((mat)=>{mat.emissiveIntensity=evening?.8:0;});
    lampGlow.emissiveIntensity=evening?1.8:.65;
    for(const name of ['floor-partitions','classroom-desks','classroom-board','terrazzo']) {
      const mat=materials.get(name);
      if(mat){mat.emissive.copy(mat.color);mat.emissiveIntensity=evening?.12:0;}
    }
  }
  let windowIndex=0;
  function instance(geometry,mat,x,y,z,w,h,d,rotation=0,detail=0,color) {
    if(w<=0||h<=0||d<=0)return;
    let list=batches.get(target);if(!list){list=[];batches.set(target,list);}
    let batch=list.find((b)=>b.geometry===geometry&&b.mat===mat&&b.detail===detail);
    if(!batch){batch={geometry,mat,detail,items:[]};list.push(batch);}
    batch.items.push({x,y,z,w,h,d,rotation,color});
  }
  const box=(x,y,z,w,h,d,mat=m.stone,rotation=0,detail=0)=>instance(geometries.box,mat,x,y,z,w,h,d,rotation,detail);
  // Street furniture shares four untextured batches, including instance tints.
  // Detail 1 receives light/shadows but avoids multiplying shadow-map draws.
  const streetMaterial=material('street-details',0xffffff,.8,.08);
  let streetGeometry;
  function streetPart(shape,x,y,z,w,h,d,color,rotation=0) {
    if(!streetGeometry) {
      const rounded=new T.BoxGeometry(1,1,1,2,2,2);
      const positions=rounded.attributes.position,p=new T.Vector3(),core=new T.Vector3();
      for(let i=0;i<positions.count;i++) {
        p.fromBufferAttribute(positions,i);core.copy(p).clampScalar(-.36,.36);
        p.sub(core).normalize().multiplyScalar(.14).add(core);
        positions.setXYZ(i,p.x,p.y,p.z);
      }
      rounded.computeVertexNormals();
      streetGeometry={box:geometries.box,rounded,
        cylinder:new T.CylinderGeometry(1,1,1,6),sphere:new T.SphereGeometry(1,6,4)};
    }
    instance(streetGeometry[shape],streetMaterial,x,y,z,w,h,d,rotation,1,color);
  }
  // Floor-wide box batches: one draw per finish, no chair/leg geometry.
  function classroom(x,z,w,d,side,seats,mobile=false) {
    const rotation={n:0,s:Math.PI,w:Math.PI/2,e:-Math.PI/2}[side];
    const vertical=side==='w'||side==='e',rw=vertical?d:w,rd=vertical?w:d;
    const desk=material('classroom-desks',0xc6aa83,.86);
    const board=material('classroom-board',0x354b46,.96);
    const part=(u,v,y,ww,hh,dd,mat)=>box(x+w/2+u*Math.cos(rotation)+v*Math.sin(rotation),y,z+d/2-u*Math.sin(rotation)+v*Math.cos(rotation),ww,hh,dd,mat,rotation,4);
    // Keep the board inside the outer wall and the corridor door clear.
    part(0,-rd/2+.09,.74,Math.min(rw*.65,1.8),.34,.045,board);
    if(mobile||rw<.65||rd<1.2)return;
    const usableW=rw-.3,front=-rd/2+.65,back=rd/2-.45;
    part(0,-rd/2+.35,.38,Math.min(usableW*.6,.85),.065,.27,desk);
    if(back<=front)return;
    if(seats>=60) {
      const rows=Math.min(6,Math.max(3,Math.ceil(seats/24)));
      for(let row=0;row<rows;row++) {
        const v=front+(row+.5)*(back-front)/rows;
        // Broad, progressively raised tiers read as a lecture amphitheatre.
        part(0,v,.13+row*.045,usableW*.9,.1+row*.09,Math.min(.3,(back-front)/rows*.65),desk);
      }
    } else {
      const cols=Math.max(1,Math.min(4,Math.floor(usableW/.65)));
      const maxRows=Math.max(1,Math.min(6,Math.floor((back-front)/.55)));
      const count=Math.min(24,Math.ceil(seats/2),cols*maxRows);
      const rows=Math.ceil(count/cols),dw=Math.min(.57,usableW/cols*.78);
      for(let i=0;i<count;i++) {
        const col=i%cols,row=Math.floor(i/cols);
        part(-usableW/2+(col+.5)*usableW/cols,front+(row+.5)*(back-front)/rows,.37,dw,.055,Math.min(.3,(back-front)/rows*.55),desk);
      }
    }
  }
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
  // Места посадки деревьев запоминаются, чтобы нарисовать под ними мягкое контактное затемнение.
  const treeSpots=[];
  function plant(x,z,y=0,scale=1,outdoor=false) {
    if(outdoor) {
      treeSpots.push([x,z,scale]);
      // Position hash keeps species and silhouette stable across rebuilds and groups.
      let seed=(Math.imul(Math.round(x*100),73856093)^Math.imul(Math.round(z*100),19349663))>>>0;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const conifer=random()<.25,size=scale*(.92+random()*.16),turn=random()*Math.PI*2;
      instance(geometries.trunk,m.bark,x,y+.7*size,z,.065*size,1.4*size,.065*size);
      if(conifer) {
        for(let i=0;i<3;i++) {
          const radius=.43-i*.105;
          instance(geometries.conifer,m.green,x,y+(1.12+i*.4)*size,z,radius*size,(1.02-i*.12)*size,radius*size,turn+i*.5);
        }
      } else {
        const count=6+Math.floor(random()*3);
        instance(geometries.crown,m.green,x,y+1.62*size,z,.43*size,.51*size,.42*size,turn);
        for(let i=1;i<count;i++) {
          const angle=turn+i*2.39996,radius=.23+random()*.13,r=.29+random()*.15;
          const dx=Math.cos(angle)*radius,dz=Math.sin(angle)*radius;
          const height=1.38+random()*.6;
          const leaf=i%3===0?m.leafLight:m.green;
          instance(geometries.crown,leaf,x+dx*size,y+height*size,z+dz*size,r*size,r*(1.05+random()*.3)*size,r*(.85+random()*.2)*size,angle);
        }
      }
      return;
    }
    if(!outdoor){instance(geometries.trunk,m.pot,x,y+.16*scale,z,.22*scale,.32*scale,.22*scale);box(x,y+.33*scale,z,.31*scale,.025,.31*scale,m.soil);}
    instance(geometries.trunk,m.bark,x,y+.5*scale,z,.045*scale,scale,.045*scale);
    const lobes=[[0,.68,0,.27],[-.14,.58,.06,.21],[.12,.59,-.1,.23]];
    const tone=Math.abs(Math.round(x*7.3+z*3.1))%5,leaves=tone===4?[m.leafWarm,m.leafLight]:tone>1?[m.green,m.leafLight]:[m.leafLight,m.green];
    lobes.forEach(([dx,dy,dz,r],i)=>instance(geometries.crown,leaves[i%2],x+dx*scale,y+dy*scale,z+dz*scale,r*scale,r*scale*1.12,r*scale,i*.9));
  }
  function lamp(x,z,y=0) {
    box(x,y+.79,z,.045,1.58,.045,lampMetal);
    box(x,y+1.57,z,.24,.07,.24,lampMetal);
    box(x,y+1.615,z,.18,.025,.18,lampGlow);
  }
  function hedge(x,z,w,d,y=0) {
    instance(geometries.hedge,m.green,x,y+.24,z,w,.48,d);
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
    const lit=(windowIndex++ % 5)<3;
    const [flat,glass,glassLight]=lit?glowingWindows:[m.windowFlat,m.glass,m.glassLight];
    instance(geometries.window,flat,x+Math.sin(rotation)*.075,y,z+Math.cos(rotation)*.075,w+.18,h+.2,1,rotation,3);
    const part=(dx,dy,dz,ww,hh,dd,mat)=>box(x+dx*Math.cos(rotation)+dz*Math.sin(rotation),y+dy,z-dx*Math.sin(rotation)+dz*Math.cos(rotation),ww,hh,dd,mat,rotation,2);
    part(0,0,0,w+.12,h+.13,.055,m.reveal);
    part(-w*.245,0,.04,w*.46,h,.025,variant%3?glass:glassLight);
    part(w*.245,0,.04,w*.46,h,.025,variant%4?glassLight:glass);
    for(const sign of [-1,1]){part(sign*(w/2+.025),0,.065,.05,h+.1,.06,m.trim);part(0,sign*(h/2+.025),.065,w+.1,.05,.06,m.trim);}
    part(0,0,.075,.028,h,.035,m.trim,1);
    part(0,h*.17,.075,w,.022,.035,m.trim,1);
    part(0,-h/2-.065,.09,w+.18,.055,.18,m.trim);
  }
  function flush() {
    const dummy=new T.Object3D();
    for(const [group,list] of batches)for(const batch of list) {
      const mesh=new T.InstancedMesh(batch.geometry,batch.mat,batch.items.length);
      batch.items.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,v.rotation,0);dummy.scale.set(v.w,v.h,v.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(v.color!==undefined)mesh.setColorAt(i,new T.Color(v.color));});
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      if(batch.detail===4)mesh.raycast=()=>{};
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
  /** Контактное затемнение: одна полупрозрачная плоскость с нарисованной на холсте картой AO (вместо теней-пятен под каждым объектом). */
  function addContact({minX,maxX,minZ,maxZ,y,draw}) {
    const w=maxX-minX,d=maxZ-minZ,res=mobile?512:1024,cw=res,ch=Math.max(64,Math.round(res*d/w));
    const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
    const ctx=canvas.getContext('2d');ctx.lineJoin='round';ctx.lineCap='round';
    draw(ctx,(x)=>(x-minX)/w*cw,(z)=>(z-minZ)/d*ch,cw/w);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set((minX+maxX)/2,y,(minZ+maxZ)/2);mesh.renderOrder=1;mesh.raycast=()=>{};mesh.userData.contact=true;
    target.add(mesh);return mesh;
  }
  /** Мягкая тень вдоль контура: несколько обводок с нарастающей шириной и малой прозрачностью. */
  function haloPath(ctx,S,reach,alpha) {
    for(let i=12;i>=1;i--) {ctx.strokeStyle=`rgba(18,26,20,${alpha})`;ctx.lineWidth=2*reach*S*(i/12)+1;ctx.stroke();}
  }
  function treeBlobs(ctx,X,Z,S,strength=.34) {
    for(const [x,z,scale] of treeSpots) {
      const r=Math.max(.55,.95*scale)*S,cx=X(x),cz=Z(z),g=ctx.createRadialGradient(cx,cz,0,cx,cz,r);
      g.addColorStop(0,`rgba(18,26,20,${strength})`);g.addColorStop(.55,`rgba(18,26,20,${strength*.45})`);g.addColorStop(1,'rgba(18,26,20,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cz,r,0,Math.PI*2);ctx.fill();
    }
  }
  return {m,mobile,addContact,haloPath,treeBlobs,setEvening,material,box,streetPart,classroom,prism,text,plant,lamp,hedge,bench,windowBay,flush,setGroup:(group)=>{target=group;}};
}

export function studioEnvironment() {
  const images=Array.from({length:6},(_,i)=>{
    const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,32);g.addColorStop(0,i===3?'#b9ad92':'#dbe9ef');g.addColorStop(.65,'#a9bcc3');g.addColorStop(1,'#bfb7a5');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
    if(i===0||i===4){ctx.fillStyle='#f5fafb';ctx.fillRect(5,2,12,22);}return c;
  });
  const texture=new T.CubeTexture(images);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
