# Eden Agent Market Data

为了让 Agent 市场正常工作，请将本项目中的文件上传到您的 GitHub 仓库：
https://github.com/shangxiuyu/eden-agent-market

## 目录结构
上传后的仓库结构应如下所示：

```
eden-agent-market/
├── index.json                  # 市场索引文件，定义了列表中显示的 Agent
└── agents/
    └── translator/
        └── agent.json          # 具体的 Agent 定义文件
```

## 如何添加更多 Agent
1. 在 `index.json` 的 `agents` 列表中添加新的 Agent 简介。
2. 在 `agents/` 目录下创建以 `id` 命名的文件夹（如 `agents/my-agent/`）。
3. 在该文件夹中创建 `agent.json`，内容为导出的 Agent 完整数据。

完成上传后，刷新 Eden 的市场页面即可看到变更。
