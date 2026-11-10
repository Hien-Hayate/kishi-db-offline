(function(root){
  'use strict';
  const EVENTS=['','win','loss','promotion','demotion','absence','unknown'];
  // Legacy source metadata stays readable; these are not editable record events.
  const SOURCE_EVENTS=[...EVENTS,'demerit','declared','transferred'];
  const LABELS={win:'七番勝負勝利',loss:'七番勝負敗退',promotion:'昇級',demotion:'降級',absence:'休場',unknown:'色の意味未確認'};
  const TITLE_LABELS={'獲':'獲得','防':'防衛','奪':'奪取','失':'失冠','挑':'挑戦','対':'対','留':'留位'};
  const titleWon=code=>['獲','防','奪','留'].includes(code);
  const classKey=s=>s==='名人'?'名':s==='竜王'?'竜':s;
  const classText=s=>s==='名'?'名人':s==='竜'?'竜王':s;
  const classLabel=(db,r)=>classText(displayClass(db,r));
  function isRyuoMemo(r){return !!r&&r.competition==='ryuo'&&(r.className==='R'||(r.raw==='R'&&(r.className===undefined||r.className==='')));}
  function isBlankRyuoMemo(db,r){return isRyuoMemo(r)&&!r.qualified&&!r.groupWinner&&!r.challenger&&!r.loss&&!event(db,r);}
  function classColumns(db){
    const ryuo=new Map((db.ryuo?.periods||[]).map(p=>[p.junniPeriod,p]));
    const columns=db.periods.map(p=>({key:'period-'+p.id,fiscalYear:p.fiscalYear,ageAt:p.ageAt,junni:p,ryuo:ryuo.get(p.id)||null,gap:false}));
    if(db.periods.some(p=>p.id===30&&p.fiscalYear===1975)&&db.periods.some(p=>p.id===36&&p.fiscalYear===1977)&&!columns.some(c=>c.fiscalYear===1976))columns.push({key:'gap-1976',fiscalYear:1976,ageAt:null,junni:null,ryuo:null,gap:true});
    return columns.sort((a,b)=>a.fiscalYear-b.fiscalYear);
  }
  function classCell(db,idx,person,column){
    const junni=column.junni?idx.records.get(person.id+':'+column.junni.id):undefined;
    let ryuo=column.ryuo?idx.ryuoRecords.get(person.id+':'+column.ryuo.id):undefined;
    if(isBlankRyuoMemo(db,ryuo))ryuo=undefined;
    const hasRecord=!!(junni||ryuo);
    return {junni,ryuo,hasRecord,age:hasRecord&&column.ageAt?ageAt(person.birth,column.ageAt):null};
  }
  function ageComparison(db,idx,ids,competition='both'){
    const periods=[...db.periods].sort((a,b)=>a.fiscalYear-b.fiscalYear),ryuo=new Map((db.ryuo?.periods||[]).map(p=>[p.junniPeriod,p]));
    const rows=ids.map(id=>idx.players.get(id)).filter(Boolean).map(person=>{
      const byAge=new Map();
      for(const t of periods){
        const parts=[];
        if(competition!=='ryuo')parts.push({competition:'junni',meta:t,r:idx.records.get(person.id+':'+t.id)});
        const m=ryuo.get(t.id);if(competition!=='junni'&&m)parts.push({competition:'ryuo',meta:m,r:idx.ryuoRecords.get(person.id+':'+m.id)});
        for(const part of parts){if(!part.r||isBlankRyuoMemo(db,part.r))continue;const age=ageAt(person.birth,part.meta.ageAt);if(age===null)continue;if(!byAge.has(age))byAge.set(age,[]);byAge.get(age).push({...part,t});}
      }
      return {person,byAge};
    });
    let min=null,max=null;for(const row of rows)for(const age of row.byAge.keys()){if(min===null||age<min)min=age;if(max===null||age>max)max=age;}
    return {rows,ages:min===null?[]:Array.from({length:max-min+1},(_,i)=>min+i)};
  }
  function titleHistory(db,player){return (db.titles?.events||[]).filter(e=>!player||e.participants.some(p=>p.player===player)).slice().sort((a,b)=>a.order-b.order);}
  function titleTotals(db,player){const all=titleHistory(db,player);return {appearances:all.length,wins:all.reduce((n,e)=>n+Number(e.participants.some(p=>p.player===player&&titleWon(p.code))),0)};}
  function titleLine(entry,player){const p=entry.participants.find(p=>p.player===player);return p?'第'+entry.period+'期'+entry.title+(entry.title.endsWith('戦')?'':'戦')+' '+TITLE_LABELS[p.code]:'';}
  function playerTimeline(db,player,competition='junni'){
    const byYear=new Map(),unmappedMeijin=new Map();
    const meijinAnchors=new Map(db.periods.map(p=>[p.meijinYear,p]));
    for(const e of titleHistory(db,player)){
      const isMeijin=e.title==='名人'||e.title==='名人戦';
      const anchor=isMeijin?meijinAnchors.get(e.meijinYear):null;
      // Early Meijin events without a ranking anchor retain their source year separately.
      if(isMeijin&&!anchor){if(!unmappedMeijin.has(e.meijinYear))unmappedMeijin.set(e.meijinYear,[]);unmappedMeijin.get(e.meijinYear).push(e);continue;}
      const year=isMeijin?anchor.fiscalYear:e.meijinYear;
      if(!byYear.has(year))byYear.set(year,[]);byYear.get(year).push(e);
    }
    const inCycle=events=>events.slice().sort((a,b)=>Number(a.title==='名人'||a.title==='名人戦')-Number(b.title==='名人'||b.title==='名人戦')||a.order-b.order);
    const allowed=new Set((db.ryuo?.periods||[]).map(p=>p.junniPeriod)),rows=[];
    for(const period of db.periods){
      if(competition==='ryuo'&&!allowed.has(period.id))continue;
      rows.push({period,fiscalYear:period.fiscalYear,meijinYear:period.meijinYear,kind:'cycle',titles:inCycle(byYear.get(period.fiscalYear)||[])});byYear.delete(period.fiscalYear);
    }
    // These are display rows only, never synthetic competition periods or player records.
    for(const [fiscalYear,titles] of byYear){
      const anchor=db.periods.find(p=>p.fiscalYear===fiscalYear);
      // Explicit transition correspondence, not a universal year/period formula.
      const meijinYear=anchor?.meijinYear??(fiscalYear===1976?1977:null);
      rows.push({period:null,fiscalYear,meijinYear,kind:'cycle',titles:inCycle(titles)});
    }
    for(const [meijinYear,titles] of unmappedMeijin)rows.push({period:null,fiscalYear:null,meijinYear,kind:'source-meijin',titles});
    return rows.sort((a,b)=>(a.fiscalYear??a.meijinYear)-(b.fiscalYear??b.meijinYear)||Number(a.kind!=='source-meijin')-Number(b.kind!=='source-meijin'));
  }
  // Normal class fills in 順位2, excluding result highlights. B/C remain distinct labels.
  const CLASS_COLORS={'名':'#ffd966','A':'#f4b183','B':'#f8cbad','B1':'#f8cbad','B2':'#fce4d6','C':'#dae3f3','C1':'#dae3f3','C2':'#b4c7e7','宣言':'#e2efda','陥編':'#c6e0b4'};
  const RYUO_COLORS={'竜':'#ffd966','1組':'#f4b183','2組':'#f8cbad','3組':'#fce4d6','4組':'#dae3f3','5組':'#b4c7e7','6組':'#8faadc','シ':'#ede4d1'};
  const ryuoCache=new WeakMap();
  function ryuoMap(db){if(!ryuoCache.has(db))ryuoCache.set(db,new Map((db.ryuo?.records||[]).map(r=>[r.player+':'+r.period,r])));return ryuoCache.get(db);}
  function ryuoResult(db,r){
    if(!r)return '';const directLoss=db.ryuo?.resultMode==='yellow-loss';
    if(directLoss&&r.loss)return 'loss';
    if(isRyuoMemo(r))return '';
    const next=ryuoMap(db).get(r.player+':'+(r.period+1));
    if(!next)return '';const nextClass=displayClass(db,next);if(!nextClass)return '';
    if(nextClass==='竜')return 'win';
    if(!directLoss&&(displayClass(db,r)==='竜'||r.challenger))return 'loss';return '';
  }
  function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
  function ageAt(birth,date){if(!validDate(birth)||!validDate(date))return null;let a=Number(date.slice(0,4))-Number(birth.slice(0,4));if(date.slice(5)<birth.slice(5))a--;return a>=0?a:null;}
  function sourceEvent(db,r){return r?(db.palette[String(r.fill)]?.event??'unknown'):'';}
  function event(db,r){if(!r)return '';if(r.recordEvent!==undefined)return r.recordEvent;if(r.competition==='ryuo')return ryuoResult(db,r);const e=sourceEvent(db,r);return ['demerit','declared','transferred'].includes(e)?'':e;}
  function displayClass(db,r){if(!r)return '';if(isRyuoMemo(r))return '';if(r.className!==undefined)return classKey(r.className);if(r.competition==='ryuo')return /^[1-6]$/.test(r.raw)?r.raw+'組':classKey(r.raw);const e=sourceEvent(db,r);if(e==='declared')return '宣言';if(e==='transferred')return '陥編';return classKey(r.raw);}
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
      if(db.ryuo.resultMode!==undefined&&!['yellow-loss','legacy-challenger'].includes(db.ryuo.resultMode))fail();
      const rp=new Set(),anchors=new Set(),rk=new Set();
      for(const p of db.ryuo.periods){const anchor=db.periods.find(j=>j.id===p.junniPeriod);if(!Number.isInteger(p.id)||p.id<1||rp.has(p.id)||anchors.has(p.junniPeriod)||!anchor||p.ageAt!==anchor.ageAt||typeof p.ongoing!=='boolean'||!str(p.note))fail();rp.add(p.id);anchors.add(p.junniPeriod);}
      for(const r of db.ryuo.records){const key=r.player+':'+r.period;if(r.competition!=='ryuo'||!ids.has(r.player)||!rp.has(r.period)||rk.has(key)||!str(r.raw,100)||!Number.isInteger(r.fill)||!Object.hasOwn(db.palette,String(r.fill))||typeof r.qualified!=='boolean'||typeof r.groupWinner!=='boolean'||typeof r.challenger!=='boolean'||(db.ryuo.resultMode==='yellow-loss'&&typeof r.loss!=='boolean')||(r.recordEvent!==undefined&&!EVENTS.includes(r.recordEvent))||(r.className!==undefined&&!str(r.className,100)))fail();rk.add(key);}
    }
    if(db.titles!==undefined){
      if(!db.titles||!Array.isArray(db.titles.events)||db.titles.events.length>10000)fail();
      const ti=new Set(),orders=new Set(),tp=new Set();
      for(const e of db.titles.events){
        const pair=e.title+':'+e.period;
        if(!str(e.id,100)||!e.id||ti.has(e.id)||!Number.isInteger(e.order)||e.order<0||orders.has(e.order)||!Number.isInteger(e.meijinYear)||e.meijinYear<1500||e.meijinYear>2500||!str(e.title,100)||!e.title.trim()||!Number.isInteger(e.period)||e.period<1||tp.has(pair)||!Array.isArray(e.participants)||e.participants.length>1000||!e.participants.length||(e.note!==undefined&&!str(e.note,3000)))fail();
        ti.add(e.id);orders.add(e.order);tp.add(pair);const people=new Set();
        for(const p of e.participants){if(!ids.has(p.player)||people.has(p.player)||!Object.hasOwn(TITLE_LABELS,p.code))fail();people.add(p.player);}
      }
    }
    return db;
  }
  function mergeRyuo(current,incoming){
    validate(current);validate(incoming);if(!incoming.ryuo)throw new Error('竜王戦の追加データがありません。');
    if(current.ryuo&&(current.ryuo.resultMode||'legacy-challenger')!==(incoming.ryuo.resultMode||'legacy-challenger'))throw new Error('竜王戦の資料形式が異なります。差し替え用JSONを使用してください。');
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
  function replaceRyuo(current,incoming){
    validate(current);validate(incoming);
    if(incoming.ryuo?.resultMode!=='yellow-loss'||incoming.ryuo?.source?.sheet!=='竜王戦')throw new Error('竜王戦シートを元にした差し替えデータではありません。');
    if(!current.source?.sha256||current.source.sha256!==incoming.source?.sha256)throw new Error('取り込み元の棋士データが一致しません。現在のデータは変更していません。');
    const next=JSON.parse(JSON.stringify(current)),known=new Set(next.players.map(p=>p.id)),people=new Map(incoming.players.map(p=>[p.id,p]));
    for(const r of incoming.ryuo.records)if(!known.has(r.player)){next.players.push(JSON.parse(JSON.stringify(people.get(r.player))));known.add(r.player);}
    const replaced=next.ryuo?.records.length||0;next.ryuo=JSON.parse(JSON.stringify(incoming.ryuo));
    delete next.delivery;validate(next);return {data:next,replaced,loaded:next.ryuo.records.length};
  }
  function mergeTitles(current,incoming){
    validate(current);validate(incoming);if(!incoming.titles)throw new Error('タイトル戦の追加データがありません。');
    if(!current.source?.sha256||current.source.sha256!==incoming.source?.sha256)throw new Error('取り込み元の棋士データが一致しません。現在のデータは変更していません。');
    const next=JSON.parse(JSON.stringify(current)),known=new Set(next.players.map(p=>p.id)),people=new Map(incoming.players.map(p=>[p.id,p]));
    // Name-only matches are ambiguous after manual profile additions; never silently create a duplicate.
    for(const e of incoming.titles.events)for(const p of e.participants)if(!known.has(p.player)){
      const person=people.get(p.player);if(next.players.some(x=>x.name===person.name))throw new Error('同名の棋士が別IDで登録されています：'+person.name+'。追加データとの対応を確認してください。');
      next.players.push(JSON.parse(JSON.stringify(person)));known.add(p.player);
    }
    if(!next.titles)next.titles={...JSON.parse(JSON.stringify(incoming.titles)),events:[]};
    const ids=new Set(next.titles.events.map(e=>e.id)),pairs=new Set(next.titles.events.map(e=>e.title+':'+e.period)),orders=new Set(next.titles.events.map(e=>e.order));let added=0,kept=0;
    for(const e of incoming.titles.events){if(ids.has(e.id)||pairs.has(e.title+':'+e.period)){kept++;continue;}if(orders.has(e.order))throw new Error('タイトル戦の確定順が既存記録と重なっています。現在のデータは変更していません。');next.titles.events.push(JSON.parse(JSON.stringify(e)));ids.add(e.id);pairs.add(e.title+':'+e.period);orders.add(e.order);added++;}
    delete next.delivery;validate(next);return {data:next,added,kept};
  }
  const api={EVENTS,LABELS,CLASS_COLORS,RYUO_COLORS,TITLE_LABELS,titleWon,titleHistory,titleTotals,titleLine,playerTimeline,classText,classLabel,isRyuoMemo,isBlankRyuoMemo,classColumns,classCell,ageComparison,validDate,ageAt,event,sourceEvent,displayClass,classColor,titleStats,result,describe,matchesEvent,index,validate,mergeRyuo,replaceRyuo,mergeTitles};
  root.KishiCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
