# Token Research · ChatGPT 不降质分组实时智力测试

公开观测糖果推理题与鹈鹕 SVG 动画题。前端继续保留历史档案作为故障回退；生产环境现在可以运行真实服务端探测。

## 当前探测节奏

- **糖果题：每 10 分钟一次**，调用 OpenAI-compatible Responses API。每次都是全新独立请求，不传历史消息。
- **鹈鹕题：每 30 分钟一次**，通过可配置的 Codex Exec 适配器执行；每轮只发起一次真实执行，不做自动重试。
- 糖果题只有明确最终答案 **21** 才通过；推理正文里偶然出现 21 不算通过。请求失败单独计数，不进入有效回答分母。
- 前端从同源 `/api/status` 读取公开结果，API Key、Base URL、执行器密钥都只存在生产环境服务端。

> 公开观测数据不做伪造回填。实时历史会随着 worker 运行自然积累。鹈鹕区固定展示“最新 1 份实时探测 + 4 份参考样例”，参考样例来自先前提供的原始测试档案，并明确标记来源。

## 目录

```text
index.html / styles.css / app.js / logic.js   公开前端
config.js                                     同源数据接口配置
server/main.mjs                               静态站 + /api/status + 调度器
server/candy.mjs                              Responses API 糖果探测
server/pelican.mjs                            Codex Exec 鹈鹕探测
server/store.mjs                              原子持久化
PRODUCTION.md                                 生产环境配置说明
.env.example                                  环境变量模板（无真实密钥）
Dockerfile / docker-compose.example.yml       容器部署
runtime/                                      运行状态，禁止提交
data/archive*.js / data/archive-*.part        旧档案回退 + 参考鹈鹕素材
```

## 生产配置

复制 `.env.example` 为生产环境的 `.env`，至少配置：

```env
OPENAI_BASE_URL=https://YOUR-BASE/v1
OPENAI_API_KEY=YOUR-KEY
CANDY_MODEL=YOUR-MODEL
```

鹈鹕支持两种执行器：

```env
# 本机命令模式：stdin 接收完整题目，fresh temp cwd 中必须产出 index.html
PELICAN_EXEC_MODE=command
CODEX_EXEC_COMMAND_JSON=["codex","exec","-"]
```

或：

```env
PELICAN_EXEC_MODE=http
CODEX_EXEC_URL=https://YOUR-EXECUTOR/run
CODEX_EXEC_KEY=YOUR-EXECUTOR-KEY
```

完整说明见 [PRODUCTION.md](./PRODUCTION.md)。

## 运行

Node.js 20+，无第三方运行时依赖：

```bash
cp .env.example .env
# 编辑 .env
npm test
npm start
```

Docker：

```bash
docker compose -f docker-compose.example.yml up -d --build
```

默认服务：

- `GET /`：观测台
- `GET /api/status`：公开状态数据，不含密钥
- `GET /healthz`：worker 健康状态

生产环境建议将 `https://live.tokenresearch.com.cn/` 的反向代理指向本服务，并把 `runtime/` 放在持久卷中。

## 数据与安全口径

- `.env`、runtime state、SSE、执行日志、响应内部 ID、usage 追踪数据都不进入公开仓库。
- 生成的鹈鹕 HTML 仍由前端在 `sandbox="allow-scripts"` 且**不授予 `allow-same-origin`** 的 iframe 中显示。
- 服务端会限制 HTML 大小；不把参考素材计作实时探测。
- Codex command adapter 使用 JSON 数组直接 `spawn`，不通过 shell 拼接命令。
- `config.js` 只放公开配置，永远不要把 API Key 放进去。

## 测试

```bash
npm test
```

测试覆盖糖果最终答案提取、10/30 分钟边界、一次糖果请求、一次鹈鹕请求，以及公开鹈鹕区为 1 份实时 + 4 份明确标记的参考样例。
