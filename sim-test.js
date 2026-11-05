const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||'index.html','utf8');
const script=html.split('<script>')[1].split('</script>')[0];
const noop=()=>{};
const ctxStub=new Proxy({},{get(t,k){if(k==='measureText')return()=>({width:10});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});if(k in t)return t[k];return noop;},set(t,k,v){t[k]=v;return true;}});
const el=()=>({getContext:()=>ctxStub,style:{},classList:{add:noop,remove:noop},addEventListener:noop,innerHTML:'',querySelectorAll:()=>[],set onclick(v){}});
const els={};
const sandbox={console,Math,Object,Set,Array,String,JSON,parseInt,setTimeout:(f)=>{sandbox.__end=f;},
 document:{getElementById:id=>els[id]||(els[id]=el())},
 window:{addEventListener:noop,innerWidth:1400,innerHeight:820,devicePixelRatio:1},
 performance:{now:()=>Date.now()},requestAnimationFrame:noop};
vm.createContext(sandbox);
vm.runInContext(script+'\n;globalThis.T={newGame,update,render,get G(){return G}};',sandbox);
const T=sandbox.T;let results=[];
for(let run=0;run<Number(process.argv[3]||4);run++){
 T.newGame('random',1);T.G.player.autopilot=true;T.G.player.isPlayer=false;
 const dt=1/30;let steps=0;
 while(!T.G.over&&T.G.t<45*60){T.update(dt);steps++;if(steps%300===0)T.render();}
 const G=T.G;
 results.push({run,diff:run%3,min:(G.t/60).toFixed(1),over:G.over,kills:G.kills.join(':'),
  towers:[0,1].map(t=>['outer','inner','nexus'].map(k=>G.struct[t][k].dead?'X':'o').join('')).join(' '),
  lv:G.heroes.map(h=>h.level).join(','),items:G.heroes[0].items.length});
}
console.table(results);
