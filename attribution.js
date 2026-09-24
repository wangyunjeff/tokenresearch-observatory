(function(){
  const $=id=>document.getElementById(id);
  const percent=value=>`${(value*100).toFixed(1)}%`;
  const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text??'';if(cls)n.className=cls;return n;};
  function show(row,history){
    $('attribution-dialog-title').textContent=`${row.model} · ${date(row.timestamp)}`;
    const body=$('attribution-details');body.replaceChildren();
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
  window.addEventListener('observatory:render',event=>{
    const {data,model}=event.detail;if(!data)return;
    const body=$('attribution-rows');body.replaceChildren();
    (data.models||['gpt-6-astra']).forEach(id=>{
      const history=(data.attribution||[]).filter(row=>row.model===id).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
      const row=history[0],result=row?.status==='completed'?row.result:null,tr=document.createElement('tr');if(model===id)tr.className='selected';
      [id,row?(row.status==='completed'?'已完成':row.status==='running'?`检测中 ${row.samples?.filter(s=>s.status==='completed').length||0}/3`:'请求或样本异常'):'等待首轮',result?.prediction||'—',result?percent(result.probability):'—',result?percent(result.results.find(r=>r.model===id)?.probability||0):'—',row?date(row.timestamp):'—'].forEach(text=>tr.append(node('td',text)));
      const cell=document.createElement('td');if(row){const b=node('button','详情 ↗','text-button');b.type='button';b.onclick=()=>show(row,history);cell.append(b);}tr.append(cell);body.append(tr);
    });
  });
})();
