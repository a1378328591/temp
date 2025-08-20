// src/llmService.js
const { JsonRpcProvider, Wallet } = require('ethers');
require('dotenv').config();
const { askLLM, fundBroker, getAvailableModels, getBrokerBalance } = require('./askLLM');
const { handleToolCalls } = require('./tools/toolExecutor');
const { Readable } = require('stream');

class LLMService {
  constructor() {
    const provider = new JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  }

  getWallet() {
    return this.wallet;
  }

  async listModels() {
    return await getAvailableModels(this.wallet);
  }

  async ask({ providerAddress, userInput, history }) {
    try {
      const messages = [...history, { role: 'user', content: userInput }];
      const { stream } = await askLLM(this.wallet, providerAddress, userInput, history);
      const streamIter = stream[Symbol.asyncIterator]();

      const peekedParts = [];
      let hasToolCalls = false;
      let peekLimit = 3;

      while (peekLimit-- > 0) {
        const { value, done } = await streamIter.next();
        if (done || !value) break;

        peekedParts.push(value);
        const delta = value.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.tool_calls) {
          hasToolCalls = true;
          break;
        }
      }

      if (hasToolCalls)
        return await this.handleFunctionCall(messages, streamIter, peekedParts, providerAddress);

      const restream = this.restream(peekedParts, streamIter);
      return { stream: restream };
    } catch (err) {
      console.error("❌ askLLM 出错:", err);
      throw err;
    }
  }

  async *restream(peeked, iter) {
    let fullText = "";
    for (const part of peeked) {
      const delta = part.choices?.[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        console.log("peeked content:", delta.content, "| full:", fullText);
      }
      yield part;
    }

    for await (const part of iter) {
      const delta = part.choices?.[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        console.log("iter content:", delta.content, "| full:", fullText);
      }
      yield part;
    }
  }

  async handleFunctionCall(messages, streamIter, peekedParts, provider) {
    let toolCalls;

    for (const part of peekedParts) {
      const delta = part.choices?.[0]?.delta;
      if (!delta || !delta.tool_calls) continue;

      if (!toolCalls) {
        toolCalls = delta.tool_calls.map(tc => ({
          ...tc,
          function: { ...tc.function, arguments: tc.function?.arguments || '' },
        }));
      } else {
        for (let i = 0; i < delta.tool_calls.length; i++) {
          const incoming = delta.tool_calls[i];
          const existing = toolCalls[i];
          if (incoming.function?.arguments)
            existing.function.arguments += incoming.function.arguments;
        }
      }
    }

    let peekCount = 0;
    const maxPeek = 200;
    while (toolCalls && peekCount++ < maxPeek) {
      const { value, done } = await streamIter.next();
      if (done || !value) break;

      const delta = value.choices?.[0]?.delta;
      if (!delta || !delta.tool_calls) continue;

      for (let i = 0; i < delta.tool_calls.length; i++) {
        const incoming = delta.tool_calls[i];
        const existing = toolCalls[i];
        if (incoming.function?.arguments)
          existing.function.arguments += incoming.function.arguments;
      }

      const allComplete = toolCalls.every(tc => {
        try {
          return !!tc.function.name && !!JSON.parse(tc.function.arguments);
        } catch {
          return false;
        }
      });

      if (allComplete) break;
    }

    if (!toolCalls) throw new Error('handleFunctionCall: 未检测到 toolCalls');

    let toolMessages;
    try {
      toolMessages = await handleToolCalls(toolCalls);
    } catch (err) {
      const errorStream = new Readable({ objectMode: true, read() {} });
      const errorChunk = {
        id: 'chatcmpl-error-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'error-tool',
        choices: [{ index: 0, delta: { content: `[错误] ${err.message}` }, logprobs: null, finish_reason: 'error' }],
      };
      errorStream.push(errorChunk);
      errorStream.push(null);
      return { stream: errorStream };
    }

    const fullMessages = [
      ...messages,
      { role: 'assistant', content: null, tool_calls: toolCalls },
      ...toolMessages,
    ];

    const history = fullMessages.slice(0, -1);
    const prompt = fullMessages.at(-1)?.content || '';

    const { stream } = await askLLM(this.wallet, provider, prompt, history);
    return { stream };
  }

  async balance() {
    return await getBrokerBalance(this.wallet);
  }

  async fund(amount) {
    return await fundBroker(this.wallet, amount);
  }
}

module.exports.llmService = new LLMService();
