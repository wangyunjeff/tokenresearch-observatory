(function(){
  const $=id=>document.getElementById(id);
  const percent=value=>`${(value*100).toFixed(1)}%`;
  const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text??'';if(cls)n.className=cls;return n;};
  let selectedGroup=null,latest=null;
  function show(row,history){
    $('attribution-dialog-title').textContent=`${row.model} · ${date(row.timestamp)}`;
    const body=$('attribution-details');body.replaceChildren();
    body.append(node('p',row.group_name||latest?.data.attribution_groups?.[0]?.name||'主分组','attribution-caveat'));
    const nav=node('div','','attribution-history');
    history.slice(0,12).forEach(item=>{const b=node('button',date(item.timestamp),'text-button');b.type='button';b.onclick=()=>show(item,history);nav.append(b);});body.append(nav);
    body.append(node('p',`状态：${row.status==='completed'?'已完成':row.status==='running'?'检测中':'请求或样本异常'} · ${row.elapsed_seconds??'—'} 秒`));
    if(row.error)body.append(node('p',row.error));
    if(row.result){
      body.append(node('p',`${row.result.family_prediction_name} 家族 ${percent(row.result.family_probability)} · 有效回答 ${row.result.used_outputs}/3`));
      row.result.results.forEach(result=>{const line=node('div','','probability-bar');const bar=document.createElement('progress');bar.max=1;bar.value=result.probability;bar.setAttribute('aria-label',result.model);line.append(node('span',result.model),bar,node('strong',percent(result.probability)));body.append(line);});
    }
    (row.samples||[]).forEach((sample,i)=>{const detail=document.createElement('details');detail.className='disclosure';detail.append(node('summary',`挑战 ${i+1} · 目标 ${sample.expected_count} 个整数 · ${sample.status}`),node('pre',sample.prompt,'attribution-sample'),node('pre',sample.text||sample.error||'等待回答','attribution-sample'));body.append(detail);});
    body.append(node('p',`ModelTrace ${row.method?.revision?.slice(0,8)||''} · ${row.protocol} · 推理设置 ${row.reasoning_effort}`,'attribution-caveat'));
    if(!$('attribution-dialog').open)$('attribution-dialog').showModal();
  }
  function render(){
    const {data,model}=latest;if(!data)return;
    const groups=data.attribution_groups||[{id:'primary',name:'不降智分组',models:data.models||['gpt-6-astra']}];
    if(!groups.some(g=>g.id===selectedGroup))selectedGroup=groups[0].id;
    const tabs=$('attribution-groups');
    // Preserve keyboard focus when the live feed refreshes.
    const signature=JSON.stringify(groups.map(g=>[g.id,g.name]));
    if(tabs.dataset.signature!==signature){
      tabs.replaceChildren();tabs.dataset.signature=signature;
      groups.forEach(group=>{const b=node('button',group.name);b.type='button';b.dataset.groupId=group.id;b.onclick=()=>{selectedGroup=group.id;render();};tabs.append(b);});
    }
    [...tabs.children].forEach(b=>{const active=b.dataset.groupId===selectedGroup;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    const group=groups.find(g=>g.id===selectedGroup);
    const body=$('attribution-rows');body.replaceChildren();
    group.models.forEach(id=>{
      const history=(data.attribution||[]).filter(row=>row.model===id&&String(row.group_id||groups[0].id)===selectedGroup).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
      const row=history[0],result=row?.status==='completed'?row.result:null,tr=document.createElement('tr');if(model===id)tr.className='selected';
      const labels=['请求模型','最新状态','最相似候选','候选概率','请求模型概率','测试时间'];
      [id,row?(row.status==='completed'?'已完成':row.status==='running'?`检测中 ${row.samples?.filter(s=>s.status==='completed').length||0}/3`:'请求或样本异常'):'等待首轮',result?.prediction||'—',result?percent(result.probability):'—',result?percent(result.results.find(r=>r.model===id)?.probability||0):'—',row?date(row.timestamp):'—'].forEach((text,i)=>{const cell=node('td',text);cell.dataset.label=labels[i];tr.append(cell);});
      const cell=document.createElement('td');if(row){const b=node('button','详情 ↗','text-button');b.type='button';b.onclick=()=>show(row,history);cell.append(b);}tr.append(cell);body.append(tr);
    });
  }
  window.addEventListener('observatory:render',event=>{latest=event.detail;render();});
})();
