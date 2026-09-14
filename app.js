/* Public observatory UI. Does not send model requests or contain API credentials. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const L = window.ObservatoryLogic;
  const cfg = window.OBS_CONFIG;
  const LABELS = {ok:'通过', wrong:'未通过', mixed:'混合结果', error:'请求失败', none:'无数据', running:'检测中'};
  const CANDY_INTRO = '你正在参加一个可复核的逻辑推理测试。不使用任何外部工具。\n\n黑色袋子里有三种口味的糖果：苹果味、桃子味、西瓜味；每种口味都有圆形和五角星形两种形状，形状可以靠手感辨别。糖果数量如下：';
  const CANDY_TABLE = '        苹果味  桃子味  西瓜味\n圆形       5      5      5\n五角星形   5      5      5';
  const CANDY_RULES = '现在从袋中不放回地盲取糖果。要算“成功”，手中必须同时出现以下两种糖果中的至少一种组合：\n1. 圆形苹果味 + 五角星形桃子味；\n2. 圆形桃子味 + 五角星形苹果味。\n\n问题：最少取出多少颗糖果，才能保证一定成功？请给出简短、可核验的最坏情况证明。\n\n判定方法提示（不是答案）：请用“最大失败集合 + 1”的方法求最小保证数量。要分别检查同时避开两种成功组合的四种可能，不要只给出一个足够但不一定最小的分情况上界。\n\n输出协议（必须严格遵守）：\n- 只输出一个 JSON 对象；不要输出 Markdown、代码围栏、前后解释或其他文字。\n- JSON 必须有两个字段：final_answer（整数）和 reason（字符串）。\n- final_answer 只能填写你推理得到的最小数量；不要猜测或照抄任何预设答案。\n- reason 用不超过两句话说明“为什么少一颗仍可能失败，以及为什么再多一颗就一定成功”。';
  const PROMPTS = {candy: CANDY_INTRO + '\n\n' + CANDY_TABLE + '\n\n' + CANDY_RULES, pelican:'创建一个 HTML，内容是 SVG 绘制一个鹈鹕骑自行车的 2D 动画,不要使用任何技能'};
  let state = null, archive = null, filter = 'all', search = '', currentPrompt = '', currentDrawing = null;
  let visibleDrawings = [], refreshTimer = null, toastTimer = null;
  const frameCache = new Map();
  const viewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const stage = entry.target;
      if (entry.isIntersecting && !stage.querySelector('iframe')) mountThumb(stage);
      if (!entry.isIntersecting) stage.querySelector('iframe')?.remove();
    });
  }, {rootMargin:'100px'}) : null;
  const sizeObserver = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    entries.forEach(entry => scaleThumb(entry.target));
  }) : null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function fmt(value, dateOnly = false) {
    if (!value) return '未提供时间';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '未提供时间';
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:cfg.timeZone, month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(d);
    const p = Object.fromEntries(parts.map(x => [x.type,x.value]));
    return dateOnly ? `${p.month}-${p.day}` : `${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }
  function hour(value) {
    return new Intl.DateTimeFormat('en-GB', {timeZone:cfg.timeZone, hour:'2-digit', hourCycle:'h23'}).format(new Date(value)) + '时';
  }
  function toast(text) {
    clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  async function decodeArchive() {
    if (!('DecompressionStream' in window)) throw new Error('浏览器不支持档案解压，请使用较新的 Chrome、Edge、Firefox 或 Safari。');
    const bytes = Uint8Array.from(atob(window.OBS_ARCHIVE_B64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return validate(await new Response(stream).json());
  }
  function validate(data) {
    if (!data || data.schema_version !== 1 || !Array.isArray(data.candy) || !Array.isArray(data.pelicans)) throw new Error('监测数据格式不正确。');
    if (!['archive','live'].includes(data.mode) || !Number.isFinite(Date.parse(data.as_of))) throw new Error('缺少有效的数据模式或时间。');
    if (data.candy.length > 5000 || data.pelicans.length > 1000) throw new Error('单次数据量过大。');
    if (Date.parse(data.as_of) > Date.now() + 300000) throw new Error('数据时间位于未来，请检查服务端时钟。');
    const candy = data.candy.map((row,i) => ({
      id:String(row.id || `candy-${i+1}`), timestamp:row.timestamp || null,
      status:['completed','error','running','none'].includes(row.status) ? row.status : 'error',
      final_answer:row.final_answer ?? null, answer:String(row.answer || '').slice(0,100000),
      elapsed_seconds:typeof row.elapsed_seconds === 'number' && Number.isFinite(row.elapsed_seconds) && row.elapsed_seconds >= 0 ? row.elapsed_seconds : null,
      model:String(row.model || '未提供模型'), reasoning_effort:String(row.reasoning_effort || '未提供'), http_status:row.http_status
    }));
    const pelicans = data.pelicans.slice(0,Math.min(cfg.maxDrawings || 200,200)).map((row,i) => ({
      id:String(row.id || `pelican-${i+1}`), trial:Number(row.trial || i+1), account_label:String(row.account_label || ''),
      date:String(row.date || ''), timestamp:row.timestamp || null, model:String(row.model || '未提供模型'), reasoning_effort:String(row.reasoning_effort || '未提供'),
      elapsed_seconds:typeof row.elapsed_seconds === 'number' && Number.isFinite(row.elapsed_seconds) && row.elapsed_seconds >= 0 ? row.elapsed_seconds : null,
      review_status:['unreviewed','flagged','reviewed'].includes(row.review_status) ? row.review_status : 'unreviewed',
      html:typeof row.html === 'string' ? row.html.slice(0,250000) : '', retried:row.retried === true
    }));
    if (new Set(candy.map(x => x.id)).size !== candy.length || new Set(pelicans.map(x => x.id)).size !== pelicans.length) throw new Error('数据中存在重复编号。');
    return {...data,candy,pelicans};
  }
  async function loadFeed() {
    const url = new URL(cfg.feedUrl,location.href);
    if (!['http:','https:'].includes(url.protocol) || url.origin !== location.origin || url.username || url.password) throw new Error('公开数据接口必须与页面同源。');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if (!response.ok) throw new Error(`监测接口 HTTP ${response.status}`);
      return validate(await response.json());
    } finally { clearTimeout(timeout); }
  }
  async function refresh(manual = false) {
    $('refresh').disabled = true;
    try {
      if (!archive) archive = await decodeArchive();
      state = cfg.feedUrl ? await loadFeed() : archive;
      render();
      if (manual) toast(state.mode === 'archive' ? '已重新读取历史档案，未发起模型请求。' : '已读取公开监测数据，未从浏览器发起模型请求。');
    } catch (error) {
      if (!state && archive) { state = archive; render(); }
      $('data-message').textContent = `数据读取失败：${error.message}${state ? ' 当前保留旧记录，不代表当前监测状态。' : ''}`;
      $('protocol-state').textContent = '数据读取异常 · 未确认实时状态';
      if (manual) toast('读取失败，未修改已有测试记录。');
    } finally { $('refresh').disabled = false; }
  }
  function render() {
    frameCache.clear();
    const archived = state.mode === 'archive';
    const stale = !archived && Date.now() - Date.parse(state.as_of) > 2 * (cfg.refreshMs || L.STEP);
    const latest = state.candy.filter(r => r.timestamp).slice().sort((a,b) => Date.parse(b.timestamp)-Date.parse(a.timestamp))[0];
    const counts = L.summarize(state.candy);
    $('protocol-state').textContent = archived ? '历史样本 · 实时探测待接入' : stale ? '记录已过期 · 等待新数据' : '已接入公开监测数据';
    $('data-message').textContent = archived
      ? `已导入 ${state.archive_date || '2026-09-14'} 测试档案：${state.candy.length} 条糖果回答、${state.pelicans.length} 份鹈鹕 HTML。当前不是实时监测；服务端探测接入后每 10 分钟更新。`
      : `${stale ? '数据已过期。' : '已接入公开数据。'}服务端记录截至 ${fmt(state.as_of)}，页面每 10 分钟读取一次结果；浏览器不会调用模型。`;
    $('rate-label').textContent = archived ? '样本回答通过率' : '窗口回答通过率';
    // Live feeds may contain older records: the summary must use the same visible window.
    const reference = archived ? state.as_of : new Date().toISOString();
    const slots = L.bucketize(state.candy,reference);
    const windowRows = slots.flatMap(slot => slot.rows);
    const displayedCounts = archived ? counts : L.summarize(windowRows);
    $('pass-rate').textContent = displayedCounts.rate === null ? '—' : `${(displayedCounts.rate*100).toFixed(displayedCounts.rate === 1 ? 0 : 1)}%`;
    $('pass-count').textContent = `${displayedCounts.ok} / ${displayedCounts.valid}`;
    $('wrong-count').textContent = displayedCounts.wrong;
    $('error-count').textContent = displayedCounts.error;
    const next = !archived && !stale && Number.isFinite(Date.parse(state.next_probe_at)) && Date.parse(state.next_probe_at) > Date.now() ? fmt(state.next_probe_at) : archived ? '待接入' : '等待新记录';
    $('spectrum-time').textContent = `最近记录 ${latest ? fmt(latest.timestamp) : '—'} · 下次探测 ${next}`;
    renderSpectrum(slots,archived);
    renderLatency(archived ? state.candy : windowRows);
    $('gallery-source').replaceChildren(el('span',`dot ${archived || stale ? 'archive-dot' : 'live-dot'}`),document.createTextNode(archived ? '已导入原始样本' : stale ? '旧记录 · 等待更新' : '来自公开监测接口'));
    $('gallery-summary').textContent = `共 ${state.pelicans.length} 份 · ${state.pelicans.filter(x=>x.review_status==='unreviewed').length} 份待复核`;
    $('gallery-note').textContent = archived
      ? '这 20 份预览分别对应 ZIP 中的 20 个原始 HTML，未用复制图替代独立结果。#01 完成产物包含补跑；所有画面均按原始 HTML 保留。动画可运行不等于质量通过，全部保留为待复核。'
      : '预览保留原始生成内容，最多展示最近 200 份。动画可运行不等于质量通过；复核标签来自服务端，不由页面按颜色或画面风格自动判定。';
    $('filter-all').textContent = state.pelicans.length;
    $('filter-unreviewed').textContent = state.pelicans.filter(x=>x.review_status==='unreviewed').length;
    $('filter-flagged').textContent = state.pelicans.filter(x=>x.review_status==='flagged').length;
    renderGallery();
  }
  function renderSpectrum(slots,archived) {
    const grid = $('spectrum'), axis = $('hour-axis');
    grid.replaceChildren(); axis.replaceChildren();
    for (let i=0;i<24;i++) {
      const col = el('div','hour-column');
      slots.slice(i*6,i*6+6).forEach(slot => {
        const button = el('button',`slot ${slot.status}${slot.future ? ' future' : ''}${slot.rows.length>1 ? ' has-many' : ''}`);
        button.type = 'button';
        const summary = `${fmt(slot.time)}–${fmt(slot.time+L.STEP).slice(-5)} / ${slot.future ? '该时段晚于数据参考时点' : LABELS[slot.status]} / ${slot.rows.length} 条记录`;
        button.title = summary; button.setAttribute('aria-label',summary);
        button.dataset.status = slot.status;
        button.addEventListener('click',()=>openAnswers(slot.rows,summary));
        col.append(button);
      });
      grid.append(col); axis.append(el('span','',hour(slots[i*6].time)));
    }
    const occupied = slots.filter(x=>x.rows.length).length;
    const total = slots.reduce((n,x)=>n+x.rows.length,0);
    const counts = L.summarize(slots.flatMap(x=>x.rows));
    const mixedSlots = slots.filter(x=>x.status==='mixed').length;
    $('spectrum-summary').textContent = `${total} 条记录 · ${counts.wrong} 未通过 · ${counts.error} 请求失败${mixedSlots ? ` · ${mixedSlots} 个混合时段` : ''}`;
    $('spectrum-note').textContent = archived
      ? `档案中的 ${total} 条记录集中在 ${occupied} 个 10 分钟时段；未记录的时间不补造数据。每列从上到下对应 00、10、20、30、40、50 分，浅灰格晚于档案参考时点。`
      : '每列从上到下对应 00、10、20、30、40、50 分。同一格多条结果合并展示；若同时出现通过和未通过，会标为混合结果，点击查看明细。空格不代表通过。';
  }
  function renderLatency(rows) {
    const sorted = rows.slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
    const values = sorted.map(r => r.elapsed_seconds);
    const valid = values.filter(v=>typeof v==='number' && Number.isFinite(v));
    $('latency-label').textContent = valid.length ? `中位 ${L.median(valid).toFixed(1)} s · ${valid.length} 条实测` : '暂无响应耗时';
    $('latency-chart').setAttribute('aria-label',valid.length ? `${valid.length} 条实际请求的耗时曲线，中位数 ${L.median(valid).toFixed(1)} 秒；缺失值不连线。` : '暂无响应耗时数据');
    if (!valid.length) { $('latency-area').setAttribute('d',''); $('latency-line').setAttribute('d',''); return; }
    const max = Math.max(...valid,1)*1.1;
    let line='', area='', segment=[];
    const flush = () => {
      if (!segment.length) return;
      const first=segment[0],last=segment[segment.length-1];
      line += 'M'+segment.map(p=>p.join(',')).join(' L')+' ';
      area += `M${first[0]},71 L${segment.map(p=>p.join(',')).join(' L')} L${last[0]},71 Z `;
      segment=[];
    };
    values.forEach((v,i)=>{
      if (typeof v!=='number' || !Number.isFinite(v)) { flush(); return; }
      segment.push([values.length===1?600:2+i/(values.length-1)*1196, Math.round((70-v/max*62)*10)/10]);
    });
    flush(); $('latency-area').setAttribute('d',area); $('latency-line').setAttribute('d',line);
  }
  function frameDocument(html) {
    if (frameCache.has(html)) return frameCache.get(html);
    const doc = new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('base,iframe,object,embed,form,script[src],link,meta[http-equiv="refresh" i]').forEach(node=>node.remove());
    const csp = doc.createElement('meta');
    csp.httpEquiv='Content-Security-Policy';
    csp.content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    doc.head.prepend(csp);
    const result='<!doctype html>\n'+doc.documentElement.outerHTML;
    frameCache.set(html,result); return result;
  }
  function makeFrame(row,thumbnail) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox','allow-scripts'); // Never add allow-same-origin.
    frame.referrerPolicy='no-referrer';
    frame.title=`原始鹈鹕动画 ${row.id}`;
    if (thumbnail) { frame.tabIndex=-1; frame.setAttribute('aria-hidden','true'); }
    frame.srcdoc=frameDocument(row.html);
    return frame;
  }
  function scaleThumb(stage) {
    const frame=stage.querySelector('iframe');
    if (frame) frame.style.transform=`scale(${stage.getBoundingClientRect().width/960})`;
  }
  function mountThumb(stage) {
    const row=state?.pelicans.find(x=>x.id===stage.dataset.id);
    if (!row || !row.html) return;
    stage.replaceChildren(makeFrame(row,true)); scaleThumb(stage);
  }
  function renderGallery() {
    viewObserver?.disconnect(); sizeObserver?.disconnect();
    const gallery=$('gallery'); gallery.replaceChildren();
    visibleDrawings=state.pelicans.filter(row=>(filter==='all'||row.review_status===filter)&&(`${row.id} ${String(row.trial).padStart(2,'0')} ${row.account_label} ${row.model}`).toLowerCase().includes(search));
    $('gallery-empty').hidden=visibleDrawings.length>0;
    visibleDrawings.forEach(row=>{
      const card=el('article','drawing-card');
      const head=el('div','drawing-card-head');
      const title=row.account_label||`原始样本 / ${String(row.trial).padStart(2,'0')}`;
      head.append(el('span','',title),el('span',`review-label ${row.review_status}`,row.review_status==='flagged'?'疑似异常':row.review_status==='reviewed'?'已复核':'待复核'));
      const button=el('button','thumb-button'); button.type='button'; button.setAttribute('aria-label',`放大查看${title}的原始 HTML 动画`);
      const stage=el('div','thumb-stage'); stage.dataset.id=row.id; stage.append(el('span','thumb-placeholder',String(row.trial).padStart(2,'0')));
      button.append(stage,el('span','thumb-hover','查看原始动画 ↗'));
      button.addEventListener('click',()=>openDrawing(row.id));
      const meta=el('div','drawing-meta');
      meta.append(el('span','',row.timestamp?fmt(row.timestamp):row.date||'未提供日期'),el('span','',row.elapsed_seconds===null?'耗时未提供':`${row.elapsed_seconds.toFixed(1)} 秒`));
      card.append(head,button,meta,el('div','drawing-model',`${row.model} · ${row.reasoning_effort}${row.retried?' · 曾补跑':''}`)); gallery.append(card);
      sizeObserver?.observe(stage);
      if (viewObserver) viewObserver.observe(stage); else mountThumb(stage);
    });
  }
  function openPrompt(kind) {
    currentPrompt=PROMPTS[kind];
    $('prompt-title').textContent=kind==='candy'?'糖果智力测试题':'鹈鹕骑自行车 · HTML 动画题';
    const body=$('prompt-content'); body.replaceChildren();
    body.append(el('p','',kind==='candy'?CANDY_INTRO:PROMPTS.pelican));
    if (kind==='candy') {
      const table=document.createElement('table'); table.setAttribute('aria-label','各口味和形状的糖果数量');
      [['形状','苹果味','桃子味','西瓜味'],['圆形','5','5','5'],['五角星形','5','5','5']].forEach((line,i)=>{
        const tr=document.createElement('tr'); line.forEach((value,j)=>{const cell=el(i===0||j===0?'th':'td','',value);if(i===0)cell.scope='col';else if(j===0)cell.scope='row';tr.append(cell);});table.append(tr);
      }); body.append(table);
      body.append(el('p','',CANDY_RULES));
    }
    $('prompt-rule').textContent=kind==='candy'?'本站判分：优先读取 JSON 的 final_answer 字段，严格等于 21 才通过；证明正文中的数字不会被当作最终答案。':'不使用任何技能。生成的 HTML 原样公开，以缩略预览和完整动画呈现；画面质量另行复核。';
    $('prompt-dialog').showModal();
  }
  async function copyPrompt() {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(currentPrompt);
      else {
        const field=el('textarea','',currentPrompt);field.style.position='fixed';field.style.opacity='0';$('prompt-dialog').append(field);field.select();const success=document.execCommand('copy');field.remove();if(!success)throw new Error('copy');
      }
      $('copy-prompt').textContent='已复制 ✓'; setTimeout(()=>$('copy-prompt').textContent='复制完整题目',1800);
    } catch { toast('复制未成功，请在题目弹窗中选中文字复制。'); }
  }
  function openAnswers(rows,context='') {
    $('answer-context').textContent=context;
    $('answer-list').replaceChildren();
    const choose=row=>{
      $('answer-list').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.id===row.id));
      $('answer-meta').textContent=`${row.id} · ${fmt(row.timestamp)} · ${LABELS[L.gradeCandy(row)]} · 最终答案：${row.final_answer ?? '未给出'} · ${row.elapsed_seconds===null?'耗时未提供':row.elapsed_seconds.toFixed(1)+' 秒'}`;
      $('answer-body').textContent=row.answer || (row.status==='error'?'请求失败，没有有效回答。':row.status==='running'?'本轮尚在检测中。':'没有可展示的回答。');
    };
    rows.forEach((row,i)=>{const b=el('button','',String(i+1).padStart(2,'0'));b.type='button';b.dataset.id=row.id;b.title=row.id;b.setAttribute('aria-label',`查看 ${row.id} 的回答`);b.addEventListener('click',()=>choose(row));$('answer-list').append(b);});
    if(rows.length)choose(rows[0]);else{$('answer-meta').textContent='无测试记录';$('answer-body').textContent='这个 10 分钟时段没有记录。无数据不等于通过，也不等于请求失败。';}
    $('answer-dialog').showModal();
  }
  function openDrawing(id) {
    currentDrawing=state.pelicans.find(row=>row.id===id);
    if (!currentDrawing) return;
    const row=currentDrawing;
    $('viewer-title').textContent=`鹈鹕骑行 / 原始样本 ${String(row.trial).padStart(2,'0')}`;
    $('viewer-meta').textContent=`${row.model} · ${row.reasoning_effort} · ${row.elapsed_seconds===null?'耗时未提供':row.elapsed_seconds.toFixed(1)+' 秒'}${row.retried?' · 本完成产物曾补跑':''}`;
    $('viewer-source').textContent=row.html;
    showAnimation();
    const index=visibleDrawings.findIndex(x=>x.id===row.id);
    $('prev-drawing').disabled=index<=0;
    $('next-drawing').disabled=index<0||index>=visibleDrawings.length-1;
    if(!$('viewer-dialog').open)$('viewer-dialog').showModal();
  }
  function showAnimation() {
    $('viewer-source').hidden=true; $('viewer-stage').hidden=false;
    $('viewer-stage').replaceChildren(makeFrame(currentDrawing,false));
    $('view-animation').setAttribute('aria-pressed','true'); $('view-source').setAttribute('aria-pressed','false');
  }
  function moveDrawing(delta) {
    const i=visibleDrawings.findIndex(x=>x.id===currentDrawing?.id);
    if(visibleDrawings[i+delta])openDrawing(visibleDrawings[i+delta].id);
  }
  document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>openPrompt(b.dataset.prompt)));
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  });
  $('viewer-dialog').addEventListener('close',()=>{$('viewer-stage').replaceChildren();currentDrawing=null;});
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
    filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});if(state)renderGallery();
  }));
  $('gallery-search').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();if(state)renderGallery();});
  $('copy-prompt').addEventListener('click',copyPrompt);
  $('refresh').addEventListener('click',()=>refresh(true));
  $('all-answers').addEventListener('click',()=>{if(state)openAnswers(state.candy,`${state.mode==='archive'?'历史档案':'接口记录'} / ${state.candy.length} 条原始回答`);});
  $('view-animation').addEventListener('click',()=>{if(currentDrawing)showAnimation();});
  $('view-source').addEventListener('click',()=>{$('viewer-stage').replaceChildren();$('viewer-stage').hidden=true;$('viewer-source').hidden=false;$('view-animation').setAttribute('aria-pressed','false');$('view-source').setAttribute('aria-pressed','true');});
  $('prev-drawing').addEventListener('click',()=>moveDrawing(-1));$('next-drawing').addEventListener('click',()=>moveDrawing(1));
  document.addEventListener('keydown',e=>{if($('viewer-dialog').open&&e.target.tagName!=='INPUT'){if(e.key==='ArrowLeft')moveDrawing(-1);if(e.key==='ArrowRight')moveDrawing(1);}});
  window.addEventListener('resize',()=>document.querySelectorAll('.thumb-stage').forEach(scaleThumb));
  refresh();
  if(cfg.feedUrl)refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},Math.max(L.STEP,cfg.refreshMs||L.STEP));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cfg.feedUrl)refresh();});
  window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);viewObserver?.disconnect();sizeObserver?.disconnect();});
})();
