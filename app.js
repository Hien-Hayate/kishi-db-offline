/* Stage19-2. No network services, account, or external library is required. */
(function(){
  'use strict';
  const C=window.KishiCore, KEY='banjo-kishi-db-v1', $=id=>document.getElementById(id);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db=null, idx, storageIssue='',storedRevision=null;
  try{storedRevision=localStorage.getItem(KEY);if(storedRevision)db=C.validate(JSON.parse(storedRevision));}catch(e){storageIssue='保存データを読み込めなかったため、データの読み込み画面を表示しています。保存済みデータは削除していません。編集する前にJSONバックアップから復元してください。';}
  if(db)C.validate(db);idx=C.index(db||{records:[],players:[],periods:[]});
  const ui={view:'player',selected:db?.players[0]?.id||null,query:'',rosterTop:0,competition:'junni',period:85,klass:'',event:'',blank:false,compare:[]};
  if(db&&!idx.periods.has(ui.period))ui.period=db.periods.at(-1).id;
  const VIEW_KEY='banjo-kishi-view-v1';
  try{const v=JSON.parse(localStorage.getItem(VIEW_KEY)||'null');if(v&&db&&idx.players.has(v.selected)&&typeof v.query==='string'&&v.query.length<200&&Number.isFinite(v.top)&&v.top>=0){ui.selected=v.selected;ui.query=v.query;ui.rosterTop=v.top;if(['junni','ryuo','both'].includes(v.competition))ui.competition=v.competition;}}catch(e){}
  function rememberList(){try{localStorage.setItem(VIEW_KEY,JSON.stringify({selected:ui.selected,query:ui.query,top:ui.rosterTop,competition:ui.competition}));}catch(e){}}
  const get=(id,p,competition='junni')=>(competition==='ryuo'?idx.ryuoRecords:idx.records).get(id+':'+p);
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
  function badge(r){if(!r)return '';return '<span class="badge"'+(color(r)?' style="background:'+color(r)+'"':'')+'>'+ (esc(C.displayClass(db,r))||'&nbsp;')+'</span>';}
  function recordButton(id,p,r,competition='junni'){const label=C.displayClass(db,r)||'空白';return '<button class="'+(r?'edit-cell':'blank')+'" data-edit="'+esc(id)+'" data-period="'+p+'" data-competition="'+competition+'" aria-label="第'+p+'期 '+esc(label)+'の記録を編集">'+badge(r)+'</button>';}
  function options(items,value){return items.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('');}
  function renderHeader(){
    $('sourceCount').textContent=db.players.length+'棋士 / '+db.periods.length+'期'+(db.ryuo?' / 竜王'+db.ryuo.periods.length+'期':'');
    const p=db.periods.at(-1);$('sourcePeriod').textContent='順位戦 第'+p.id+'期'+(db.ryuo?' / 竜王戦 第'+db.ryuo.periods.at(-1).id+'期':' / 竜王戦は未追加');
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===ui.view)));
  }
  function renderControls(){
    let h='';
    if(ui.view==='player')h='<label class="search">棋士名で探す<input id="search" type="search" placeholder="棋士名を入力" value="'+esc(ui.query)+'" autocomplete="off"></label><label class="check"><input type="checkbox" id="showBlank"'+(ui.blank?' checked':'')+'>空白の期も表示</label><button id="addPlayer">棋士追加</button>';
    if(ui.view==='season'){
      h='<label>期<select id="periodSelect">'+options([...years()].reverse().map(p=>[p.id,seasonLabel(p)]),ui.period)+'</select></label>';
      h+='<label>所属<select id="classFilter">'+options([['','すべて'],...[...new Set([...(ui.competition!=='ryuo'?Object.keys(C.CLASS_COLORS):[]),...(ui.competition!=='junni'?Object.keys(C.RYUO_COLORS):[])])].map(x=>[x,x])],ui.klass)+'</select></label>';
      h+='<label>記録<select id="eventFilter">'+options([['','すべて'],...Object.entries(C.LABELS),...(ui.competition!=='junni'?[['qualified','挑決'],['groupWinner','組優勝']]:[])],ui.event)+'</select></label>';
      h+='<label class="check"><input type="checkbox" id="showBlank"'+(ui.blank?' checked':'')+'>空白の棋士も表示</label>';
    }
    if(ui.view==='compare')h='<label class="choose">比較する棋士<select id="compareSelect">'+options([['','棋士を選択'],...db.players.map(p=>[p.id,p.name])],'')+'</select></label><button id="addCompare">比較に追加</button><span class="muted">最大4人</span>';
    $('controls').innerHTML='<label>棋戦<select id="competitionSelect">'+options([['junni','順位戦'],['ryuo','竜王戦'],['both','両方']],ui.competition)+'</select></label>'+h;
    $('competitionSelect').addEventListener('change',e=>{ui.competition=e.target.value;ui.klass='';ui.event='';if(ui.competition==='both'&&db.ryuo&&!db.ryuo.periods.some(p=>p.junniPeriod===ui.period))ui.period=db.ryuo.periods.at(-1).junniPeriod;ensurePeriod();render();rememberList();});
    $('search')?.addEventListener('input',e=>{ui.query=e.target.value;const list=nameList();if(list.length&&!list.some(p=>p.id===ui.selected))ui.selected=list[0].id;renderContent(true);rememberList();});
    $('showBlank')?.addEventListener('change',e=>{ui.blank=e.target.checked;renderContent();});
    $('addPlayer')?.addEventListener('click',()=>editProfile(null));
    $('periodSelect')?.addEventListener('change',e=>{ui.period=Number(e.target.value);renderContent();});
    $('classFilter')?.addEventListener('change',e=>{ui.klass=e.target.value;renderContent();});
    $('eventFilter')?.addEventListener('change',e=>{ui.event=e.target.value;renderContent();});
    $('addCompare')?.addEventListener('click',()=>{const id=$('compareSelect').value;if(!id)return;if(ui.compare.includes(id))return notice('その棋士は比較に追加済みです。');if(ui.compare.length>=4)return notice('比較は4人までです。');ui.compare.push(id);notice('');renderContent();});
  }
  function renderPlayer(){
    const list=nameList(),p=idx.players.get(ui.selected);
    let h='<div class="split"><aside class="roster"><div class="roster-heading">棋士一覧 <span>'+list.length+'人</span></div><div class="roster-list" id="rosterList">';
    h+=list.map(x=>'<button data-player="'+esc(x.id)+'" class="'+(x.id===ui.selected?'active':'')+'"'+(x.id===ui.selected?' aria-current="true"':'')+'><span>'+esc(x.name)+'</span><small>'+esc(x.number?'No. '+x.number:'')+'</small></button>').join('')||'<p class="empty">該当する棋士はいません。</p>';
    h+='</div></aside>';
    if(!list.length)return h+'<div class="profile empty">棋士名を変えて検索してください。</div></div>';
    const rs=forPlayer(p.id),birth=p.birth||'不明';
    h+='<article class="profile"><div class="profile-header"><div><p class="eyebrow">'+esc(p.number?'棋士番号 '+p.number:'棋士別記録')+'</p><h2>'+esc(p.name)+'</h2><div class="profile-meta">生年月日 '+esc(birth)+'<br>四段昇段年 '+esc(p.proYear||'不明')+'</div></div><button id="editProfile">棋士情報編集</button></div>';
    h+='<div class="summary"><div><strong>'+rs.length+'件</strong><small>収録された記録数</small></div>';
    for(const c of ['junni','ryuo']){if(ui.competition!=='both'&&ui.competition!==c)continue;if(c==='ryuo'&&!db.ryuo){h+='<div><strong>未追加</strong><small>竜王戦データ</small></div>';continue;}const stats=C.titleStats(db,rs.filter(x=>x.competition===c).map(x=>x.r)),title=c==='ryuo'?'竜王':'名人';h+='<div><strong>'+stats.appearances+'回</strong><small>'+title+'戦登場</small></div><div><strong>'+stats.wins+'回</strong><small>'+title+'獲得</small></div>';}
    h+='</div>';
    if(rs.length)h+='<div class="ribbon" aria-label="クラス推移">'+years().filter(t=>parts(t).some(part=>get(p.id,part.meta.id,part.competition))).map(t=>'<div class="ribbon-item">'+parts(t).map(part=>{const r=get(p.id,part.meta.id,part.competition);return '<span>'+ (part.competition==='ryuo'?'竜':'順')+part.meta.id+'期</span><button data-scroll="'+t.id+'" style="'+(color(r)?'background:'+color(r):'')+'" aria-label="'+esc(compName(part.competition))+'第'+part.meta.id+'期の行へ">'+(esc(C.displayClass(db,r))||'&nbsp;')+'</button>';}).join('')+'</div>').join('')+'</div>';
    h+='<div class="table-wrap"><table><thead><tr><th>棋戦・期</th><th>年度末年齢</th><th>所属</th><th>記録</th></tr></thead><tbody>';
    for(const t of [...years()].reverse()){
      const ps=parts(t);if(!ui.blank&&!ps.some(part=>get(p.id,part.meta.id,part.competition)))continue;
      ps.forEach((part,i)=>{const r=get(p.id,part.meta.id,part.competition),age=C.ageAt(p.birth,part.meta.ageAt);
        h+='<tr'+(i===0?' id="period-row-'+t.id+'"':'')+'><td><button class="period-link" data-season="'+t.id+'">'+esc(compName(part.competition))+' '+part.meta.id+'期</button><span class="sub">基準 '+esc(part.meta.ageAt)+'</span></td>'+(i===0?'<td rowspan="'+ps.length+'">'+esc(age===null?'不明':age+'歳')+'</td>':'')+'<td>'+recordButton(p.id,part.meta.id,r,part.competition)+'</td><td class="event">'+esc(r?C.describe(db,r):'')+'</td></tr>';
      });
    }
    h+='</tbody></table>'+(rs.length?'':'<p class="empty">記録はありません。空白の期を表示して記録を追加できます。</p>')+'</div></article></div>';return h;
  }
  function renderSeason(){
    const t=idx.periods.get(ui.period);
    if(!t)return '<p class="empty">対応する期がありません。</p>';
    const ps=parts(t),list=db.players.filter(p=>ps.some(part=>{const r=get(p.id,part.meta.id,part.competition);return (r||ui.blank)&&(!ui.klass||C.displayClass(db,r)===ui.klass)&&C.matchesEvent(db,r,ui.event);}));
    let h='<article class="profile"><div class="section-head"><div><p class="eyebrow">年齢基準 '+esc(t.ageAt)+'</p><h2>'+esc(seasonLabel(t))+'</h2><p>'+list.length+'人を表示'+(ui.competition==='both'&&ps.length===1?' · 対応する竜王戦データなし':'')+(t.ongoing?' · 順位戦進行中':'')+(t.note?'<br>'+esc(t.note):'')+'</p></div><button id="editPeriod">期の設定</button></div><div class="table-wrap"><table><thead><tr><th>棋士</th><th>年度末年齢</th><th>棋戦・所属</th><th>記録</th></tr></thead><tbody>';
    h+=list.map(p=>ps.map((part,i)=>{const r=get(p.id,part.meta.id,part.competition),age=C.ageAt(p.birth,part.meta.ageAt);return '<tr>'+(i===0?'<td rowspan="'+ps.length+'"><button class="period-link" data-open-player="'+esc(p.id)+'">'+esc(p.name)+'</button></td><td rowspan="'+ps.length+'">'+esc(age===null?'不明':age+'歳')+'</td>':'')+'<td><span class="sub">'+esc(compName(part.competition))+' '+part.meta.id+'期</span>'+recordButton(p.id,part.meta.id,r,part.competition)+'</td><td class="event">'+esc(r?C.describe(db,r):'')+'</td></tr>';}).join('')).join('');
    return h+'</tbody></table>'+(list.length?'':'<p class="empty">条件に合う記録はありません。</p>')+'</div></article>';
  }
  function renderCompare(){
    const people=ui.compare.map(id=>idx.players.get(id)).filter(Boolean);
    let h='<p class="hint">年齢は各期の年度末（3月31日）で統一。生年月日が不明の棋士は年齢へ対応させません。</p><div class="chips">'+people.map(p=>'<button class="chip" data-remove="'+esc(p.id)+'" aria-label="'+esc(p.name)+'を比較から外す">'+esc(p.name)+' ×</button>').join('')+'</div>';
    if(!people.length)return h+'<div class="profile empty">比較する棋士を選んで追加してください。</div>';
    const maps=people.map(p=>{const m=new Map();for(const x of forPlayer(p.id)){const a=C.ageAt(p.birth,x.meta.ageAt);if(a!==null){const entries=m.get(a)||[];entries.push(x);m.set(a,entries);}}return m;});
    const ages=[...new Set(maps.flatMap(m=>[...m.keys()]))].sort((a,b)=>a-b);
    h+='<article class="profile"><div class="table-wrap"><table class="compare-table"><thead><tr><th>年度末年齢</th>'+people.map(p=>'<th>'+esc(p.name)+(p.birth?'':'<span class="sub">生年月日不明</span>')+'</th>').join('')+'</tr></thead><tbody>';
    h+=ages.map(a=>'<tr><td>'+a+'歳</td>'+maps.map(m=>'<td>'+ (m.get(a)||[]).map(({r,t,meta,competition})=>'<div class="comparison-part"><span class="sub">'+esc(compName(competition))+' 第'+meta.id+'期</span>'+recordButton(r.player,meta.id,r,competition)+'<span class="sub">基準 '+esc(meta.ageAt)+'</span><span class="sub">'+esc(C.describe(db,r))+'</span></div>').join('')+'</td>').join('')+'</tr>').join('');
    return h+'</tbody></table>'+(ages.length?'':'<p class="empty">年齢に対応できる記録がありません。</p>')+'</div></article>';
  }
  function renderContent(resetRoster=false){
    const oldRoster=$('rosterList');if(resetRoster)ui.rosterTop=0;else if(oldRoster)ui.rosterTop=oldRoster.scrollTop||0;
    if(ui.competition==='ryuo'&&!db.ryuo){$('content').innerHTML='<article class="profile empty">竜王戦データは未追加です。<br><button id="loadRyuo">追加用JSONを選ぶ</button></article>';$('loadRyuo').onclick=()=>$('importInput').click();return;}
    $('content').innerHTML=(ui.competition==='both'&&!db.ryuo?'<p class="hint">竜王戦は未追加です。「データ管理」から追加用JSONを読み込めます。</p>':'')+(ui.view==='player'?renderPlayer():ui.view==='season'?renderSeason():renderCompare());
    if($('rosterList'))$('rosterList').scrollTop=ui.rosterTop;
    $('editProfile')?.addEventListener('click',()=>editProfile(ui.selected));
    $('editPeriod')?.addEventListener('click',()=>editPeriod(ui.period));
    $('content').querySelectorAll('[data-player],[data-open-player]').forEach(b=>b.addEventListener('click',()=>{ui.selected=b.dataset.player||b.dataset.openPlayer;ui.view='player';if(b.dataset.openPlayer){ui.query='';ui.rosterTop=0;}render();rememberList();}));
    $('content').querySelectorAll('[data-season]').forEach(b=>b.addEventListener('click',()=>{ui.period=Number(b.dataset.season);ui.view='season';render();}));
    $('content').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editRecord(b.dataset.edit,Number(b.dataset.period),b.dataset.competition||'junni')));
    $('content').querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>{const row=$('period-row-'+b.dataset.scroll);row?.scrollIntoView({behavior:'smooth',block:'center'});}));
    $('content').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{ui.compare=ui.compare.filter(id=>id!==b.dataset.remove);renderContent();}));
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
    const ryuo=competition==='ryuo',p=idx.players.get(id),t=(ryuo?idx.ryuoPeriods:idx.periods).get(period),r=get(id,period,competition);
    const choices=ryuo?C.RYUO_COLORS:C.CLASS_COLORS;
    let body='<p class="dialog-note">'+esc(compName(competition))+'・年齢基準 '+esc(t.ageAt)+'。所属の色は自動で決まります。</p><div class="form-grid"><label>所属<input id="recordClass" maxlength="100" value="'+esc(C.displayClass(db,r))+'" list="classList"><datalist id="classList">'+Object.keys(choices).map(x=>'<option value="'+x+'"></option>').join('')+'</datalist></label><label>記録<select id="recordEvent">'+options([...(ryuo?[['auto','次期の所属から自動判定']]:[]),['','なし'],...Object.entries(C.LABELS)],ryuo?(r?.recordEvent??'auto'):C.event(db,r))+'</select></label>';
    if(ryuo)body+='<label class="check wide"><input id="qualified" type="checkbox"'+(r?.qualified?' checked':'')+'>挑決</label><label class="check wide"><input id="groupWinner" type="checkbox"'+(r?.groupWinner?' checked':'')+'>組優勝</label><label class="check wide"><input id="challenger" type="checkbox"'+(r?.challenger?' checked':'')+'>竜王挑戦者（自動判定用）</label>';
    else body+='<label class="wide">名人戦の対局前の立場<select id="recordRole">'+options([['','未確認・対象外'],['holder','名人'],['challenger','挑戦者']],r?.role||'')+'</select></label>';
    body+='</div><p class="dialog-note">出典：'+esc(r?.cell||'アプリ内入力')+(ryuo?'<br>自動判定では次期の所属が空白のとき、勝敗を表示しません。所属を編集すると前期の結果も再判定されます。':'<br>「宣言」「陥編」は所属に入力します。')+'</p>';
    openModal(p.name+' · '+compName(competition)+' 第'+period+'期',body,()=>{
      const className=$('recordClass').value.trim(),selection=$('recordEvent').value,next=clone(db);
      const collection=ryuo?next.ryuo.records:next.records,at=collection.findIndex(x=>x.player===id&&x.period===period);
      const row={...(r||{raw:'',fill:0}),player:id,period,className,editedAt:new Date().toISOString()};
      if(ryuo){row.competition='ryuo';row.qualified=$('qualified').checked;row.groupWinner=$('groupWinner').checked;row.challenger=$('challenger').checked;}
      else {row.role=$('recordRole').value;if(row.role!==r?.role)row.roleSource='アプリ内編集';}
      if(selection==='auto')delete row.recordEvent;else row.recordEvent=selection;
      if(!className&&!row.recordEvent&&!row.qualified&&!row.groupWinner&&!row.challenger){if(at>=0)collection.splice(at,1);}else if(at>=0)collection[at]=row;else collection.push(row);
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
  function backup(prefix='backup'){const json=db?JSON.stringify(db,null,2):(storedRevision||'null'),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='banjo_kishi_stage19_2_'+prefix+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function manage(){
    if(!db){openModal('データの読み込み','<p class="dialog-note">初期データJSONまたはバックアップを選んで、この端末へ読み込みます。</p><button type="button" id="chooseData">データファイルを選ぶ</button>',null);$('chooseData').onclick=()=>$('importInput').click();return;}
    openModal('データ管理','<p class="dialog-note">変更はこの端末・このブラウザに保存します。別端末へ移すときやアプリを置き換える前に、JSONバックアップを保存してください。</p><div class="management"><button type="button" id="exportButton">JSONバックアップを保存</button><button type="button" id="importButton">JSONを読み込む（追加・復元）</button><button type="button" id="phaseButton">第'+ui.period+'期の開催状況</button><button type="button" id="updateButton">アプリの更新を確認</button></div><p class="dialog-note">読み込み元：'+esc(db.source?.filename||'JSONバックアップ')+'<br>取り込み範囲：順位戦、順位2の生年月日、追加後は竜王戦2。Excelの直接読み込みはこの試作には含みません。</p>',null);
    $('exportButton').onclick=()=>{backup();notice('バックアップの保存を開始しました。保存先のファイルを確認してください。');};
    $('importButton').onclick=()=>$('importInput').click();
    $('phaseButton').onclick=()=>editPeriod(ui.period);
    $('updateButton').onclick=async()=>{try{const reg=await navigator.serviceWorker?.getRegistration();if(!reg)return showModalError('ブラウザで配信URLを開いた場合に更新を確認できます。');await reg.update();showModalError(reg.waiting?'新しい版があります。このアプリの画面をすべて閉じてから開き直してください。':'更新確認を行いました。新しい版がある場合は、画面を閉じてから開き直してください。');}catch(e){showModalError('更新を確認できませんでした。接続を確認してください。');}};
  }
  $('importInput').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      if(file.size>20*1024*1024)throw new Error('この試作で復元できるJSONは20MBまでです。');
      const incoming=JSON.parse(await file.text()),addition=incoming.delivery==='ryuo-addition';
      const next=C.validate(incoming);delete next.delivery;
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
  function rules(){openModal('データの読み方','<ul><li>所属の色はクラス別に固定し、結果とは分けて表示します。</li><li>「宣言」「陥編」は所属に表示し、記録欄には重ねて表示しません。</li><li>名人戦登場は七番勝負の勝利と敗退の合計。名人獲得は防衛を含む七番勝負の勝利回数です。</li><li>名人・挑戦者の立場が確認された記録のみ「防衛」「獲得ならず」などに分けます。</li><li>昇級・降級・休場は記録欄に表示します。</li><li>初期のB・Cはそのまま表示。第30期の次は第36期で、欠番を生成しません。</li><li>年齢は順位戦年度末の3月31日時点。生年月日不明は不明のままです。</li><li>空白から引退確定日・引退日・翌年度の対局の有無を推定しません。</li></ul><p class="dialog-note">竜王戦は太字が挑決、下線が組優勝。次期が竜なら当期の七番勝負勝利、当期が竜または黄色で次期が竜以外なら敗退。次期が空白なら判定しません。竜王戦39期は順位戦84期と並べ、2026年3月31日を年齢基準とします。</p>',null);}
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
