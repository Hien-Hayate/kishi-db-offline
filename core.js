(function(root){
  'use strict';
  const EVENTS=['','win','loss','promotion','demotion','absence','unknown'];
  // Legacy source metadata stays readable; these are not editable record events.
  const SOURCE_EVENTS=[...EVENTS,'demerit','declared','transferred'];
  const LABELS={win:'七番勝負勝利',loss:'七番勝負敗退',promotion:'昇級',demotion:'降級',absence:'休場',unknown:'色の意味未確認'};
  // Normal class fills in 順位2, excluding result highlights. B/C remain distinct labels.
  const CLASS_COLORS={'名':'#ffd966','A':'#f4b183','B':'#f8cbad','B1':'#f8cbad','B2':'#fce4d6','C':'#dae3f3','C1':'#dae3f3','C2':'#b4c7e7','宣言':'#e2efda','陥編':'#c6e0b4'};
  function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
  function ageAt(birth,date){if(!validDate(birth)||!validDate(date))return null;let a=Number(date.slice(0,4))-Number(birth.slice(0,4));if(date.slice(5)<birth.slice(5))a--;return a>=0?a:null;}
  function sourceEvent(db,r){return r?(db.palette[String(r.fill)]?.event??'unknown'):'';}
  function event(db,r){if(!r)return '';if(r.recordEvent!==undefined)return r.recordEvent;const e=sourceEvent(db,r);return ['demerit','declared','transferred'].includes(e)?'':e;}
  function displayClass(db,r){if(!r)return '';if(r.className!==undefined)return r.className;const e=sourceEvent(db,r);if(e==='declared')return '宣言';if(e==='transferred')return '陥編';return r.raw;}
  function classColor(db,r){return CLASS_COLORS[displayClass(db,r)]||'';}
  function titleStats(db,records){let appearances=0,wins=0;for(const r of records){const e=event(db,r);if(e==='win'){wins++;appearances++;}else if(e==='loss')appearances++;}return {appearances,wins};}
  function result(db,r){const e=event(db,r);if(e==='win')return r.role==='holder'?'名人防衛':r.role==='challenger'?'名人獲得':'七番勝負勝利';if(e==='loss')return r.role==='holder'?'防衛失敗':r.role==='challenger'?'獲得ならず':'七番勝負敗退';return LABELS[e]||'';}
  function describe(db,r){return result(db,r);}
  function index(db){const records=new Map(db.records.map(r=>[r.player+':'+r.period,r]));return {records,players:new Map(db.players.map(p=>[p.id,p])),periods:new Map(db.periods.map(p=>[p.id,p]))};}
  function validate(db){
    const fail=()=>{throw new Error('棋士DBのバックアップ形式に合いません。現在のデータは変更していません。');};
    const str=(s,n=1000)=>typeof s==='string'&&s.length<=n;
    if(!db||db.format!=='banjo-kishi-db'||db.schemaVersion!==1||!Array.isArray(db.players)||!Array.isArray(db.periods)||!Array.isArray(db.records)||!db.palette||typeof db.palette!=='object')fail();
    if(db.players.length>10000||db.periods.length>1000||db.records.length>300000||db.players.length===0||db.periods.length===0)fail();
    const ids=new Set(),ps=new Set(),keys=new Set();
    for(const p of db.players){if(!str(p.id,100)||!str(p.name,100)||!p.name.trim()||ids.has(p.id)||(p.birth!==null&&!validDate(p.birth))||(p.number!==null&&!str(p.number,100))||!str(p.proYear,100))fail();ids.add(p.id);}
    for(const p of db.periods){if(!Number.isInteger(p.id)||p.id<1||ps.has(p.id)||!Number.isInteger(p.fiscalYear)||!Number.isInteger(p.meijinYear)||!validDate(p.ageAt)||typeof p.ongoing!=='boolean'||!str(p.note))fail();ps.add(p.id);}
    for(const [id,p] of Object.entries(db.palette)){if(!/^\d+$/.test(id)||!p||!SOURCE_EVENTS.includes(p.event)||(p.color!==null&&!/^#[0-9a-f]{6}$/i.test(p.color)))fail();}
    for(const r of db.records){let key=r.player+':'+r.period;if(!ids.has(r.player)||!ps.has(r.period)||!str(r.raw,100)||!Number.isInteger(r.fill)||!Object.hasOwn(db.palette,String(r.fill))||keys.has(key)||(r.role!==undefined&&!['','holder','challenger'].includes(r.role))||(r.recordEvent!==undefined&&!EVENTS.includes(r.recordEvent))||(r.className!==undefined&&!str(r.className,100)))fail();keys.add(key);}
    return db;
  }
  const api={EVENTS,LABELS,CLASS_COLORS,validDate,ageAt,event,sourceEvent,displayClass,classColor,titleStats,result,describe,index,validate};
  root.KishiCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
