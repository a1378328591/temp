import { llmService } from './llmService.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const providerAddress = process.env.PROVIDER_ADDRESS; // 固定 provider
    const userInput = '从奖池里提现0.010G';
    
    //系统提示词写死 和 userInput 暂时写死吧 , 暂未带入上下文记忆
    const history = [
      { role: 'system', content: `你是一个通用的智能助手，能够适应各种对话场景。  
      你可以根据用户的要求自由切换角色和风格，提供个性化和丰富的对话体验。  
      请根据用户的指示，灵活调整语气和内容，满足不同的聊天需求。  
      不局限于任何特定项目或话题，支持多种类型的角色扮演和开放性对话。  
      你需要尊重用户的指令，但也要保持适度的合理性和安全性。
      根据用户提问的语言回复：
      - 如果用户用中文提问，就用中文回答。
      - 如果用户用英文提问，就用英文回答。
      当用户请求玩石头剪刀布时：  
      - 你必须 **直接调用工具 play_rps_game**  
      - **不要**输出自然语言回复  
      - **不要**询问用户钱包地址，钱包地址由系统自动提供  
      - 用户只会输入出拳动作（Rock / Paper / Scissors）和下注金额（0G），你必须严格使用这些信息调用工具` }
    ];
    const response = await llmService.ask({ providerAddress, userInput, history });

    // response.stream 是可读流，可以异步遍历输出
    console.log('开始接收流数据：');
    for await (const chunk of response.stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }

    console.log('\n=== 完成 ===');
  } catch (err) {
    console.error('调用 ask 出错:', err);
  }
}

// 顺序执行 10 次
async function runSequentially(times) {
  for (let i = 1; i <= times; i++) {
    await main(i); // 等待本次完成再执行下一次
  }
}

// 启动
runSequentially(10);
