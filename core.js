(function(root){
  'use strict';
  const EVENTS=['','win','loss','promotion','demerit','demotion','declared','transferred','absence','unknown'];
  const LABELS={win:'七番勝負勝利',loss:'七番勝負敗退',promotion:'昇級',demerit:'降級点あり',demotion:'降級',declared:'宣言',transferred:'陥編',absence:'休場',unknown:'色の意味未確認'};
  function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
  function ageAt(birth,date){if(!validDate(birth)||!validDate(date))return null;let a=Number(date.slice(0,4))-Number(birth.slice(0,4));if(date.slice(5)<birth.slice(5))a--;return a>=0?a:null;}
  function event(db,r){return r?db.palette[String(r.fill)]?.event||'unknown':'';}
  function displayClass(db,r){if(!r)return '';const e=event(db,r);if(e==='declared')return '宣言';if(e==='transferred')return '陥編';return r.raw;}
  function result(db,r){const e=event(db,r);if(e==='win')return r.role==='holder'?'名人防衛':r.role==='challenger'?'名人獲得':'七番勝負勝利';if(e==='loss')return r.role==='holder'?'防衛失敗':r.role==='challenger'?'獲得ならず':'七番勝負敗退';return LABELS[e]||'';}
  function describe(db,r,period){let s=result(db,r);if(event(db,r)==='demerit')s+='（'+(period.pointsBasis==='start'?'期首':'年度末')+'・点数未確認）';return s;}
  function index(db){const records=new Map(db.records.map(r=>[r.player+':'+r.period,r]));return {records,players:new Map(db.players.map(p=>[p.id,p])),periods:new Map(db.periods.map(p=>[p.id,p]))};}
  function validate(db){
    const fail=()=>{throw new Error('棋士DBのバックアップ形式に合いません。現在のデータは変更していません。');};
    const str=(s,n=1000)=>typeof s==='string'&&s.length<=n;
    if(!db||db.format!=='banjo-kishi-db'||db.schemaVersion!==1||!Array.isArray(db.players)||!Array.isArray(db.periods)||!Array.isArray(db.records)||!db.palette||typeof db.palette!=='object')fail();
    if(db.players.length>10000||db.periods.length>1000||db.records.length>300000||db.players.length===0||db.periods.length===0)fail();
    const ids=new Set(),ps=new Set(),keys=new Set();
    for(const p of db.players){if(!str(p.id,100)||!str(p.name,100)||!p.name.trim()||ids.has(p.id)||(p.birth!==null&&!validDate(p.birth))||(p.number!==null&&!str(p.number,100))||!str(p.proYear,100))fail();ids.add(p.id);}
    for(const p of db.periods){if(!Number.isInteger(p.id)||p.id<1||ps.has(p.id)||!Number.isInteger(p.fiscalYear)||!Number.isInteger(p.meijinYear)||!validDate(p.ageAt)||!['start','end'].includes(p.pointsBasis)||typeof p.ongoing!=='boolean'||!str(p.note))fail();ps.add(p.id);}
    for(const [id,p] of Object.entries(db.palette)){if(!/^\d+$/.test(id)||!p||!EVENTS.includes(p.event)||(p.color!==null&&!/^#[0-9a-f]{6}$/i.test(p.color)))fail();}
    for(const r of db.records){let key=r.player+':'+r.period;if(!ids.has(r.player)||!ps.has(r.period)||!str(r.raw,100)||!Number.isInteger(r.fill)||!Object.hasOwn(db.palette,String(r.fill))||keys.has(key)||(r.role!==undefined&&!['','holder','challenger'].includes(r.role)))fail();keys.add(key);}
    return db;
  }
  const api={EVENTS,LABELS,validDate,ageAt,event,displayClass,result,describe,index,validate};
  root.KishiCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
