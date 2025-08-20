import axios from 'axios';
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

// 合约地址和 ABI
//const CONTRACT_ADDRESS = '0x51d37b7fC59a53E5b198e1B76050cC0E34f93781';
const CONTRACT_ABI = [
  'function playGame(uint8 userMove) public payable',
  'function prizePool() public view returns (uint256)',
  'function depositPrizePool() external payable',
  'function withdrawPrizePool(uint amount) external',
  'function owner() view returns (address)',
  'event GameResult(address indexed user, uint8 userMove, uint8 contractMove, uint8 result, uint256 amountWon)',
];

//const RPC_URL = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai/';
// const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';
// const KV_GATEWAY = process.env.KV_GATEWAY || 'http://3.101.147.150:6789';

// Provider 和 signer（替换成你本地或后端私钥）
const provider = new JsonRpcProvider(process.env.RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
//console.log('CONTRACT_ADDRESS', CONTRACT_ADDRESS, wallet )
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// indexer
// const indexer = new Indexer(INDEXER_RPC);
// kv client
// const kvClient = new KvClient(KV_GATEWAY);
// streamId 类似 redis 的 database?
const STREAM_ID = process.env.STREAM_ID;
const FLOW_CONTRACT = process.env.FLOW_CONTRACT;


// 枚举映射
const moveMap = {
  Rock: 0,
  Paper: 1,
  Scissors: 2,
};

// 获取钱包排名
async function getWalletRank(args) {
  const walletAddr = args.wallet.toLowerCase();
  const limit = 1000;
  let skip = 0;
  let rank = -1;
  let total = 0;

  while (true) {
    const res = await axios.get('https://storagescan-galileo.0g.ai/api/miners', {
      params: {
        network: 'turbo',
        skip,
        limit,
        sortField: 'total_reward',
      },
    });

    const { list, total: totalCount } = res.data.data;
    total = totalCount;

    const index = list.findIndex(item => item.miner.toLowerCase() === walletAddr);
    if (index !== -1) {
      rank = skip + index + 1;
      break;
    }

    skip += limit;
    if (skip >= totalCount) break;
  }

  return {
    wallet: args.wallet,
    rank: rank === -1 ? null : rank,
    total,
  };
}

// 查询奖池余额（ETH）
async function getPrizePool() {
  const pool = await contract.prizePool();
  return {
    prizePoolEth: ethers.formatEther(pool),
    symbol: '0G',
  };
}

// -------------------- 0G KV 封装 --------------------
async function uploadGameRecord(walletAddr, newRecord) {
  // const key = walletAddr.toLowerCase();

  // // 先读取已有记录
  // const existing = null;
  // const history = existing ? existing : [];

  // history.push(newRecord);
  // const value = JSON.stringify(history);

  // const [nodes, err] = await indexer.selectNodes(1);
  // if (err !== null) throw new Error(`Error selecting nodes: ${err}`);

  // const batcher = new Batcher(1, nodes, flow, RPC_URL);
  // const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
  // const valueBytes = Uint8Array.from(Buffer.from(value, 'utf-8'));
  // batcher.streamDataBuilder.set(STREAM_ID, keyBytes, valueBytes);

  // const [tx, batchErr] = await batcher.exec();
  // if (batchErr !== null) throw new Error(`Batch execution error: ${batchErr}`);

  return {  };
}

async function getGameRecord(walletAddr) {
  // const key = walletAddr.toLowerCase();
  // const keyBytes = ethers.toUtf8Bytes(key);
  // const value = await kvClient.getValue(STREAM_ID, keyBytes);
  // return value ? JSON.parse(Buffer.from(value.data, 'base64').toString('utf-8')) : [];
  return
}

// 猜拳游戏
async function playRPSGame(args) {
  try {
    const moveValue = moveMap[args.move];
    const valueInWei = ethers.parseEther(args.amount);

    if (typeof moveValue !== 'number' || ![0, 1, 2].includes(moveValue)) {
      throw new Error(`Invalid move: ${moveValue}`);
    }

    const tx = await contract.playGame(moveValue, {
      value: valueInWei,
      gasLimit: 30000000,
    });

    const receipt = await tx.wait();

    const event = receipt.logs
      .map(log => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e?.name === 'GameResult');

    if (!event) throw new Error('GameResult event not found');

    const { user, userMove, contractMove, result, amountWon } = event.args;

    const prizePoolAfter = await contract.prizePool();

    const gameResult = {
      wallet: user,
      userMove: Object.keys(moveMap)[userMove],
      contractMove: Object.keys(moveMap)[contractMove],
      result: ['Draw', 'UserWin', 'ContractWin'][result],
      amountWon: ethers.formatEther(amountWon),
      currentPrizePoolEth: ethers.formatEther(prizePoolAfter),
      userBalance: await getWalletBalance(),
      symbol: '0G',
    };

    // 🎯 存储游戏结果到 0G KV
    try {
      // await uploadGameRecord(wallet.address, gameResult);
    } catch (uploadError) {
      // 可以选择在这里添加一些错误处理逻辑
    }

    return gameResult;
  } catch (err) {
    console.error('playRPSGame error:', err);
    throw err;
  }
}

async function depositPrizePool(args) {
  const tx = await contract.depositPrizePool({
    value: ethers.parseEther(args.amount.toString()),
  });
  const receipt = await tx.wait();
  return {
    success: true,
    txHash: receipt.transactionHash,
    deposited: args.amount,
    symbol: '0G',
  };
}

function formatAmount(amountInWei) {
  return `${ethers.formatEther(amountInWei)} 0G`;
}

async function getWalletBalance() {
  const balance = await provider.getBalance(wallet.address);
  return formatAmount(balance);
}

async function withdrawPrizePool(args) {
  const amountInWei = ethers.parseEther(args.amount.toString());
  const ownerAddress = await contract.owner();
  if (wallet.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error('Only owner can withdraw');
  }
  const prizePool = await contract.prizePool();
  if (amountInWei > prizePool) {
    throw new Error('Insufficient prize pool balance');
  }
  const tx = await contract.withdrawPrizePool(amountInWei);
  const receipt = await tx.wait();
  return {
    success: true,
    txHash: receipt.transactionHash,
    withdrawn: args.amount,
    symbol: '0G',
  };
}

// tools.js (ESM 写法)
export const get_wallet_rank = getWalletRank
export const get_prize_pool = getPrizePool
export const play_rps_game = playRPSGame
export const deposit_prize_pool = depositPrizePool
export const withdraw_prize_pool = withdrawPrizePool
export const get_wallet_balance = getWalletBalance
export const get_game_record = getGameRecord
export const upload_game_record = uploadGameRecord

