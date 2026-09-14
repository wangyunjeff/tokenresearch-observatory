/* Public display configuration only. Never put an API key or account secret here. */
window.OBS_CONFIG = Object.freeze({
  // Same-origin public feed served by server/main.mjs. If unavailable, the UI falls back to the bundled archive.
  feedUrl: "/api/status",
  refreshMs: 600000,
  maxDrawings: 5,
  timeZone: "Asia/Shanghai"
});

// Keep the static HTML usable as a fallback while reflecting the production cadence when this config is loaded.
document.addEventListener('DOMContentLoaded', () => {
  const intro = document.querySelector('.intro');
  if (intro) intro.innerHTML = '这里是 <strong>Token Research</strong> 为「ChatGPT 不降质分组」设立的公开观测台。糖果推理题<strong>每 10 分钟</strong>探测一次，鹈鹕动画题<strong>每 30 分钟</strong>探测一次，观察回答与生成质量。结果公开，直接查看，无需填写 API Key。';
  const rows = document.querySelectorAll('.protocol-row');
  if (rows[1]?.querySelector('b')) rows[1].querySelector('b').textContent = '每 30 分钟';
  const method = document.querySelectorAll('.method-grid article')[2]?.querySelector('p');
  if (method) method.textContent = '糖果题每 10 分钟、鹈鹕题每 30 分钟发起一次独立测试，不沿用上一轮对话。糖果题禁用外部工具，鹈鹕题禁用技能；参考样例与实时探测分开标记。';
});
