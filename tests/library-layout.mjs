import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shelfLayout} from '../public/js/library-layout.js';

for(const count of [1,2,4,6,12])test(`rotating shelf keeps ${count} books separated throughout a full cycle`,()=>{
  for(const height of [245,340])for(const tiltX of [-6,0,6])for(const tiltY of [-9,0,9]){
    for(let step=0;step<=count*20;step++){
      const layout=shelfLayout(count+step/20,count,{height,spine:height*.16,depth:height*.7,gap:height*.03,tiltX,tiltY});
      for(let i=1;i<layout.length;i++)assert.ok(layout[i].left-layout[i-1].right>=height*.03-1e-7,`overlap at ${step/20}, tilt ${tiltX}/${tiltY}`);
    }
  }
});
test('the same book stays centered across the cyclic boundary',()=>{
  const options={height:340,spine:54.4,depth:238,gap:10.2};
  for(const position of [12,24,36,-12]){
    const item=shelfLayout(position,12,options).find(book=>book.r===0);
    assert.ok(Math.abs(item.left+item.right)<.0001);
  }
});
test('unused books retain the compact spine spacing',()=>{
  const options={height:340,spine:54.4,depth:238,gap:10.2};
  const layout=shelfLayout(12.4,12,options);
  for(let i=1;i<layout.length;i++)if(Math.abs(layout[i].r)>2&&Math.abs(layout[i-1].r)>2){
    const spacing=layout[i].x-layout[i-1].x;
    assert.ok(spacing>options.spine&&spacing<=options.spine+options.gap);
  }
});
