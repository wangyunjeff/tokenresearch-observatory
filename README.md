# Token Research Observatory

Token Research 中转站公开健康监测台。页面用于查看糖果题探测结果、通过率、请求延迟和最近 24 小时状态，不需要访问者配置账号或 API Key。

## 项目结构

```text
token-research-observatory/
├── index.html
├── assets/
│   └── reference.png
└── README.md
```

## 本地预览

直接双击 `index.html` 即可打开。也可以在项目目录启动一个静态服务器：

```bash
python3 -m http.server 8080
```

然后访问 <http://localhost:8080>。

## 部署

这是纯静态单页，不需要 Node.js、数据库或构建步骤。将项目目录中的 `index.html` 和 `assets/` 上传到任意静态托管服务即可。

## 接入真实监测数据

当前页面内置演示数据，方便直接预览界面。真实接口接入时，主要修改 `index.html` 末尾的脚本区域，将演示的 `MODEL_ROWS` 与 `TIMELINE` 替换为你的监控接口数据即可。

建议接口至少返回：

- 模型/分组名称
- 糖果题通过次数与有效回答次数
- 请求失败次数
- 平均/近期延迟
- 最近 144 个 10 分钟时段的状态

判分口径已经写在页面“方法”弹窗中：回答中出现独立数字 `21` 记为通过；请求失败单独计数，不进入通过率分母。

## 入口

页面顶部保留了 Token Research 中转站入口，访问者可直接从观测台进入中转站。