(async function(){
  try{
    const response=await fetch('/api/visits',{method:'POST',credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Counter unavailable');
    const data=await response.json();
    document.getElementById('visit-views').textContent=data.total_views.toLocaleString('en-US');
    document.getElementById('visit-people').textContent=data.total_visitors.toLocaleString('en-US');
  }catch{
    const note=document.getElementById('visit-note');
    note.textContent='访问统计暂不可用';note.hidden=false;
  }
})();
