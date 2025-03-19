import 'viem/window'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { createPublicClient, createWalletClient, custom, getContractAddress, http, numberToBytes, publicActions } from 'viem'
import { mainnet } from 'viem/chains'
import { augurConstantProductMarketContractArtifact } from '../VendoredAugurConstantProductMarket.js'
import { AUGUR_UNIVERSE_ABI } from '../ABI/UniverseAbi.js'
import { ERC20_ABI } from '../ABI/Erc20Abi.js'
import { AUGUR_CONTRACT, GENESIS_UNIVERSE, PROXY_DEPLOYER_ADDRESS } from './constants.js'
import { AUGUR_ABI } from '../ABI/AugurAbi.js'

export const requestAccounts = async () => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	const reply = await window.ethereum.request({ method: 'eth_requestAccounts', params: undefined })
	return reply[0]
}

export const getAccounts = async () => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	const reply = await window.ethereum.request({ method: 'eth_accounts', params: undefined })
	return reply[0]
}

const createReadClient = (accountAddress: AccountAddress | undefined) => {
	if (window.ethereum === undefined || accountAddress === undefined) {
		return createPublicClient({ chain: mainnet, transport: http('https://ethereum.dark.florist', { batch: { wait: 100 } }) })
	}
	return createWalletClient({ chain: mainnet, transport: custom(window.ethereum) }).extend(publicActions)
}

const createWriteClient = (accountAddress: AccountAddress) => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	if (accountAddress === undefined) throw new Error('no accountAddress!')
	return createWalletClient({ account: accountAddress, chain: mainnet, transport: custom(window.ethereum) }).extend(publicActions)
}

export const getChainId = async (accountAddress: AccountAddress) => {
	return await createWriteClient(accountAddress).getChainId()
}

export function getAugurConstantProductMarketAddress() {
	const bytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object }`
	return getContractAddress({ bytecode, from: PROXY_DEPLOYER_ADDRESS, opcode: 'CREATE2', salt: numberToBytes(0) })
}

export const isAugurConstantProductMarketDeployed = async (accountAddress: AccountAddress | undefined) => {
	const wallet = createReadClient(accountAddress)
	const expectedDeployedBytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.deployedBytecode.object }`
	const address = getAugurConstantProductMarketAddress()
	const deployedBytecode = await wallet.getCode({ address })
	return deployedBytecode === expectedDeployedBytecode
}

export const deployAugurConstantProductMarketTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object }`
	return { to: PROXY_DEPLOYER_ADDRESS, data: bytecode } as const
}

export async function ensureProxyDeployerDeployed(accountAddress: AccountAddress): Promise<void> {
	const wallet = createWriteClient(accountAddress)
	const deployerBytecode = await wallet.getCode({ address: PROXY_DEPLOYER_ADDRESS })
	if (deployerBytecode === '0x60003681823780368234f58015156014578182fd5b80825250506014600cf3') return
	const ethSendHash = await wallet.sendTransaction({ to: '0x4c8d290a1b368ac4728d83a9e8321fc3af2b39b1', amount: 10000000000000000n })
	await wallet.waitForTransactionReceipt({ hash: ethSendHash })
	const deployHash = await wallet.sendRawTransaction({ serializedTransaction: '0xf87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' })
	await wallet.waitForTransactionReceipt({ hash: deployHash })
}

export const deployAugurConstantProductMarketContract = async (accountAddress: AccountAddress) => {
	const augurConstantProductMarketDeployed = await isAugurConstantProductMarketDeployed(accountAddress)
	if (augurConstantProductMarketDeployed) throw new Error('already deployed')
	await ensureProxyDeployerDeployed(accountAddress)
	const client = createWriteClient(accountAddress)
	if (!augurConstantProductMarketDeployed) {
		const hash = await client.sendTransaction(deployAugurConstantProductMarketTransaction())
		await client.waitForTransactionReceipt({ hash })
	}
}

export const createYesNoMarket = async (marketCreator: AccountAddress, endTime: bigint, feePerCashInAttoCash: bigint, affiliateValidator: AccountAddress, affiliateFeeDivisor: bigint, designatedReporterAddress: AccountAddress, extraInfo: string) => {
	const client = createWriteClient(marketCreator)
	const { request } = await client.simulateContract({
		account: marketCreator,
		address: GENESIS_UNIVERSE,
		abi: AUGUR_UNIVERSE_ABI,
		functionName: 'createYesNoMarket',
		args: [endTime, feePerCashInAttoCash, affiliateValidator, affiliateFeeDivisor, designatedReporterAddress, extraInfo]
	})
	await client.writeContract(request)
}

export const approveErc20Token = async (approver: AccountAddress, tokenAddress: AccountAddress, approvedAdress: AccountAddress, amount: EthereumQuantity) => {
	const client = createWriteClient(approver)
	return await client.writeContract({
		chain: mainnet,
		abi: ERC20_ABI,
		functionName: 'approve',
		address: tokenAddress,
		args: [approvedAdress, amount]
	})
}

export const fetchMarket = async (reader: AccountAddress, marketAddress: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.readContract({
		abi: AUGUR_ABI,
		functionName: 'getMarketCreationData',
		address: AUGUR_CONTRACT,
		args: [marketAddress]
	})
}

