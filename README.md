# Token Research · ChatGPT 不降质分组实时智力测试

本站面向 Token Research 的「ChatGPT 不降质分组」，公开糖果推理与鹈鹕 SVG 动画两项测试的结果。沿用米白纸感、深绿和珊瑚色的版式。

**当前版本是已导入档案的观测前端，不是正在运行的探测服务。** `config.js` 默认未配置实时数据接口。页面不会调用模型、消耗额度、要求访客输入 API Key，也不会把刷新页面伪装成一次探测。

## 已实现

- 两道完整题目及糖果数量表，支持弹窗查看和复制。
- 24 小时光谱：24 列 × 6 格，每格 10 分钟；支持通过、未通过、请求失败、无数据、检测中，点击查看该时段的每条原始回答。
- **最终答案为 21 才通过**；不是 21 或没有明确答案均未通过。正文出现过 21 不算通过。请求失败单列，不进入有效回答分母。
- 鹈鹕原始 HTML 的动态缩略预览，桌面六列、平板四/三列、手机两列；支持筛选、搜索、放大动画、查看源码和前后切换。
- 仅在缩略图进入可视区域时加载动画；离屏卸载。生成 HTML 在 `sandbox="allow-scripts"` 的隔离 iframe 中运行，**不授予 allow-same-origin**，并限制网络请求和外部资源。
- 保留中转站入口。无需构建、npm 或第三方前端依赖。

## 已导入的数据

来源是本次提供的 2026-09-14 测试 ZIP：

- 20 条糖果原始回答，档案最终答案均为 21。
- 原始请求时间来自响应的 `created_at`，集中在北京时间 14:12–14:15，属于同一个 10 分钟时段。因此光谱只有对应时段有数据，**不会伪造另外 143 格的结果**。
- 20 份独立编号的原始鹈鹕 HTML。#01 是失败后补跑的完成产物。全部标为待复核；能渲染不等于质量通过。
- 不导入 ZIP 中的复制图片编排、不使用“账号已移除”等未经核实的标签、不编造账号 ID。
- 只发布回答、完成产物与必要元数据。未发布 SSE、系统指令、执行日志、响应 ID、usage 追踪信息或凭据。

`data/archive*.js` + `data/archive-*.part` 保存 gzip + base64 编码的 JSON（不是可执行的生成 HTML）。前端用浏览器原生 `DecompressionStream` 解压后，在隔离容器中展示。原始 HTML 和回答未被改写；各 HTML 的 SHA-256 也保存在档案中。压缩格式用于保持整个前端轻量，并支持不经构建直接打开。

## 预览与部署

由于历史档案分段通过同源请求加载，请使用静态服务器预览：

```bash
python3 -m http.server 8080
```

访问 `http://localhost:8080`。直接双击 `index.html` 的 `file://` 模式不加载档案。使用支持 `DecompressionStream('gzip')` 的较新 Chrome、Edge、Firefox 或 Safari。

部署时上传全部文件（至少包含 `index.html`、`styles.css`、`app.js`、`logic.js`、`config.js`、`data/archive*.js` 与 `data/archive-*.part`）。使用相对路径，支持 GitHub Pages 的仓库子路径。不依赖设计参考 PNG。

### GitHub Pages

本仓库默认分支为 `master`。如使用分支发布，在仓库 `Settings → Pages` 中选择 `Deploy from a branch`、`master` 和 `/(root)` 后保存。**提交前端代码不等于自动启用 Pages；当前版本不宣称已开通或部署完成。**

## 接入每 10 分钟的真实监测

探测必须由你控制的服务端定时任务执行，不能把私密 Key 放进这个公开仓库。两题各使用新的独立上下文，糖果题禁用外部工具，鹈鹕题禁用技能。服务端保存原始回答和生成的 HTML，并输出脱敏的公开 JSON。

1. 按 `data/feed.example.json` 与 `DATA_FORMAT.md` 输出同源公开接口。
2. 在 `config.js` 把 `feedUrl` 改为相对地址，例如 `data/status.json`。
3. 页面每 600000 毫秒读取一次公开结果；打开标签页时也会刷新。前端轮询不是服务端探测调度。

接口失败时保留旧数据并提示异常；超过两个刷新周期没有新数据会提示过期。下次探测时间来自服务端，不使用假倒计时。移除接口配置即可返回历史档案模式。

## 开发与校验

```bash
node tests/logic.test.cjs
node --check app.js
python3 scripts/import_archive.py /path/to/test-results.zip
```

导入脚本针对本次 ZIP 结构，只提取允许公开的产物。不要直接把整个原始测试 ZIP 提交到公开仓库。

当前界面已做桌面 1440 px、平板 768 px、手机 390 px 的离线浏览器渲染检查，覆盖题目表格、光谱、20 份预览、原始回答、筛选、搜索、预览/源码切换、刷新与移动端横向溢出。线上部署与真实探测服务需单独验证。

## 目录

```text
index.html              页面结构与题目入口
styles.css              响应式样式
app.js                  数据加载、视图与隔离动画预览
logic.js                判分、聚合与统计的纯函数
config.js               公开数据源配置（禁止放密钥）
data/archive*.js        历史档案加载器（四段）
data/archive-*.part     历史档案压缩数据（八段）
data/feed.example.json  实时接口结构示例（不是在线数据）
DATA_FORMAT.md          数据字段、时间与状态口径
scripts/import_archive.py
tests/logic.test.cjs
```
