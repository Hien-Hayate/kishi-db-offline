/* Stage19-4A. No network services, account, or external library is required. */
(function(){
  'use strict';
  const C=window.KishiCore, KEY='banjo-kishi-db-v1', $=id=>document.getElementById(id);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db=null, idx, storageIssue='',storedRevision=null;
  try{storedRevision=localStorage.getItem(KEY);if(storedRevision)db=C.validate(JSON.parse(storedRevision));}catch(e){storageIssue='保存データを読み込めなかったため、データの読み込み画面を表示しています。保存済みデータは削除していません。編集する前にJSONバックアップから復元してください。';}
  if(db)C.validate(db);idx=C.index(db||{records:[],players:[],periods:[]});
  const ui={view:'player',selected:db?.players[0]?.id||null,query:'',rosterTop:0,competition:'junni',period:85,klass:'',event:'',blank:false,compare:[],titlePlayer:'',titleName:'',titleYear:'',titleCode:'',titleSort:'new'};
  Object.assign(ui,{classMode:'matrix',classQuery:'',classOnlyRecords:false,classYear:'',classTop:0,classLeft:0,classSeasonTop:0,classScope:'all',ageLeft:0,ageTop:0});
  let classCache=null;
  function getClassColumns(){if(classCache?.data!==db)classCache={data:db,columns:C.classColumns(db)};return classCache.columns;}
  function ensureClassYear(){const columns=getClassColumns();if(!columns.some(c=>c.key===ui.classYear)){const latest=(db.ryuo?.periods||[]).at(-1)?.junniPeriod;ui.classYear=((latest!==undefined?columns.find(c=>c.junni?.id===latest):null)||columns.at(-1)).key;ui.classLeft=columns.findIndex(c=>c.key===ui.classYear)*84;}}
  if(db&&!idx.periods.has(ui.period))ui.period=db.periods.at(-1).id;
  const VIEW_KEY='banjo-kishi-view-v1';
  try{const v=JSON.parse(localStorage.getItem(VIEW_KEY)||'null');if(v&&db&&idx.players.has(v.selected)&&typeof v.query==='string'&&v.query.length<200&&Number.isFinite(v.top)&&v.top>=0){ui.selected=v.selected;ui.query=v.query;ui.rosterTop=v.top;if(['junni','ryuo','both'].includes(v.competition))ui.competition=v.competition;}}catch(e){}
  function rememberList(){try{localStorage.setItem(VIEW_KEY,JSON.stringify({selected:ui.selected,query:ui.query,top:ui.rosterTop,competition:ui.competition}));}catch(e){}}
  const getStored=(id,p,competition='junni')=>(competition==='ryuo'?idx.ryuoRecords:idx.records).get(id+':'+p);
  const get=(id,p,competition='junni')=>{const r=getStored(id,p,competition);return C.isBlankRyuoMemo(db,r)?undefined:r;};
  const compName=c=>c==='ryuo'?'竜王戦':'順位戦';
  function parts(t){const out=[];if(ui.competition!=='ryuo')out.push({competition:'junni',meta:t});if(ui.competition!=='junni'){const m=(db.ryuo?.periods||[]).find(p=>p.junniPeriod===t.id);if(m)out.push({competition:'ryuo',meta:m});}return out;}
  function years(){return db.periods.filter(t=>parts(t).length);}
  function seasonLabel(t){return parts(t).map(p=>compName(p.competition)+' 第'+p.meta.id+'期').join(' / ');}
  function ensurePeriod(){if(ui.competition==='ryuo'&&db.ryuo&&!parts(idx.periods.get(ui.period)||{}).length)ui.period=db.ryuo.periods.at(-1)?.junniPeriod||ui.period;}
  function forPlayer(id){return years().flatMap(t=>parts(t).map(part=>({...part,t,r:get(id,part.meta.id,part.competition)})).filter(p=>p.r));}

  const normalize=s=>s.normalize('NFKC').replace(/\s/g,'');
  const nameList=()=>db.players.filter(p=>normalize(p.name).includes(normalize(ui.query)));
  function notice(s){$('notice').textContent=s;$('notice').hidden=!s;}
  function color(r){return C.classColor(db,r);}
  function badge(r){if(!r)return '';return '<span class="badge"'+(color(r)?' style="background:'+color(r)+'"':'')+'>'+ (esc(C.classLabel(db,r))||'&nbsp;')+'</span>';}
  function recordButton(id,p,r,competition='junni'){const label=C.classLabel(db,r)||'空白';return '<button class="'+(r?'edit-cell':'blank')+'" data-edit="'+esc(id)+'" data-period="'+p+'" data-competition="'+competition+'" aria-label="第'+p+'期 '+esc(label)+'の記録を編集">'+badge(r)+'</button>';}
  function options(items,value){return items.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('');}
  function renderHeader(){
    $('sourceCount').textContent=ui.view==='titles'?(db.titles?db.titles.events.length+'件のタイトル戦':'タイトル戦は未追加'):db.players.length+'棋士 / '+db.periods.length+'期'+(db.ryuo?' / 竜王'+db.ryuo.periods.length+'期':'');
    const p=db.periods.at(-1);$('sourcePeriod').textContent=ui.view==='titles'?'名人戦年度 / タイトル確定順':'順位戦 第'+p.id+'期'+(db.ryuo?' / 竜王戦 第'+db.ryuo.periods.at(-1).id+'期':' / 竜王戦は未追加');
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===ui.view)));
  }
  function renderControls(){
    if(ui.view==='titles'){renderTitleControls();return;}
    if(ui.view==='classes'){renderClassControls();return;}
    let h='';
    if(ui.view==='player')h='<label class="search">棋士名で探す<input id="search" type="search" placeholder="棋士名を入力" value="'+esc(ui.query)+'" autocomplete="off"></label><label class="check"><input type="checkbox" id="showBlank"'+(ui.blank?' checked':'')+'>空白の期も表示</label><button id="addPlayer">棋士追加</button>';
    if(ui.view==='season'){
      h='<label>期<select id="periodSelect">'+options([...years()].reverse().map(p=>[p.id,seasonLabel(p)]),ui.period)+'</select></label>';
      h+='<label>所属<select id="classFilter">'+options([['','すべて'],...[...new Set([...(ui.competition!=='ryuo'?Object.keys(C.CLASS_COLORS):[]),...(ui.competition!=='junni'?Object.keys(C.RYUO_COLORS):[])])].map(x=>[x,C.classText(x)])],ui.klass)+'</select></label>';
      h+='<label>記録<select id="eventFilter">'+options([['','すべて'],...Object.entries(C.LABELS),...(ui.competition!=='junni'?[['qualified','挑決'],['groupWinner','組優勝']]:[])],ui.event)+'</select></label>';
      h+='<label class="check"><input type="checkbox" id="showBlank"'+(ui.blank?' checked':'')+'>空白の棋士も表示</label>';
    }
    if(ui.view==='compare')h=comparisonPicker();
    $('controls').innerHTML='<label>棋戦<select id="competitionSelect">'+options([['junni','順位戦'],['ryuo','竜王戦'],['both','両方']],ui.competition)+'</select></label>'+h;
    $('competitionSelect').addEventListener('change',e=>{ui.competition=e.target.value;ui.klass='';ui.event='';if(ui.competition==='both'&&db.ryuo&&!db.ryuo.periods.some(p=>p.junniPeriod===ui.period))ui.period=db.ryuo.periods.at(-1).junniPeriod;ensurePeriod();render();rememberList();});
    $('search')?.addEventListener('input',e=>{ui.query=e.target.value;const list=nameList();if(list.length&&!list.some(p=>p.id===ui.selected))ui.selected=list[0].id;renderContent(true);rememberList();});
    $('showBlank')?.addEventListener('change',e=>{ui.blank=e.target.checked;renderContent();});
    $('addPlayer')?.addEventListener('click',()=>editProfile(null));
    $('periodSelect')?.addEventListener('change',e=>{ui.period=Number(e.target.value);renderContent();});
    $('classFilter')?.addEventListener('change',e=>{ui.klass=e.target.value;renderContent();});
    $('eventFilter')?.addEventListener('change',e=>{ui.event=e.target.value;renderContent();});
    bindComparisonPicker();
  }
  function renderPlayer(){
    const list=nameList(),p=idx.players.get(ui.selected);
    let h='<div class="split"><aside class="roster"><div class="roster-heading">棋士一覧 <span>'+list.length+'人</span></div><div class="roster-list" id="rosterList">';
    h+=list.map(x=>'<button data-player="'+esc(x.id)+'" class="'+(x.id===ui.selected?'active':'')+'"'+(x.id===ui.selected?' aria-current="true"':'')+'><span>'+esc(x.name)+'</span><small>'+esc(x.number?'No. '+x.number:'')+'</small></button>').join('')||'<p class="empty">該当する棋士はいません。</p>';
    h+='</div></aside>';
    if(!list.length)return h+'<div class="profile empty">棋士名を変えて検索してください。</div></div>';
    const rs=forPlayer(p.id),birth=p.birth||'不明';
    h+='<article class="profile"><div class="profile-header"><div><p class="eyebrow">'+esc(p.number?'棋士番号 '+p.number:'棋士別記録')+'</p><h2>'+esc(p.name)+'</h2><div class="profile-meta">生年月日 '+esc(birth)+'<br>四段昇段年 '+esc(p.proYear||'不明')+'</div>'+(db.titles?'<button id="openTitleHistory" class="link">タイトル戦履歴</button>':'')+'</div><button id="editProfile">棋士情報編集</button></div>';
    const summaryPair=(key,appearances,wins,appearanceLabel,winLabel)=>'<div class="summary-group" data-summary="'+key+'"><div><strong>'+appearances+'回</strong><small>'+appearanceLabel+'</small></div><div><strong>'+wins+'期</strong><small>'+winLabel+'</small></div></div>';
    const unavailable=(key,label)=>'<div class="summary-group" data-summary="'+key+'"><div class="summary-unavailable"><strong>未追加</strong><small>'+label+'</small></div></div>';
    h+='<div class="summary player-summary"><div class="summary-total"><strong>'+rs.length+'件</strong><small>収録された記録数</small></div>';
    for(const c of ['junni','ryuo']){
      if(ui.competition!=='both'&&ui.competition!==c)continue;
      if(c==='ryuo'&&!db.ryuo){h+=unavailable('ryuo','竜王戦データ');continue;}
      const stats=C.titleStats(db,rs.filter(x=>x.competition===c).map(x=>x.r)),title=c==='ryuo'?'竜王':'名人';
      h+=summaryPair(c,stats.appearances,stats.wins,title+'戦登場',title+'獲得');
    }
    if(db.titles){const stats=C.titleTotals(db,p.id);h+=summaryPair('titles',stats.appearances,stats.wins,'タイトル戦登場','タイトル獲得');h+='<p class="summary-note">全タイトル戦の集計は「タイトル戦」データから算出。獲得数は防衛・留位を含みます。</p>';}
    else h+=unavailable('titles','全タイトル戦データ');
    h+='</div>';
    if(rs.length)h+='<div class="ribbon" aria-label="クラス推移">'+years().filter(t=>parts(t).some(part=>get(p.id,part.meta.id,part.competition))).map(t=>'<div class="ribbon-item">'+parts(t).map(part=>{const r=get(p.id,part.meta.id,part.competition);return '<span>'+ (part.competition==='ryuo'?'竜':'順')+part.meta.id+'期</span><button data-scroll="'+t.id+'" style="'+(color(r)?'background:'+color(r):'')+'" aria-label="'+esc(compName(part.competition))+'第'+part.meta.id+'期の行へ">'+(esc(C.classLabel(db,r))||'&nbsp;')+'</button>';}).join('')+'</div>').join('')+'</div>';
    const withTitles=!!db.titles;
    const titleCell=(entries,rowspan=1)=>'<td class="annual-titles"'+(rowspan>1?' rowspan="'+rowspan+'"':'')+'>'+(entries.length?'<span class="annual-titles-label">タイトル戦</span>':'')+entries.map(e=>{const line=C.titleLine(e,p.id),split=line.lastIndexOf(' '),won=C.titleWon(e.participants.find(x=>x.player===p.id)?.code);return '<div class="annual-title-entry'+(won?' annual-title-won':'')+'"><span class="annual-title-name">'+esc(line.slice(0,split))+'</span> <span class="annual-title-result">'+esc(line.slice(split+1))+'</span></div>';}).join('')+'</td>';
    if(withTitles)h+='<p class="timeline-note">年表は順位戦年度から締めくくりの翌春の名人戦まで。名人戦以外は出典年度を順位戦年度へ対応させ、関連する名人戦を最後に置きます。年齢は年度末時点です。</p>';
    h+='<div class="table-wrap timeline-wrap"><table class="player-timeline" role="table"><thead><tr><th>棋戦・期</th><th>年度末年齢</th><th>所属</th><th>記録</th>'+(withTitles?'<th class="annual-titles">タイトル戦（翌春の名人戦まで）</th>':'')+'</tr></thead>';
    for(const row of C.playerTimeline(db,p.id,ui.competition).reverse()){
      const t=row.period;
      if(!t){
        const sourceOnly=row.kind==='source-meijin',year=sourceOnly?row.meijinYear:row.fiscalYear;
        const heading=sourceOnly?'出典の名人戦年度 '+year:year+'年度';
        const supplement=sourceOnly?'補足（対応する順位戦の期なし）':row.fiscalYear===1976?'補足（第30期と第36期の間）':'補足（対応する表示対象の期なし）';
        h+='<tbody class="timeline-year supplementary-block"><tr id="'+(sourceOnly?'title-meijin-year-':'title-year-')+year+'" class="supplementary-year"><td class="timeline-period">'+heading+'<span class="sub">'+supplement+'</span>'+(!sourceOnly&&row.meijinYear!==null?'<span class="sub">対応名人戦年度 '+row.meijinYear+'</span>':'')+'</td><td class="timeline-empty"></td><td class="timeline-empty"></td><td class="event timeline-result">タイトル戦のみ</td>'+titleCell(row.titles)+'</tr></tbody>';
        continue;
      }
      const ps=parts(t);if(!ui.blank&&!ps.some(part=>get(p.id,part.meta.id,part.competition))&&!row.titles.length)continue;
      h+='<tbody id="timeline-year-'+t.id+'" class="timeline-year'+(ps.length>1?' paired':'')+'">';
      ps.forEach((part,i)=>{const r=get(p.id,part.meta.id,part.competition),age=C.ageAt(p.birth,part.meta.ageAt);
        const description=r?C.describe(db,r):'';
        h+='<tr class="timeline-part-'+i+'"'+(i===0?' id="period-row-'+t.id+'"':'')+'><td class="timeline-period"><button class="period-link" data-season="'+t.id+'">'+esc(compName(part.competition))+' '+part.meta.id+'期</button><span class="sub">基準 '+esc(part.meta.ageAt)+'</span>'+(withTitles&&i===0?'<span class="sub">順位戦年度 '+row.fiscalYear+'</span>':'')+'</td>'+(i===0?'<td class="timeline-age" rowspan="'+ps.length+'">'+esc(age===null?'不明':age+'歳')+'</td>':'')+'<td class="timeline-class">'+recordButton(p.id,part.meta.id,r,part.competition)+'</td><td class="event timeline-result">'+(description?'<span class="timeline-result-label">'+esc(compName(part.competition))+'の記録</span>':'')+esc(description)+'</td>'+(withTitles&&i===0?titleCell(row.titles,ps.length):'')+'</tr>';
      });
      h+='</tbody>';
    }
    h+='</table>'+(rs.length||C.titleHistory(db,p.id).length?'':'<p class="empty">記録はありません。空白の期を表示して記録を追加できます。</p>')+'</div></article></div>';return h;
  }
  function renderSeason(){
    const t=idx.periods.get(ui.period);
    if(!t)return '<p class="empty">対応する期がありません。</p>';
    const ps=parts(t),list=db.players.filter(p=>ps.some(part=>{const r=get(p.id,part.meta.id,part.competition);return (r||ui.blank)&&(!ui.klass||C.displayClass(db,r)===ui.klass)&&C.matchesEvent(db,r,ui.event);}));
    let h='<article class="profile"><div class="section-head"><div><p class="eyebrow">年齢基準 '+esc(t.ageAt)+'</p><h2>'+esc(seasonLabel(t))+'</h2><p>'+list.length+'人を表示'+(ui.competition==='both'&&ps.length===1?' · 対応する竜王戦データなし':'')+(t.ongoing?' · 順位戦進行中':'')+(t.note?'<br>'+esc(t.note):'')+'</p></div><button id="editPeriod">期の設定</button></div><div class="table-wrap"><table><thead><tr><th>棋士</th><th>年度末年齢</th><th>棋戦・所属</th><th>記録</th></tr></thead><tbody>';
    h+=list.map(p=>ps.map((part,i)=>{const r=get(p.id,part.meta.id,part.competition),age=C.ageAt(p.birth,part.meta.ageAt);return '<tr>'+(i===0?'<td rowspan="'+ps.length+'"><button class="period-link" data-open-player="'+esc(p.id)+'">'+esc(p.name)+'</button></td><td rowspan="'+ps.length+'">'+esc(age===null?'不明':age+'歳')+'</td>':'')+'<td><span class="sub">'+esc(compName(part.competition))+' '+part.meta.id+'期</span>'+recordButton(p.id,part.meta.id,r,part.competition)+'</td><td class="event">'+esc(r?C.describe(db,r):'')+'</td></tr>';}).join('')).join('');
    return h+'</tbody></table>'+(list.length?'':'<p class="empty">条件に合う記録はありません。</p>')+'</div></article>';
  }
  function comparisonPicker(){
    return '<label class="choose">比較する棋士<select id="compareSelect">'+options([['','棋士を選択'],...db.players.filter(p=>!ui.compare.includes(p.id)).map(p=>[p.id,p.name])],'')+'</select></label><button id="addCompare">比較に追加</button>';
  }
  function bindComparisonPicker(){
    $('addCompare')?.addEventListener('click',()=>{const id=$('compareSelect').value;if(!idx.players.has(id))return;if(ui.compare.includes(id))return notice('その棋士は比較に追加済みです。');ui.compare.push(id);ui.classTop=0;ui.classSeasonTop=0;if(ui.view==='classes'){ui.classScope='selected';ui.classQuery='';}notice('');renderControls();renderContent();});
  }
  function comparisonChips(){
    if(!ui.compare.length)return '';
    return '<div class="chips comparison-selection">'+ui.compare.map(id=>idx.players.get(id)).filter(Boolean).map(p=>'<button class="chip" data-remove="'+esc(p.id)+'" aria-label="'+esc(p.name)+'を比較から外す">'+esc(p.name)+' ×</button>').join('')+'<button id="clearComparison">選択を解除</button><button id="switchComparison">'+(ui.view==='compare'?'年度で比較':'同年齢比較へ')+'</button></div>';
  }
  function bindComparisonActions(){
    $('content').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{ui.compare=ui.compare.filter(id=>id!==b.dataset.remove);ui.classTop=0;ui.classSeasonTop=0;renderControls();renderContent();});
    $('clearComparison')?.addEventListener('click',()=>{ui.compare=[];ui.classTop=0;ui.classSeasonTop=0;ui.ageLeft=0;ui.ageTop=0;renderControls();renderContent();});
    $('switchComparison')?.addEventListener('click',()=>{if(ui.view==='compare'){ui.view='classes';ui.classScope='selected';ui.classQuery='';ui.classMode='matrix';ui.classTop=0;}else{ui.view='compare';ui.competition=db.ryuo?'both':'junni';}render();});
  }
  function renderCompare(){
    const {rows,ages}=C.ageComparison(db,idx,ui.compare,ui.competition);
    let h='<p class="hint">縦に棋士、横に年度末年齢。棋士名と年齢見出しは固定しています。横スクロールで同じ年齢の所属・記録を比較できます。年齢は各期の年度末（3月31日）で統一し、生年月日不明の棋士は年齢へ対応させません。</p>'+comparisonChips();
    if(!rows.length)return h+'<div class="profile empty">比較する棋士を選んで追加してください。</div>';
    h+='<article class="profile"><div id="ageCompareViewport" class="age-compare-viewport" tabindex="0" aria-label="棋士別の同年齢比較"><table class="age-compare-table" style="width:'+(120+Math.max(ages.length,1)*132)+'px"><thead><tr><th scope="col" class="age-name-corner">棋士</th>'+(ages.length?ages.map(age=>'<th scope="col">'+age+'歳</th>').join(''):'<th scope="col">年齢の対応なし</th>')+'</tr></thead><tbody>';
    for(const {person:p,byAge} of rows){h+='<tr><th scope="row" class="age-row-name"><button class="class-person-link" data-open-player="'+esc(p.id)+'">'+esc(p.name)+'</button>'+(!p.birth?'<small>生年月日不明</small>':'')+'</th>';
      if(!ages.length)h+='<td class="age-unmapped">'+(p.birth?'年齢に対応できる記録がありません。':'生年月日不明のため、年齢へ対応させません。')+'</td>';
      else for(const age of ages){h+='<td data-age="'+age+'">'+(byAge.get(age)||[]).map(({r,t,meta,competition})=>'<div class="comparison-part" title="年齢基準 '+esc(meta.ageAt)+'"><span class="sub">'+esc(compName(competition))+' 第'+meta.id+'期</span>'+recordButton(r.player,meta.id,r,competition)+'<span class="sub">'+t.fiscalYear+'年度</span><span class="age-record">'+esc(C.describe(db,r))+'</span></div>').join('')+'</td>';}
      h+='</tr>';
    }
    return h+'</tbody></table></div></article>';
  }
  function bindAgeScroll(){
    const vp=$('ageCompareViewport');if(!vp)return;vp.scrollLeft=ui.ageLeft;vp.scrollTop=ui.ageTop;vp.addEventListener('scroll',()=>{ui.ageLeft=vp.scrollLeft||0;ui.ageTop=vp.scrollTop||0;});
  }
  function renderTitleControls(){
    if(!db.titles){$('controls').innerHTML='';return;}
    const events=C.titleHistory(db),people=new Set(events.flatMap(e=>e.participants.map(p=>p.player)));
    $('controls').innerHTML='<label>タイトル<select id="titleFilter">'+options([['','すべて'],...[...new Set(events.map(e=>e.title))].map(x=>[x,x])],ui.titleName)+'</select></label><label>名人戦年度<select id="titleYearFilter">'+options([['','すべて'],...[...new Set(events.map(e=>e.meijinYear))].sort((a,b)=>b-a).map(x=>[x,x+'年度'])],ui.titleYear)+'</select></label><label class="title-player-control">棋士<select id="titlePlayerFilter">'+options([['','すべての棋士'],...db.players.filter(p=>people.has(p.id)||p.id===ui.titlePlayer).map(p=>[p.id,p.name])],ui.titlePlayer)+'</select></label><label>記録<select id="titleCodeFilter">'+options([['','すべて'],...Object.entries(C.TITLE_LABELS)],ui.titleCode)+'</select></label><label>確定順<select id="titleSort">'+options([['new','新しい順'],['old','古い順']],ui.titleSort)+'</select></label><button id="addTitle">記録追加</button><button id="clearTitleFilters">絞り込み解除</button>';
    for(const [id,key] of [['titleFilter','titleName'],['titleYearFilter','titleYear'],['titlePlayerFilter','titlePlayer'],['titleCodeFilter','titleCode'],['titleSort','titleSort']])$(id).addEventListener('change',e=>{ui[key]=e.target.value;renderTitles();});
    $('addTitle').onclick=()=>editTitle(null);
    $('clearTitleFilters').onclick=()=>{ui.titleName='';ui.titleYear='';ui.titlePlayer='';ui.titleCode='';render();};
  }
  function renderTitles(){
    if(!db.titles){$('content').innerHTML='<article class="profile empty"><h2>タイトル戦データは未追加です</h2><p>データ管理からタイトル戦の追加用JSONを読み込んでください。</p><button id="loadTitles">追加用JSONを選ぶ</button></article>';$('loadTitles').onclick=()=>$('importInput').click();return;}
    const person=idx.players.get(ui.titlePlayer),all=C.titleHistory(db,ui.titlePlayer);
    let events=all.filter(e=>(!ui.titleName||e.title===ui.titleName)&&(!ui.titleYear||String(e.meijinYear)===ui.titleYear)&&(!ui.titleCode||e.participants.some(p=>(!ui.titlePlayer||p.player===ui.titlePlayer)&&p.code===ui.titleCode)));
    if(ui.titleSort==='new')events.reverse();
    let h='<p class="hint">年度は全棋戦共通の「名人戦年度」です。各棋戦の公式年度とは区別します。この一覧は出典の年度・確定順を保持し、棋士別年表は順位戦年度から翌春の名人戦までの並びに対応させます。「対」は元の記号のまま表示します。</p><article class="profile title-history"><div class="section-head"><div><p class="eyebrow">タイトル確定順</p><h2>'+esc(person?person.name+'のタイトル戦履歴':'タイトル戦一覧')+'</h2><p>'+events.length+'件を表示 / '+(person?'この棋士の記録':'全記録')+all.length+'件</p></div></div>';
    if(person){const stats=C.titleTotals(db,person.id);h+='<div class="summary"><div><strong>'+stats.appearances+'回</strong><small>全記録の登場数（留位を含む）</small></div><div><strong>'+stats.wins+'期</strong><small>全記録の獲得数（防衛・留位を含む）</small></div></div>';}
    h+='<div class="table-wrap"><table class="title-table"><thead><tr><th>名人戦年度</th><th>タイトル・期</th><th>棋士・記録</th><th>編集</th></tr></thead><tbody>';
    for(const e of events){h+='<tr><td>'+e.meijinYear+'年度</td><td><strong>'+esc(e.title)+'</strong><span class="sub">第'+e.period+'期</span></td><td>'+e.participants.map(p=>'<div class="title-participant"><button class="period-link" data-title-player="'+esc(p.player)+'">'+esc(idx.players.get(p.player).name)+'</button><span class="title-result'+(C.titleWon(p.code)?' title-won':'')+'">'+esc(C.TITLE_LABELS[p.code])+'</span></div>').join('')+(e.note?'<p class="title-note">'+esc(e.note)+'</p>':'')+'</td><td><button class="title-edit" data-title-edit="'+esc(e.id)+'" aria-label="'+esc(e.title)+'第'+e.period+'期を編集">編集</button></td></tr>';}
    $('content').innerHTML=h+'</tbody></table>'+(events.length?'':'<p class="empty">条件に合う記録はありません。</p>')+'</div></article>';
    $('content').querySelectorAll('[data-title-player]').forEach(b=>b.onclick=()=>{ui.titlePlayer=b.dataset.titlePlayer;render();});
    $('content').querySelectorAll('[data-title-edit]').forEach(b=>b.onclick=()=>editTitle(b.dataset.titleEdit));
  }
  function editTitle(id){
    const entry=db.titles.events.find(e=>e.id===id),order=Math.max(-1,...db.titles.events.map(e=>e.order))+1;
    let people=clone(entry?.participants||[{player:'',code:'獲'}]);
    const choices=[['','棋士を選択'],...db.players.map(p=>[p.id,p.name])];
    const body='<p class="dialog-note">入力する年度は出典の名人戦年度です。棋士別年表の配置用年度とは区別します。確定順は全タイトル戦を通した順番で、同じ年度に複数期を登録できます。</p><div class="form-grid"><label>タイトル<input id="titleName" required maxlength="100" list="titleNames" value="'+esc(entry?.title||'')+'"><datalist id="titleNames">'+[...new Set(db.titles.events.map(e=>e.title))].map(t=>'<option value="'+esc(t)+'"></option>').join('')+'</datalist></label><label>期<input id="titlePeriod" type="number" min="1" required value="'+esc(entry?.period||'')+'"></label><label>名人戦年度<input id="titleYear" type="number" min="1500" max="2500" required value="'+esc(entry?.meijinYear||'')+'"></label><label>確定順（1から）<input id="titleOrder" type="number" min="1" required value="'+((entry?.order??order)+1)+'"></label></div><p class="dialog-note">棋士と記録。人数は自由です。棋士未選択の行は保存しません。</p><div id="titlePeople"></div><button type="button" id="addTitlePerson">棋士の行を追加</button><label class="title-note-label">メモ<textarea id="titleNote" maxlength="3000" rows="3">'+esc(entry?.note||'')+'</textarea></label><p class="dialog-note">出典：'+esc(entry?.cell||'アプリ内入力')+'。獲得・防衛・奪取・留位は獲得数に含めます。「対」は未確認の元記号です。</p>';
    function capture(){people=people.map((p,i)=>({...p,player:$('titlePerson'+i).value,code:$('titleSymbol'+i).value}));}
    function drawPeople(){
      $('titlePeople').innerHTML=people.map((p,i)=>'<div class="title-person-fields"><label>棋士<select id="titlePerson'+i+'">'+options(choices,p.player)+'</select></label><label>記録<select id="titleSymbol'+i+'">'+options(Object.entries(C.TITLE_LABELS),p.code)+'</select></label><button type="button" data-title-remove="'+i+'" aria-label="'+(i+1)+'人目の行を外す">外す</button></div>').join('');
      $('titlePeople').querySelectorAll('[data-title-remove]').forEach(b=>b.onclick=()=>{capture();people.splice(Number(b.dataset.titleRemove),1);drawPeople();});
    }
    openModal(entry?'タイトル戦の記録を編集':'タイトル戦の記録を追加',body,()=>{
      capture();const participants=people.filter(p=>p.player),title=$('titleName').value.trim(),period=Number($('titlePeriod').value),meijinYear=Number($('titleYear').value),position=Number($('titleOrder').value)-1;
      if(!title||!Number.isInteger(period)||period<1||!Number.isInteger(meijinYear)||meijinYear<1500||meijinYear>2500||!Number.isInteger(position)||position<0)throw new Error('タイトル・期・名人戦年度・確定順を確認してください。');
      if(!participants.length)throw new Error('棋士を1人以上選んでください。');
      if(new Set(participants.map(p=>p.player)).size!==participants.length)throw new Error('同じ棋士を重複して登録できません。');
      if(db.titles.events.some(e=>e.id!==id&&e.title===title&&e.period===period))throw new Error('同じタイトル・期の記録がすでにあります。');
      if(db.titles.events.some(e=>e.id!==id&&e.order===position))throw new Error('その確定順にはすでに記録があります。別の番号を指定してください。');
      const next=clone(db),record={...(entry||{}),id:id||'user-title-'+crypto.randomUUID(),order:position,title,period,meijinYear,participants,note:$('titleNote').value.trim(),editedAt:new Date().toISOString()};
      if(entry)next.titles.events[next.titles.events.findIndex(e=>e.id===id)]=record;else next.titles.events.push(record);
      commit(next,'タイトル戦の記録を保存しました。');
    });
    drawPeople();$('addTitlePerson').onclick=()=>{capture();people.push({player:'',code:'挑'});drawPeople();};
  }
  function classYearLabel(column){return column.fiscalYear+'年度'+(column.gap?'（補足）':'');}
  function renderClassControls(){
    ensureClassYear();const columns=getClassColumns();
    $('controls').innerHTML='<label>表示形式<select id="classModeSelect">'+options([['matrix','クラス推移表'],['annual','年度別一覧']],ui.classMode)+'</select></label><label>対象<select id="classScopeSelect">'+options([['all','全棋士'],['selected','選択した棋士']],ui.classScope)+'</select></label><label class="search">棋士名で絞る<input id="classSearch" type="search" value="'+esc(ui.classQuery)+'"'+(ui.classScope==='selected'?' disabled':'')+' placeholder="空欄で全棋士" autocomplete="off"></label><label>年度<select id="classYearSelect">'+options([...columns].reverse().map(c=>[c.key,classYearLabel(c)]),ui.classYear)+'</select></label><button id="classPrevYear">前の年度</button><button id="classNextYear">次の年度</button>'+(ui.classMode==='matrix'?'<button id="classJumpYear">その年度へ</button>':'')+'<label class="check"><input id="classOnlyRecords" type="checkbox"'+(ui.classOnlyRecords?' checked':'')+'>記録のある棋士だけ</label>'+comparisonPicker();
    bindComparisonPicker();
    $('classScopeSelect').onchange=e=>{ui.classScope=e.target.value;ui.classTop=0;ui.classSeasonTop=0;renderClassControls();renderClasses();};
    $('classModeSelect').onchange=e=>{ui.classMode=e.target.value;renderClassControls();renderClasses();};
    $('classSearch').addEventListener('input',e=>{ui.classQuery=e.target.value;ui.classTop=0;ui.classSeasonTop=0;renderClasses();});
    $('classOnlyRecords').onchange=e=>{ui.classOnlyRecords=e.target.checked;ui.classTop=0;ui.classSeasonTop=0;renderClasses();};
    function move(key){ui.classYear=key;ui.classSeasonTop=0;if(ui.classMode==='matrix')ui.classLeft=columns.findIndex(c=>c.key===key)*84;renderClassControls();renderClasses();}
    $('classYearSelect').onchange=e=>move(e.target.value);
    const at=columns.findIndex(c=>c.key===ui.classYear);
    $('classPrevYear').disabled=at===0;$('classNextYear').disabled=at===columns.length-1;
    $('classPrevYear').onclick=()=>{if(at>0)move(columns[at-1].key);};
    $('classNextYear').onclick=()=>{if(at<columns.length-1)move(columns[at+1].key);};
    $('classJumpYear')?.addEventListener('click',()=>move(ui.classYear));
  }
  function classPeople(columns,column){
    const people=ui.classScope==='selected'?ui.compare.map(id=>idx.players.get(id)).filter(Boolean):db.players;
    return people.filter(p=>(ui.classScope==='selected'||normalize(p.name).includes(normalize(ui.classQuery)))&&(!ui.classOnlyRecords||(ui.classMode==='annual'?C.classCell(db,idx,p,column).hasRecord:columns.some(c=>C.classCell(db,idx,p,c).hasRecord))));
  }
  function openClassPlayer(id,key){
    ui.selected=id;ui.query='';ui.view='player';ui.competition=db.ryuo?'both':'junni';
    if(key)ui.classYear=key;render();rememberList();
    const column=getClassColumns().find(c=>c.key===key);
    if(column?.junni)$('timeline-year-'+column.junni.id)?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function bindClassLinks(root){root.querySelectorAll('[data-class-open]').forEach(b=>b.onclick=()=>openClassPlayer(b.dataset.classOpen,b.dataset.classPeriod));}
  function renderClasses(){
    ensureClassYear();const columns=getClassColumns(),column=columns.find(c=>c.key===ui.classYear),people=classPeople(columns,column);
    if(ui.classMode==='annual'){renderClassAnnual(column,people);return;}
    const header=columns.map(c=>'<th scope="col"'+(c.key===ui.classYear?' class="class-focus"':'')+'><button data-class-year="'+c.key+'">'+c.fiscalYear+'年度</button><span class="class-period-label">'+(c.gap?'補足':('順'+c.junni.id+'期'))+'</span><span class="class-period-label">'+(c.ryuo?'竜'+c.ryuo.id+'期':c.gap?'期の対応なし':'竜王戦未収録')+'</span></th>').join('');
    $('content').innerHTML=comparisonChips()+'<p class="hint">縦に棋士、横に全年度。棋士名と年度見出しは固定しています。年度の選択や「その年度へ」で横移動できます。記録のあるマス・棋士名をタップすると詳しい年表へ移動します。</p><article class="profile"><div class="section-head"><div><h2>'+ (ui.classScope==='selected'?'選択した棋士のクラス推移':'全棋士のクラス推移')+'</h2><p>'+people.length+'人 / 登録'+db.players.length+'人 · 年齢は各年度末</p><small id="classMatrixStatus"></small></div></div><div id="classMatrixViewport" class="class-matrix-viewport" tabindex="0" aria-label="全棋士の年度別クラス推移"><table class="class-matrix" aria-rowcount="'+(people.length+1)+'" aria-colcount="'+(columns.length+1)+'" style="width:'+(120+columns.length*84)+'px"><thead><tr><th scope="col" class="class-name-corner">棋士</th>'+header+'</tr></thead><tbody id="classMatrixRows"></tbody></table></div>'+(people.length?'':'<p class="empty">'+(ui.classScope==='selected'&&!ui.compare.length?'比較する棋士を選んで追加してください。':'条件に合う棋士はいません。')+'</p>')+'</article>';
    bindComparisonActions();
    const viewport=$('classMatrixViewport'),body=$('classMatrixRows'),ROW=104,HEADER=76;
    let start=-1,end=-1,scheduled=false;
    function draw(){
      const first=Math.min(Math.max(0,people.length-1),Math.floor(Math.max(0,(viewport.scrollTop||0)-HEADER)/ROW));
      const last=Math.min(people.length,first+Math.ceil((viewport.clientHeight||480)/ROW)+1);
      if(start>=0&&first>=start&&last<=end-2)return;
      start=Math.max(0,first-5);end=Math.min(people.length,last+6);
      const spacer=height=>height?'<tr class="class-spacer" aria-hidden="true"><td colspan="'+(columns.length+1)+'" style="height:'+height+'px"></td></tr>':'';
      let html=spacer(start*ROW);
      for(let i=start;i<end;i++){
        const p=people[i];html+='<tr class="class-data-row" aria-rowindex="'+(i+2)+'"><th scope="row" class="class-row-name"><button data-class-open="'+esc(p.id)+'" title="'+esc(p.name)+'">'+esc(p.name)+'</button><small>'+esc(p.number?'No. '+p.number:'')+'</small></th>';
        for(const c of columns){
          const cell=C.classCell(db,idx,p,c),age=cell.hasRecord?(cell.age===null?'不明':cell.age+'歳'):'';
          const inner='<span class="class-matrix-age">'+age+'</span><span class="class-matrix-line"><small>順</small>'+badge(cell.junni)+'</span><span class="class-matrix-line"><small>竜</small>'+badge(cell.ryuo)+'</span>';
          const label=p.name+' '+classYearLabel(c)+' 順位戦 '+(C.classLabel(db,cell.junni)||'空白')+' 竜王戦 '+(C.classLabel(db,cell.ryuo)||'空白');
          html+='<td'+(c.gap?' class="class-gap"':'')+'>'+(cell.hasRecord?'<button class="class-matrix-cell" data-class-open="'+esc(p.id)+'" data-class-period="'+c.key+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+inner+'</button>':'<div class="class-matrix-cell class-matrix-empty">'+(c.gap?'<span class="class-gap-mark">—</span>':'')+'</div>')+'</td>';
        }
        html+='</tr>';
      }
      body.innerHTML=html+spacer((people.length-end)*ROW);bindClassLinks(body);
      $('classMatrixStatus').textContent=people.length?(start+1)+'〜'+end+'人目を描画 / 全'+people.length+'人':'0人';
    }
    draw();viewport.scrollTop=Math.min(ui.classTop,Math.max(0,people.length*ROW-1));viewport.scrollLeft=ui.classLeft;draw();
    viewport.addEventListener('scroll',()=>{ui.classTop=viewport.scrollTop||0;ui.classLeft=viewport.scrollLeft||0;if(!scheduled){scheduled=true;const raf=window.requestAnimationFrame||((fn)=>fn());raf(()=>{scheduled=false;draw();});}});
    $('content').querySelectorAll('[data-class-year]').forEach(b=>b.onclick=()=>{ui.classYear=b.dataset.classYear;ui.classMode='annual';ui.classSeasonTop=0;renderClassControls();renderClasses();});
  }
  function renderClassAnnual(column,people){
    const detail=column.gap?'第30期と第36期の間の補足年度。所属・年齢は補完しません。':'順位戦 第'+column.junni.id+'期 / '+(column.ryuo?'竜王戦 第'+column.ryuo.id+'期':'竜王戦は未収録')+' · 年齢基準 '+column.ageAt;
    let html=comparisonChips()+'<p class="hint">棋士を縦に表示します。名前をタップすると詳しい年表へ移動します。記録がない欄は空白、竜王戦のRも空白として扱います。</p><article class="profile"><div class="section-head"><div><h2>'+classYearLabel(column)+'のクラス一覧</h2><p>'+detail+'</p><small>'+people.length+'人 / 登録'+db.players.length+'人</small></div></div><div class="class-annual-viewport" id="classAnnualViewport"><table class="class-annual-table"><thead><tr><th scope="col">棋士</th><th scope="col">年齢</th><th scope="col">順位戦</th><th scope="col">竜王戦</th></tr></thead><tbody>';
    for(const p of people){const cell=C.classCell(db,idx,p,column);html+='<tr><td><button class="class-person-link" data-class-open="'+esc(p.id)+'" data-class-period="'+column.key+'" title="'+esc(p.name)+'">'+esc(p.name)+'</button></td><td>'+esc(cell.hasRecord?(cell.age===null?'不明':cell.age+'歳'):'')+'</td><td>'+badge(cell.junni)+'</td><td>'+badge(cell.ryuo)+'</td></tr>';}
    $('content').innerHTML=html+'</tbody></table></div>'+(people.length?'':'<p class="empty">'+(ui.classScope==='selected'&&!ui.compare.length?'比較する棋士を選んで追加してください。':'条件に合う棋士はいません。')+'</p>')+'</article>';
    bindComparisonActions();
    const viewport=$('classAnnualViewport');viewport.scrollTop=ui.classSeasonTop;viewport.addEventListener('scroll',()=>{ui.classSeasonTop=viewport.scrollTop||0;});bindClassLinks($('content'));
  }
  function renderContent(resetRoster=false){
    const oldRoster=$('rosterList');if(resetRoster)ui.rosterTop=0;else if(oldRoster)ui.rosterTop=oldRoster.scrollTop||0;
    if(ui.view==='classes'){renderClasses();return;}
    if(ui.view==='titles'){renderTitles();return;}
    if(ui.competition==='ryuo'&&!db.ryuo){$('content').innerHTML='<article class="profile empty">竜王戦データは未追加です。<br><button id="loadRyuo">追加用JSONを選ぶ</button></article>';$('loadRyuo').onclick=()=>$('importInput').click();return;}
    $('content').innerHTML=((ui.competition!=='junni'&&db.ryuo&&db.ryuo.resultMode!=='yellow-loss')?'<p class="notice">竜王戦は旧シートのデータです。新しい差し替え用JSONを「データ管理」から読み込んでください。</p>':'')+(ui.competition==='both'&&!db.ryuo?'<p class="hint">竜王戦は未追加です。「データ管理」から追加用JSONを読み込めます。</p>':'')+(ui.view==='player'?renderPlayer():ui.view==='season'?renderSeason():renderCompare());
    if($('rosterList'))$('rosterList').scrollTop=ui.rosterTop;
    $('editProfile')?.addEventListener('click',()=>editProfile(ui.selected));
    $('openTitleHistory')?.addEventListener('click',()=>{ui.titlePlayer=ui.selected;ui.titleName='';ui.titleYear='';ui.titleCode='';ui.view='titles';render();});
    $('editPeriod')?.addEventListener('click',()=>editPeriod(ui.period));
    $('content').querySelectorAll('[data-player],[data-open-player]').forEach(b=>b.addEventListener('click',()=>{ui.selected=b.dataset.player||b.dataset.openPlayer;ui.view='player';if(b.dataset.openPlayer){ui.query='';ui.rosterTop=0;}render();rememberList();}));
    $('content').querySelectorAll('[data-season]').forEach(b=>b.addEventListener('click',()=>{ui.period=Number(b.dataset.season);ui.view='season';render();}));
    $('content').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editRecord(b.dataset.edit,Number(b.dataset.period),b.dataset.competition||'junni')));
    $('content').querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>{const row=$('timeline-year-'+b.dataset.scroll)||$('period-row-'+b.dataset.scroll);row?.scrollIntoView({behavior:'smooth',block:'center'});}));
    bindComparisonActions();bindAgeScroll();
  }
  function render(){
    if(db)ensurePeriod();
    document.querySelectorAll('[data-view]').forEach(b=>b.disabled=!db);
    if(!db){
      $('sourceCount').textContent='データ未読み込み';$('sourcePeriod').textContent='データはこの端末で読み込みます';$('controls').innerHTML='';
      $('content').innerHTML='<article class="profile empty"><h2>棋士データを読み込む</h2><p>このアプリには棋士データを同梱していません。<br>手元の初期データJSON、または保存済みのバックアップを選んでください。</p><button id="loadInitial" class="primary">データファイルを選ぶ</button><p class="hint" style="margin:18px 0 0">ファイルは端末内で読み込みます。GitHubへの送信は行いません。<br>ホーム画面に追加して使う場合は、そのアイコンから開いて読み込んでください。</p></article>';
      $('loadInitial').onclick=()=>$('importInput').click();return;
    }
    renderHeader();renderControls();renderContent();
  }
  function openModal(title,body,save,label='保存'){
    $('modalTitle').textContent=title;$('modalBody').innerHTML=body;
    $('modalActions').innerHTML=save?'<button type="button" id="cancelModal">キャンセル</button><button type="submit" class="primary">'+esc(label)+'</button>':'';
    $('cancelModal')?.addEventListener('click',()=>$('modal').close());
    $('modalForm').onsubmit=e=>{e.preventDefault();if(save){try{save();}catch(err){showModalError(err.message);}}};
    if(!$('modal').open)$('modal').showModal();
  }
  function showModalError(s){let e=$('modalError');if(!e){e=document.createElement('p');e.id='modalError';e.className='notice';e.setAttribute('role','alert');$('modalBody').prepend(e);}e.textContent=s;}
  function commit(next,message='変更をこの端末に保存しました。',restoring=false){
    C.validate(next);
    if(storageIssue&&!restoring)throw new Error('保存データの読み込みに問題があります。JSONバックアップから復元してから編集してください。');
    let current;
    try{current=localStorage.getItem(KEY);}catch(e){throw new Error('端末の保存データを確認できませんでした。変更は適用していません。');}
    if(current!==storedRevision)throw new Error('別の画面でデータが更新されています。この画面を読み込み直してから編集してください。変更は適用していません。');
    const serialized=JSON.stringify(next);
    try{localStorage.setItem(KEY,serialized);}catch(e){throw new Error('端末に保存できませんでした。空き容量やブラウザの保存設定を確認してください。変更は適用していません。');}
    storedRevision=serialized;storageIssue='';
    db=next;idx=C.index(db);
    if(!idx.players.has(ui.selected))ui.selected=db.players[0].id;
    if(!idx.periods.has(ui.period))ui.period=db.periods.at(-1).id;
    ui.compare=ui.compare.filter(id=>idx.players.has(id));
    $('modal').close();render();notice(message);
  }
  function editRecord(id,period,competition='junni'){
    const ryuo=competition==='ryuo',directLoss=db.ryuo?.resultMode==='yellow-loss',p=idx.players.get(id),t=(ryuo?idx.ryuoPeriods:idx.periods).get(period),r=getStored(id,period,competition);
    const choices=ryuo?C.RYUO_COLORS:C.CLASS_COLORS;
    let body='<p class="dialog-note">'+esc(compName(competition))+'・年齢基準 '+esc(t.ageAt)+'。所属の色は自動で決まります。</p><div class="form-grid"><label>所属<input id="recordClass" maxlength="100" value="'+esc(C.classLabel(db,r))+'" list="classList"><datalist id="classList">'+Object.keys(choices).map(x=>'<option value="'+C.classText(x)+'"></option>').join('')+'</datalist></label><label>記録<select id="recordEvent">'+options([...(ryuo?[['auto','元データと次期の所属から自動判定']]:[]),['','なし'],...Object.entries(C.LABELS)],ryuo?(r?.recordEvent??'auto'):C.event(db,r))+'</select></label>';
    if(ryuo)body+='<label class="check wide"><input id="qualified" type="checkbox"'+(r?.qualified?' checked':'')+'>挑決</label><label class="check wide"><input id="groupWinner" type="checkbox"'+(r?.groupWinner?' checked':'')+'>組優勝</label>'+(directLoss?'<label class="check wide"><input id="sevenLoss" type="checkbox"'+(r?.loss?' checked':'')+'>七番勝負敗退（元シートの黄色）</label>':'<label class="check wide"><input id="challenger" type="checkbox"'+(r?.challenger?' checked':'')+'>竜王挑戦者（旧資料）</label>');
    else body+='<label class="wide">名人戦の対局前の立場<select id="recordRole">'+options([['','未確認・対象外'],['holder','名人'],['challenger','挑戦者']],r?.role||'')+'</select></label>';
    body+='</div><p class="dialog-note">出典：'+esc(r?.cell||'アプリ内入力')+(ryuo?'<br>勝利は次期の竜王から判定します。新資料の敗退指定は次期が空白でも有効で、敗退の指定が優先されます。所属の編集時は前期の自動判定も更新されます。':'<br>「宣言」「陥編」は所属に入力します。')+'</p>';
    openModal(p.name+' · '+compName(competition)+' 第'+period+'期',body,()=>{
      const className=$('recordClass').value.trim(),selection=$('recordEvent').value,next=clone(db);
      const collection=ryuo?next.ryuo.records:next.records,at=collection.findIndex(x=>x.player===id&&x.period===period);
      const row={...(r||{raw:'',fill:0}),player:id,period,className,editedAt:new Date().toISOString()};
      if(ryuo){row.competition='ryuo';row.qualified=$('qualified').checked;row.groupWinner=$('groupWinner').checked;if(directLoss){row.loss=$('sevenLoss').checked;row.challenger=false;}else row.challenger=$('challenger').checked;}
      else {row.role=$('recordRole').value;if(row.role!==r?.role)row.roleSource='アプリ内編集';}
      if(selection==='auto')delete row.recordEvent;else row.recordEvent=selection;
      if(!className&&!row.recordEvent&&!row.qualified&&!row.groupWinner&&!row.challenger&&!row.loss){if(at>=0){if(ryuo&&r.raw==='R')collection[at]=row;else collection.splice(at,1);}}else if(at>=0)collection[at]=row;else collection.push(row);
      commit(next);
    });
  }
  function editProfile(id){
    const p=idx.players.get(id);
    openModal(p?'棋士情報の編集':'棋士を追加','<div class="form-grid"><label class="wide">棋士名<input id="personName" required maxlength="100" value="'+esc(p?.name||'')+'"></label><label>棋士番号<input id="personNumber" maxlength="100" value="'+esc(p?.number||'')+'"></label><label>四段昇段年<input id="personPro" maxlength="100" value="'+esc(p?.proYear||'')+'"></label><label class="wide">生年月日（不明なら空欄）<input type="date" id="personBirth" value="'+esc(p?.birth||'')+'"></label></div><p class="dialog-note">年齢は順位戦年度末の3月31日時点で計算します。<br>生年月日の出典：'+esc(p?.birthSource?.cell||'アプリ内入力')+(p?.birthSource?' / 元の値：'+esc(p.birthSource.raw):'')+'</p>',()=>{
      const next=clone(db),birth=$('personBirth').value||null,name=$('personName').value.trim();
      if(!name)throw new Error('棋士名を入力してください。');
      if(next.players.some(x=>x.name===name&&x.id!==id))throw new Error('同じ名前の棋士が登録されています。');
      const item={...(p||{}),id:id||'user-'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2)),name,birth,number:$('personNumber').value||null,proYear:$('personPro').value,editedAt:new Date().toISOString()};
      if(p?.birth!==birth)item.birthEdited=true;
      if(p)next.players[next.players.findIndex(x=>x.id===id)]=item;else next.players.push(item);
      commit(next);ui.selected=item.id;ui.query='';ui.view='player';render();
    });
  }
  function editPeriod(id){const ps=parts(idx.periods.get(id));
    openModal('開催状況の設定',ps.map(p=>'<label>'+esc(compName(p.competition))+' 第'+p.meta.id+'期<select id="'+(p.competition==='ryuo'?'ryuoOngoing':'ongoing')+'">'+options([['yes','進行中'],['no','終了']],p.meta.ongoing?'yes':'no')+'</select></label>').join(''),()=>{const next=clone(db);for(const p of ps){const t=(p.competition==='ryuo'?next.ryuo.periods:next.periods).find(x=>x.id===p.meta.id);t.ongoing=$(p.competition==='ryuo'?'ryuoOngoing':'ongoing').value==='yes';}commit(next);});
  }
  function backup(prefix='backup'){const json=db?JSON.stringify(db,null,2):(storedRevision||'null'),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='banjo_kishi_stage19_4a_'+prefix+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function manage(){
    if(!db){openModal('データの読み込み','<p class="dialog-note">初期データJSONまたはバックアップを選んで、この端末へ読み込みます。</p><button type="button" id="chooseData">データファイルを選ぶ</button>',null);$('chooseData').onclick=()=>$('importInput').click();return;}
    openModal('データ管理','<p class="dialog-note">変更はこの端末・このブラウザに保存します。別端末へ移すときやアプリを置き換える前に、JSONバックアップを保存してください。</p><div class="management"><button type="button" id="exportButton">JSONバックアップを保存</button><button type="button" id="importButton">JSONを読み込む（追加・復元）</button><button type="button" id="phaseButton">第'+ui.period+'期の開催状況</button><button type="button" id="updateButton">アプリの更新を確認</button></div><p class="dialog-note">読み込み元：'+esc(db.source?.filename||'JSONバックアップ')+'<br>竜王戦の元資料：'+esc(db.ryuo?((db.ryuo.source?.filename||'')+' / '+(db.ryuo.source?.sheet||'')):'未追加')+'<br>タイトル戦の元資料：'+esc(db.titles?((db.titles.source?.filename||'')+' / '+(db.titles.source?.sheet||'')):'未追加')+'<br>取り込み範囲：順位戦、順位2の生年月日、竜王戦、棋戦。Excelの直接読み込みはこの試作には含みません。</p>',null);
    $('exportButton').onclick=()=>{backup();notice('バックアップの保存を開始しました。保存先のファイルを確認してください。');};
    $('importButton').onclick=()=>$('importInput').click();
    $('phaseButton').onclick=()=>editPeriod(ui.period);
    $('updateButton').onclick=async()=>{try{const reg=await navigator.serviceWorker?.getRegistration();if(!reg)return showModalError('ブラウザで配信URLを開いた場合に更新を確認できます。');await reg.update();showModalError(reg.waiting?'新しい版があります。このアプリの画面をすべて閉じてから開き直してください。':'更新確認を行いました。新しい版がある場合は、画面を閉じてから開き直してください。');}catch(e){showModalError('更新を確認できませんでした。接続を確認してください。');}};
  }
  $('importInput').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      if(file.size>20*1024*1024)throw new Error('この試作で復元できるJSONは20MBまでです。');
      const incoming=JSON.parse(await file.text()),addition=incoming.delivery==='ryuo-addition',replacement=incoming.delivery==='ryuo-source-replacement',titlesAddition=incoming.delivery==='titles-addition';
      const next=C.validate(incoming);delete next.delivery;
      if(titlesAddition&&db){
        const merged=C.mergeTitles(db,next);
        openModal('タイトル戦データを追加','<p class="dialog-note">タイトル戦を'+merged.added+'件追加します。既存のタイトル戦'+merged.kept+'件は端末での編集を含め保持します。順位戦・竜王戦・棋士情報は上書きしません。</p><p class="dialog-note">先に現在のバックアップを保存してください。必要な棋士情報は、元シートの名前のまま追加します。</p><button type="button" id="preBackup">現在のバックアップを保存</button><label class="check" style="margin-top:15px"><input id="restoreCheck" type="checkbox" required>現在のJSONバックアップを保存した</label>',()=>{if(!$('restoreCheck').checked)throw new Error('先にバックアップを保存してください。');commit(merged.data,'タイトル戦を追加しました。既存の記録は保持しています。');},'タイトル戦を追加');
        $('preBackup').onclick=()=>backup('before_titles_add');return;
      }
      if(replacement&&db){
        const changed=C.replaceRyuo(db,next);
        openModal('竜王戦データを差し替え','<p class="dialog-note">元資料を「竜王戦」シートに切り替えます。現在の竜王戦'+changed.replaced+'件を、新資料の'+changed.loaded+'件で全件差し替えます。</p><p class="dialog-note">順位戦と棋士情報は保持します。端末で編集した竜王戦の記録も差し替え対象です。先に現在のJSONを保存し、保存先のファイルを確認してください。</p><button type="button" id="preBackup">現在のバックアップを保存</button><label class="check" style="margin-top:15px"><input id="restoreCheck" type="checkbox" required>退避を確認し、竜王戦だけを差し替える</label>',()=>{if(!$('restoreCheck').checked)throw new Error('バックアップと差し替えの確認が必要です。');commit(changed.data,'竜王戦を新資料に差し替えました。順位戦と棋士情報は保持しています。');},'竜王戦だけ差し替える');
        $('preBackup').onclick=()=>backup('before_ryuo_replace');return;
      }
      if(addition&&db){
        const merged=C.mergeRyuo(db,next);
        openModal('竜王戦データを追加','<p class="dialog-note">竜王戦を'+merged.added+'件追加します。既存の竜王戦記録'+merged.kept+'件は保持します。棋士情報と順位戦の編集内容は上書きしません。</p><button type="button" id="preBackup">現在のバックアップを保存</button><label class="check" style="margin-top:15px"><input id="restoreCheck" type="checkbox" required>現在のJSONバックアップを保存した</label>',()=>{if(!$('restoreCheck').checked)throw new Error('先にバックアップを保存してください。');commit(merged.data,'竜王戦を追加しました。順位戦と棋士情報は保持しています。');},'竜王戦を追加');
        $('preBackup').onclick=()=>backup('before_ryuo_add');return;
      }
      if(!db&&!storedRevision){
        openModal('初期データを読み込む','<p class="dialog-note">'+next.players.length+'棋士・'+next.periods.length+'期のデータを、この端末に保存します。ファイルを外部へ送信しません。</p>',()=>commit(next,'データをこの端末に読み込みました。',true),'この端末に読み込む');return;
      }
      openModal('バックアップを復元','<p class="dialog-note">'+next.players.length+'棋士・'+next.periods.length+'期のデータで、現在の端末のデータを置き換えます。</p><p class="dialog-note">先に現在のJSONバックアップを保存し、保存できたことを確認してから復元してください。</p><button type="button" id="preBackup">現在のバックアップを保存</button><label class="check" style="margin-top:15px"><input id="restoreCheck" type="checkbox" required>現在のデータを退避し、置き換えることを確認した</label>',()=>{if(!$('restoreCheck').checked)throw new Error('退避と置き換えの確認が必要です。');commit(next,'JSONバックアップから復元しました。',true);},'このデータで復元');
      $('preBackup').onclick=()=>backup('before_restore');
    }catch(err){if(!$('modal').open)openModal('読み込みエラー','<p class="dialog-note">'+esc(err.message)+'</p>',null);else showModalError(err.message);}
  });
  function rules(){openModal('データの読み方','<ul><li>タイトル戦は「棋戦」シートの確定順を保持し、年度は名人戦年度です。棋士別年表は順位戦年度から翌春の名人戦までで区切り、名人戦以外は出典の年度を順位戦年度へ対応させます。名人戦は各順位戦期の対応する名人戦年度から配置し、年度の最後に表示します。第30期は第35期名人戦につながり、単純に同じ期数で対応させません。移行期の補足は1976年度・対応名人戦年度1977です。各棋戦の公式年度への読み替えと同年齢比較への追加は行いません。</li><li>タイトル戦の獲得数は「獲・防・奪・留」を合計します。「留」は留位として表示し獲得に含めます。登場数は元シートの記録件数で、留位を含み、実際の番勝負数とは区別します。</li><li>「挑」は挑戦敗退を表し、アプリでは「挑戦」と短縮表示します。「対」は意味未確認の元記号を保持します。棋士の人数は固定せず、初期名人戦の相手や挑戦者を作りません。色・永世称号資格の囲み罫線は取り込みません。</li><li>タイトル戦と順位戦・竜王戦の集計は各元資料ごとに独立して表示します。資料の収録範囲が異なっても相互に補完しません。</li><li>所属の色はクラス別に固定し、結果とは分けて表示します。</li><li>「宣言」「陥編」は所属に表示し、記録欄には重ねて表示しません。</li><li>名人戦登場は七番勝負の勝利と敗退の合計。名人獲得は防衛を含む七番勝負の勝利回数です。</li><li>名人・挑戦者の立場が確認された記録のみ「防衛」「獲得ならず」などに分けます。</li><li>昇級・降級・休場は記録欄に表示します。</li><li>初期のB・Cはそのまま表示。第30期の次は第36期で、欠番を生成しません。</li><li>年齢は順位戦年度末の3月31日時点。生年月日不明は不明のままです。</li><li>空白から引退確定日・引退日・翌年度の対局の有無を推定しません。</li></ul><p class="dialog-note">竜王戦の「R」は引退のメモで、所属は空白として扱います。Rだけの記録は通常の年表・クラス推移・収録件数に含めません。元の記号は保存し、引退日は推定しません。新資料「竜王戦」は太字が挑決、下線が組優勝、黄色が七番勝負敗退。勝利は次期の竜王から当期へ記録します。黄色の敗退指定は次期が空白でも有効です。旧資料は差し替え完了まで旧判定で読みます。竜王戦39期は順位戦84期と並べ、2026年3月31日を年齢基準とします。</p>',null);}
  $('dataButton').onclick=manage;$('rulesButton').onclick=rules;$('closeModal').onclick=()=>$('modal').close();
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ui.view=b.dataset.view;render();});
  render();if(storageIssue)notice(storageIssue);
  async function setupOffline(){
    const el=$('offlineStatus');
    if(location.protocol==='file:'){el.textContent='ファイルで閲覧中 · 配信URLではPWAとして保存可能';return;}
    if(!('serviceWorker' in navigator)){el.textContent='このブラウザはPWA保存に未対応';return;}
    try{
      const reg=await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      const worker=reg.active;if(!worker){el.textContent='オフライン準備中';return;}
      const ready=await new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(false);},6000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(!!e.data?.ready);};worker.postMessage('CHECK_SHELL',[channel.port2]);});
      el.textContent=ready?'オフライン利用の準備完了':'オフライン保存を確認できませんでした';
      if(reg.waiting)notice('新しい版があります。このアプリの画面をすべて閉じて開き直すと更新されます。');
    }catch(e){el.textContent='オフライン保存未完了 · 通信時に再度開いてください';}
  }
  setupOffline();
})();
