// 미니언 행동 점검: 추격 포기, 도움 요청, 미니언만 칠 때 무시. 사용법: node tools/minion-test.mjs
import * as S from '../js/sim.js';
const step=(G,sec)=>{for(let i=0;i<sec*60;i++){S.update(1/60);G.events.length=0;G.fxq.length=0;}};
function setup(){ const G=S.newGame({mode:'1v1',pick:'valkan',enemy:'kaira',diff:1}); const [p,e]=G.heroes; p.ctl='local'; e.ctl='local'; e.x=5700; step(G,13); return G; }
// A) 아군 미니언 없이 적 미니언 무리에 다가갔다가 도망
{ const G=setup(), p=G.player; G.units=G.units.filter(u=>!(u.kind==='minion'&&u.team===0)); const red=G.units.filter(u=>u.kind==='minion'&&u.team===1);
  const cx=red[0].x; p.x=cx-350; p.y=700; step(G,1.2); const aggro=red.filter(m=>m.target===p).length;
  S.cmd(p,{c:'move',x:200,y:700}); let maxChase=0; const start=red.map(m=>m.x);
  const drop=red.map(()=>null);
  for(let k=0;k<8*60;k++){S.update(1/60);G.events.length=0;G.fxq.length=0; red.forEach((m,i)=>{if(drop[i]===null&&m.target!==p)drop[i]={t:(k/60).toFixed(1),d:Math.round(start[i]-m.x)};});}
  console.log(`A) 영웅에게 붙은 미니언 ${aggro}/${red.length} · 도망치자 추격을 멈춘 시점/거리:`, drop.map(x=>x?x.t+'초 '+x.d:'계속').join(', ')); }
// B) 미니언끼리 싸우는 중 적 영웅을 때리면 근처 적 미니언이 나를 노림 (도움 요청)
{ const G=setup(), p=G.player, e=G.heroes[1]; step(G,12); const red=G.units.filter(u=>u.kind==='minion'&&u.team===1&&!u.dead);
  const fight=red[0]; e.x=fight.x+150; e.y=700; p.x=e.x-120; p.y=700; S.cmd(p,{c:'atk',id:e.id}); step(G,1.0);
  console.log(`B) 적 영웅을 때린 뒤 나를 노리는 적 미니언 ${red.filter(m=>!m.dead&&m.target===p).length}/${red.filter(m=>!m.dead).length}`); }
// C) 미니언끼리 싸우는 중 적 미니언만 때리면 미니언은 나를 무시
{ const G=setup(), p=G.player; step(G,12); const red=G.units.filter(u=>u.kind==='minion'&&u.team===1&&!u.dead);
  const m0=red[0]; p.x=m0.x-150; p.y=m0.y; S.cmd(p,{c:'atk',id:m0.id}); step(G,1.5);
  console.log(`C) 적 미니언을 칠 때 나를 노리는 적 미니언 ${red.filter(m=>!m.dead&&m.target===p).length}`); }
