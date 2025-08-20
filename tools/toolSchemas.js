export const tools = [
  {
    type: 'function',
    function: {
      name: 'get_wallet_rank',
      description: '获取指定钱包地址的存储节点排名',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: '钱包地址' }
        },
        required: ['wallet']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'play_rps_game',
      description: '与合约玩石头剪刀布游戏，下注并返回游戏结果',
      parameters: {
        type: 'object',
        properties: {
          wallet: { type: 'string', description: '用户的钱包地址' },
          move: { type: 'string', enum: ['Rock', 'Paper', 'Scissors'], description: '用户的出拳动作' },
          amount: { type: 'string', description: '下注金额（单位为 0G）' }
        },
        required: ['wallet', 'move', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_prize_pool',
      description: '查询石头剪刀布游戏的合约当前奖池余额',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deposit_prize_pool',
      description: '存入一笔金额到石头剪刀布游戏的合约奖池（单位：0G）',
      parameters: {
        type: 'object',
        properties: { amount: { type: 'number', description: '要存入的金额，单位为 0G（小数，如 0.01）' } },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'withdraw_prize_pool',
      description: '合约拥有者提现奖池（只有 owner 可调用）',
      parameters: {
        type: 'object',
        properties: { amount: { type: 'number', description: '提现金额，单位 0G（小数，例如 0.01）' } },
        required: ['amount']
      }
    }
  }
];
