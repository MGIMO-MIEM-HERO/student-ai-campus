const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Check CSS delimiters without counting brackets inside comments, strings or escaped text.
// This is a structural guard, not a substitute for browser validation of CSS features.
function balancedCss(source){
  const stack=[],closing={')':'(',']':'[','}':'{'};
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='\\'){i++;continue;}
    if(char==='/'&&source[i+1]==='*'){
      const end=source.indexOf('*/',i+2);assert.notEqual(end,-1,'Unterminated CSS comment');i=end+1;continue;
    }
    if(char==='"'||char==="'"){
      const quote=char;let ended=false;
      while(++i<source.length){
        if(source[i]==='\\'){i++;continue;}
        if(source[i]===quote){ended=true;break;}
        assert.ok(!/[\r\n]/.test(source[i]),'Unescaped line break in CSS string');
      }
      assert.ok(ended,'Unterminated CSS string');continue;
    }
    if('([{'.includes(char))stack.push(char);
    else if(closing[char])assert.equal(stack.pop(),closing[char],`Unexpected ${char} at offset ${i}`);
  }
  assert.equal(stack.length,0,'Unclosed CSS delimiter');
}

test('CSS guard distinguishes escaped content from broken selectors and blocks',()=>{
  balancedCss('.x:is(.a,:not(.b)){content:"})]";background:url("data:text/plain,(}")}/* ] */');
  for(const broken of ['.x:where(:not(.a))){color:red}', '.x{color:red', '.x{content:"bad}', '/* missing end']){
    assert.throws(()=>balancedCss(broken));
  }
});

const cssDirectory=path.join(__dirname,'../public/css');
for(const filename of fs.readdirSync(cssDirectory).filter(name=>name.endsWith('.css'))){
  test(`${filename} has balanced selectors, declarations and strings`,()=>balancedCss(fs.readFileSync(path.join(cssDirectory,filename),'utf8')));
}
