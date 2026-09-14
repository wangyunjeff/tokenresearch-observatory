# 公开监测数据格式（v1）

`config.js` 的 `feedUrl` 只能指向同源、无需凭据的 JSON。接口不应该返回 API Key、OAuth 信息、cookie、未脱敏账号 ID、系统指令、内部日志或完整 SSE。

## 顶层字段

- `schema_version`: 固定为 `1`。
- `mode`: `archive`（历史档案）或 `live`（服务端公开数据）。
- `as_of`: ISO 8601 UTC/带时区时间，表示服务端这份数据实际覆盖至何时。不要用客户端刷新时间冒充。
- `next_probe_at`: 服务端计划的下次探测时间；没有调度时填 `null`。
- `candy`: 糖果请求记录数组，最多 5000 条。
- `pelicans`: 生成产物数组，页面最多展示前 200 条；在线服务端应按最新到最旧排序。

## 糖果记录

```json
{
  "id": "candy-unique-id",
  "timestamp": "2026-09-14T06:10:00Z",
  "status": "completed",
  "final_answer": "21",
  "answer": "实际的完整原始回答",
  "elapsed_seconds": 32.4,
  "model": "实际模型名",
  "reasoning_effort": "实际推理设置",
  "http_status": 200
}
```

`timestamp` 是该次请求开始时间。`status` 取 `completed`、`error`、`running`、`none`。超时或请求失败必须记录成 `error`，不得伪装为有回答的未通过。

新版糖果探测要求模型只输出 JSON，服务端优先读取其中的 `final_answer` 并标准化为字符串；前端只接受数字 `21` 或去除首尾空格后的字符串 `"21"`。不要用全文包含“21”的正则代替结论提取。历史非 JSON 回答优先识别最终明确结论或 `\\boxed{...}`，不能把证明过程中的中间算式当成最终答案。不明确、否定式答案、多答案歧义应为 `null`，记为未通过。

有效回答 = 通过 + 未通过；失败、检测中、无数据不进入回答通过率分母。一个时段多条结果若同时包含通过和未通过，页面显示“混合结果”并保留每条原始记录；其他组合仍按“未通过 → 请求失败 → 检测中 → 通过”显示。缺失/未来时间不填造成有数据。

网格 24 列 × 6 行，按北京时间的整小时对齐，最后一列是参考时点所在小时；该小时中尚未到达的格子浅灰展示。档案参考 `as_of`，在线视图参考当前时间。图下耗时曲线按实际请求顺序绘制，缺失值断开，不补零。

## 鹈鹕产物

```json
{
  "id": "pelican-unique-id",
  "trial": 1,
  "account_label": "",
  "timestamp": "2026-09-14T06:10:00Z",
  "date": "2026-09-14",
  "model": "实际模型名",
  "reasoning_effort": "实际推理设置",
  "elapsed_seconds": 150.2,
  "review_status": "unreviewed",
  "retried": false,
  "html": "<!doctype html><html>…真实完成产物…</html>"
}
```

`account_label` 可空；有账号标识时只提供允许公开的脱敏别名，不凭空制造账号。没有精确时间时 `timestamp` 为 `null`，只展示来源已知的日期，不使用 ZIP 文件修改时间当作请求时间。

`review_status` 取 `unreviewed`、`flagged`、`reviewed`；页面不按图像颜色、SVG 数量或是否运动自动判断降质。`flagged` 是待进一步确认的疑似异常，不等于认定模型降智。`retried` 表示该完成产物之前存在失败后重试。

HTML 在隔离 iframe 中展示；父页面用文本节点呈现所有回答、标识和源码。在线收集器仍应在服务端对公开产物进行安全检查及资源限额控制；不要在带账号权限的同源顶层页面中直接执行未审查的模型 HTML。
