const { JsonRpcProvider, Wallet, ethers } = require('ethers');
// @ts-ignore
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
const OpenAI = require('openai');
const { tools } = require('./tools/toolSchemas');

const getWalletFromEnv = () => {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  return new Wallet(process.env.PRIVATE_KEY, provider);
};

const fundBroker = async (signer, amountOG) => {
  const broker = await createZGComputeNetworkBroker(signer);
  const amount = ethers.parseEther(amountOG.toString());
  await broker.fund({ value: amount });
  return true;
};

const getBrokerBalance = async (signer) => {
  const broker = await createZGComputeNetworkBroker(signer);
  const balance = await broker.balance();
  return ethers.formatEther(balance);
};

const getAvailableModels = async (signer) => {
  const broker = await createZGComputeNetworkBroker(signer);
  return broker.availableModels();
};

const askLLM = async (signer, providerAddress, inputParam, history) => {
  const messages = [...history, { role: 'user', content: inputParam }]
const broker = await createZGComputeNetworkBroker(signer)
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
await broker.inference.acknowledgeProviderSigner(providerAddress)
const jsonString = JSON.stringify(messages)
const headers = await broker.inference.getRequestHeaders(providerAddress, jsonString)
// console.log('headers', headers)
const openai = new OpenAI({
  baseURL: endpoint,
  apiKey: '',
})
console.log('--------------------------------------------------')
console.log('tools', tools)
console.log('providerAddress', providerAddress)
console.log('history:', history)
console.log('messages', messages)
console.log('--------------------------------------------------')
const stream = await openai.chat.completions.create(
  {
    messages,
    model,
    stream: true,
    tool_choice: 'auto',
    tools,
  },
  {
    headers: {
      ...headers,
    },
  },
)
// //console.log('completion', completion)
// const chatID = completion.id;
// const content = completion.choices?.[0]?.message?.content ?? '';
// const verified = await broker.inference.processResponse(providerAddress, content, chatID);
// //console.log('json', completion)
// return {
//   ...completion,
//   text: content,
//   verified,
//   history: [...messages, { role: 'assistant', content }],
// };
// console.log('stream', stream)
return { stream, broker, providerAddress }

};

module.exports = {
  getWalletFromEnv,
  fundBroker,
  getBrokerBalance,
  getAvailableModels,
  askLLM,
};
