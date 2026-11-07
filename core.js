(function(root){
  'use strict';
  const EVENTS=['','win','loss','promotion','demotion','absence','unknown'];
  // Legacy source metadata stays readable; these are not editable record events.
  const SOURCE_EVENTS=[...EVENTS,'demerit','declared','transferred'];
  const LABELS={win:'七番勝負勝利',loss:'七番勝負敗退',promotion:'昇級',demotion:'降級',absence:'休場',unknown:'色の意味未確認'};
  // Normal class fills in 順位2, excluding result highlights. B/C remain distinct labels.
  const CLASS_COLORS={'名':'#ffd966','A':'#f4b183','B':'#f8cbad','B1':'#f8cbad','B2':'#fce4d6','C':'#dae3f3','C1':'#dae3f3','C2':'#b4c7e7','宣言':'#e2efda','陥編':'#c6e0b4'};
  const RYUO_COLORS={'竜':'#ffd966','1組':'#f4b183','2組':'#f8cbad','3組':'#fce4d6','4組':'#dae3f3','5組':'#b4c7e7','6組':'#8faadc','シ':'#ede4d1'};
  const ryuoCache=new WeakMap();
  function ryuoMap(db){if(!ryuoCache.has(db))ryuoCache.set(db,new Map((db.ryuo?.records||[]).map(r=>[r.player+':'+r.period,r])));return ryuoCache.get(db);}
  function ryuoResult(db,r){
    if(!r)return '';const next=ryuoMap(db).get(r.player+':'+(r.period+1));
    if(!next)return '';const nextClass=displayClass(db,next);if(!nextClass)return '';
    if(nextClass==='竜')return 'win';
    if(displayClass(db,r)==='竜'||r.challenger)return 'loss';return '';
  }
  function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
  function ageAt(birth,date){if(!validDate(birth)||!validDate(date))return null;let a=Number(date.slice(0,4))-Number(birth.slice(0,4));if(date.slice(5)<birth.slice(5))a--;return a>=0?a:null;}
  function sourceEvent(db,r){return r?(db.palette[String(r.fill)]?.event??'unknown'):'';}
  function event(db,r){if(!r)return '';if(r.recordEvent!==undefined)return r.recordEvent;if(r.competition==='ryuo')return ryuoResult(db,r);const e=sourceEvent(db,r);return ['demerit','declared','transferred'].includes(e)?'':e;}
  function displayClass(db,r){if(!r)return '';if(r.className!==undefined)return r.className;if(r.competition==='ryuo')return /^[1-6]$/.test(r.raw)?r.raw+'組':r.raw;const e=sourceEvent(db,r);if(e==='declared')return '宣言';if(e==='transferred')return '陥編';return r.raw;}
  function classColor(db,r){return (r?.competition==='ryuo'?RYUO_COLORS:CLASS_COLORS)[displayClass(db,r)]||'';}
  function titleStats(db,records){let appearances=0,wins=0;for(const r of records){const e=event(db,r);if(e==='win'){wins++;appearances++;}else if(e==='loss')appearances++;}return {appearances,wins};}
  function result(db,r){const e=event(db,r);if(r?.competition==='ryuo')return LABELS[e]||'';if(e==='win')return r.role==='holder'?'名人防衛':r.role==='challenger'?'名人獲得':'七番勝負勝利';if(e==='loss')return r.role==='holder'?'防衛失敗':r.role==='challenger'?'獲得ならず':'七番勝負敗退';return LABELS[e]||'';}
  function describe(db,r){if(r?.competition==='ryuo')return [r.qualified?'挑決':'',r.groupWinner?'組優勝':'',result(db,r)].filter(Boolean).join('・');return result(db,r);}
  function matchesEvent(db,r,e){if(!e)return true;if(e==='qualified')return !!r?.qualified;if(e==='groupWinner')return !!r?.groupWinner;return event(db,r)===e;}
  function index(db){const records=new Map(db.records.map(r=>[r.player+':'+r.period,r]));return {records,ryuoRecords:ryuoMap(db),players:new Map(db.players.map(p=>[p.id,p])),periods:new Map(db.periods.map(p=>[p.id,p])),ryuoPeriods:new Map((db.ryuo?.periods||[]).map(p=>[p.id,p]))};}
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
    if(db.ryuo!==undefined){
      if(!db.ryuo||!Array.isArray(db.ryuo.periods)||!Array.isArray(db.ryuo.records)||db.ryuo.periods.length>1000||db.ryuo.records.length>300000)fail();
      const rp=new Set(),anchors=new Set(),rk=new Set();
      for(const p of db.ryuo.periods){const anchor=db.periods.find(j=>j.id===p.junniPeriod);if(!Number.isInteger(p.id)||p.id<1||rp.has(p.id)||anchors.has(p.junniPeriod)||!anchor||p.ageAt!==anchor.ageAt||typeof p.ongoing!=='boolean'||!str(p.note))fail();rp.add(p.id);anchors.add(p.junniPeriod);}
      for(const r of db.ryuo.records){const key=r.player+':'+r.period;if(r.competition!=='ryuo'||!ids.has(r.player)||!rp.has(r.period)||rk.has(key)||!str(r.raw,100)||!Number.isInteger(r.fill)||!Object.hasOwn(db.palette,String(r.fill))||typeof r.qualified!=='boolean'||typeof r.groupWinner!=='boolean'||typeof r.challenger!=='boolean'||(r.recordEvent!==undefined&&!EVENTS.includes(r.recordEvent))||(r.className!==undefined&&!str(r.className,100)))fail();rk.add(key);}
    }
    return db;
  }
  function mergeRyuo(current,incoming){
    validate(current);validate(incoming);if(!incoming.ryuo)throw new Error('竜王戦の追加データがありません。');
    if(!current.source?.sha256||current.source.sha256!==incoming.source?.sha256)throw new Error('取り込み元の棋士データが一致しません。現在のデータは変更していません。');
    const next=JSON.parse(JSON.stringify(current)),known=new Map(next.players.map(p=>[p.id,p]));
    const incomingPlayers=new Map(incoming.players.map(p=>[p.id,p]));
    for(const r of incoming.ryuo.records){if(!known.has(r.player)){const p=JSON.parse(JSON.stringify(incomingPlayers.get(r.player)));next.players.push(p);known.set(p.id,p);}}
    if(!next.ryuo)next.ryuo={...JSON.parse(JSON.stringify(incoming.ryuo)),records:[]};
    const periods=new Map(next.ryuo.periods.map(p=>[p.id,p]));
    for(const p of incoming.ryuo.periods)if(!periods.has(p.id)){next.ryuo.periods.push(JSON.parse(JSON.stringify(p)));periods.set(p.id,p);}
    next.ryuo.periods.sort((a,b)=>a.id-b.id);
    const keys=new Set(next.ryuo.records.map(r=>r.player+':'+r.period));let added=0,kept=0;
    for(const r of incoming.ryuo.records){const key=r.player+':'+r.period;if(keys.has(key)){kept++;continue;}next.ryuo.records.push(JSON.parse(JSON.stringify(r)));keys.add(key);added++;}
    delete next.delivery;validate(next);return {data:next,added,kept};
  }
  const api={EVENTS,LABELS,CLASS_COLORS,RYUO_COLORS,validDate,ageAt,event,sourceEvent,displayClass,classColor,titleStats,result,describe,matchesEvent,index,validate,mergeRyuo};
  root.KishiCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
