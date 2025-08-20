
```
npm install
```

```
npm start
```

在 llmService.js 中，首先对流的前3个返回（peekLimit）进行检查。如果其中包含 tool_calls，则将标志 hasToolCalls 设为 true；如果 hasToolCalls 为 false，则直接将流返回内容拼接并返回给前端；如果为 true，则调用相应的工具函数处理 tool_calls，处理完成后再次调用 askLLM 继续生成后续内容。