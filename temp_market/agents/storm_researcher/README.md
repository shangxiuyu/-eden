# STORM Researcher ⛈️

专业深度研究助手。由 Stanford STORM 驱动，擅长对复杂话题进行多维度调研，并生成带有丰富引用的长篇研究报告。

## 功能特点
- **多维度调研**：不仅仅是简单的搜索，而是模拟人类研究员进行多视角提问和深度挖掘。
- **长篇报告**：生成结构清晰、逻辑连贯的长篇学术性报告。
- **丰富引用**：所有信息均来自实时搜索，并附带准确的参考文献。

## 安装与配置

由于 STORM 依赖较重，安装此 Agent 后需要进行简单的本地初始化：

1. **进入目录**：在您的 Eden 项目根目录下，确保已创建 `external/storm_researcher` 目录并将此仓库的文件下载到其中。
2. **运行安装脚本**：
   ```bash
   cd external/storm_researcher
   bash setup.sh
   ```
3. **配置密钥**：确保 Eden 的 `.env` 文件中已配置以下 API 密钥：
   - `LLM_PROVIDER_KEY` (推荐使用 GPT-4 或 Kimi 等高性能模型)
   - `TAVILY_API_KEY` (搜索接口)

## 使用方法
在聊天中 @STORM Researcher 并输入你想研究的主题即可。
建议：由于研究过程较为复杂，通常需要 **3-5 分钟** 才能完成返回结果。
