const toolFunctions = require('./tools')

/**
 * 执行 tool_calls 并返回追加到 messages 中的 tool 响应消息
 */
const handleToolCalls = async (toolCalls) => {
  const results = []
  console.log('++++++++++')
  for (const toolCall of toolCalls) {
    const { id: tool_call_id, function: fn } = toolCall
    const fnName = fn.name
    console.log('fnName:', fnName)

   

    let args
    try {
      args = JSON.parse(fn.arguments)
    } catch (err) {
      console.error(`❌ JSON parse error for arguments: ${fn.arguments}`)
      throw err
    }

    console.log('toolFunctions', toolFunctions)
    const toolFn = toolFunctions[fnName]
    if (!toolFn) {
      console.error(`❌ Tool function ${fnName} not found`)
      throw new Error(`Tool function ${fnName} not found`)
    }

    const result = await toolFn(args)

    results.push({
      role: 'tool',
      tool_call_id,
      content: JSON.stringify(result),
    })
  }
  console.log('++++++++++')
  return results
}

module.exports = { handleToolCalls }
