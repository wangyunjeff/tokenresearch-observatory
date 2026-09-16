(async function(){
  try{
    const response=await fetch('/api/visits',{method:'POST',credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Counter unavailable');
    const data=await response.json();
    document.getElementById('visit-views').textContent=data.total_views.toLocaleString('en-US');
    document.getElementById('visit-people').textContent=data.total_visitors.toLocaleString('en-US');
    document.getElementById('visit-note').title=`实际新增 ${data.views} 次访问、${data.visitors} 位浏览器访客。刷新计为一次访问；清除 Cookie 或更换浏览器会计为新访客。`;
  }catch{document.getElementById('visit-note').textContent='访问统计暂不可用';}
})();
