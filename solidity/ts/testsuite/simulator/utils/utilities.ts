import 'viem/window'
import { AccountAddress } from '../types/types.js'
import { createWalletClient, custom, getContractAddress, numberToBytes, publicActions } from 'viem'
import { mainnet } from 'viem/chains'
import { promises as fs } from 'fs'
import { ReadClient, WriteClient } from './viem.js'
import { AUGUR_UNIVERSE_ADDRESS, DAI_ADDRESS, PROXY_DEPLOYER_ADDRESS } from './constants.js'
import { addressString } from './bigint.js'
import { Abi, Address } from 'abitype'
import { ABIS } from '../../../abi/abis.js'
import * as funtypes from 'funtypes'

type ContractArtifact = funtypes.Static<typeof ContractArtifact>
const ContractArtifact = funtypes.ReadonlyObject({
	contracts: funtypes.ReadonlyObject({
		"AugurConstantProductMarket.sol": funtypes.ReadonlyObject({
			AugurConstantProduct: funtypes.ReadonlyObject({
				abi: funtypes.Unknown,
				evm: funtypes.ReadonlyObject({
					bytecode: funtypes.ReadonlyObject({
						object: funtypes.String
					}),
					deployedBytecode: funtypes.ReadonlyObject({
						object: funtypes.String
					})
				})
			})
		})
	}),
})

const contractLocation = './artifacts/AugurConstantProductMarket.json'
export const augurConstantProductMarketContractArtifact = ContractArtifact.parse(JSON.parse(await fs.readFile(contractLocation, 'utf8')))

export async function sleep(milliseconds: number) {
	await new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function jsonStringify(value: unknown, space?: string | number | undefined): string {
    return JSON.stringify(value, (_, value) => {
		if (typeof value === 'bigint') return `0x${value.toString(16)}n`
		if (value instanceof Uint8Array) return `b'${Array.from(value).map(x => x.toString(16).padStart(2, '0')).join('')}'`
		// cast works around https://github.com/uhyo/better-typescript-lib/issues/36
		return value as JSONValueF<unknown>
    }, space)
}

export function jsonParse(text: string): unknown {
	return JSON.parse(text, (_key: string, value: unknown) => {
		if (typeof value !== 'string') return value
		if (/^0x[a-fA-F0-9]+n$/.test(value)) return BigInt(value.slice(0, -1))
		const bytesMatch = /^b'(:<hex>[a-fA-F0-9])+'$/.exec(value)
		if (bytesMatch && 'groups' in bytesMatch && bytesMatch.groups && 'hex' in bytesMatch.groups && bytesMatch.groups['hex'].length % 2 === 0) return hexToBytes(`0x${bytesMatch.groups['hex']}`)
		return value
	})
}

export function ensureError(caught: unknown) {
	return (caught instanceof Error) ? caught
		: typeof caught === 'string' ? new Error(caught)
		: typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string' ? new Error(caught.message)
		: new Error(`Unknown error occurred.\n${jsonStringify(caught)}`)
}

function hexToBytes(value: string) {
	const result = new Uint8Array((value.length - 2) / 2)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number.parseInt(value.slice(i * 2 + 2, i * 2 + 4), 16)
	}
	return result
}

export function dataString(data: Uint8Array | null) {
	if (data === null) return ''
	return Array.from(data).map(x => x.toString(16).padStart(2, '0')).join('')
}

export function dataStringWith0xStart(data: Uint8Array | null): `0x${ string }` {
	if (data === null) return '0x'
	return `0x${ dataString(data) }`
}

export function decodeEthereumNameServiceString(ens: string): string {
	const parts = ens.split('.')
	const encodedData: string[] = []
	encodedData.push('0x')

	function stringToHex(str: string): string {
		return Array.from(str).map((char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')
	}
	parts.forEach((part) => {
		const encodedPart = stringToHex(part)
		const byteCount = (encodedPart.length / 2).toString(16).padStart(2, '0')
		encodedData.push(byteCount + encodedPart)
	})

	encodedData.push('00')
	return encodedData.join('')
}

export function assertNever(value: never): never {
	throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`)
}

export function isSameAddress(address1: `0x${ string }` | undefined, address2: `0x${ string }` | undefined) {
	if (address1 === undefined && address2 === undefined) return true
	if (address1 === undefined || address2 === undefined) return false
	return address1.toLowerCase() === address2.toLowerCase()
}

export const splitEnsStringToSubdomainPath = (input: string): string[] => {
	const parts = input.split('.')
	const result: string[] = []

	for (let i = 0; i < parts.length; i++) {
		const joined = parts.slice(i).join('.')
		result.push(joined)
	}
	result.pop() // eth element
	return result.reverse()
}

export const splitDomainToSubDomainAndParent = (domain: string): [string, string] => {
	const index = domain.indexOf('.')
	if (index === -1) throw new Error('not proper domain')
	return [domain.slice(0, index), domain.slice(index + 1)]
}

export function bigIntToNumber(value: bigint): number {
	if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
		return Number(value)
	}
	throw new Error(`Value: "${ value }" is out of bounds to be a Number.`)
}

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

// const createReadClient = (accountAddress: AccountAddress | undefined) => {
// 	if (window.ethereum === undefined || accountAddress === undefined) {
// 		return createPublicClient({ chain: mainnet, transport: http('https://ethereum.dark.florist', { batch: { wait: 100 } }) })
// 	}
// 	return createWalletClient({ chain: mainnet, transport: custom(window.ethereum) }).extend(publicActions)
// }

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
	return getContractAddress({ bytecode, from: addressString(PROXY_DEPLOYER_ADDRESS), opcode: 'CREATE2', salt: numberToBytes(0) })
}

export const isAugurConstantProductMarketDeployed = async (client: ReadClient) => {
	const expectedDeployedBytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.deployedBytecode.object }`
	const address = getAugurConstantProductMarketAddress()
	const deployedBytecode = await client.getCode({ address })
	return deployedBytecode === expectedDeployedBytecode
}

export const deployAugurConstantProductMarketTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object }`
	return { to: addressString(PROXY_DEPLOYER_ADDRESS), data: bytecode } as const
}

export async function ensureProxyDeployerDeployed(client: WriteClient): Promise<void> {
	const deployerBytecode = await client.getCode({ address: addressString(PROXY_DEPLOYER_ADDRESS)})
	if (deployerBytecode === '0x60003681823780368234f58015156014578182fd5b80825250506014600cf3') return
	const ethSendHash = await client.sendTransaction({ to: '0x4c8d290a1b368ac4728d83a9e8321fc3af2b39b1', amount: 10000000000000000n })
	await client.waitForTransactionReceipt({ hash: ethSendHash })
	const deployHash = await client.sendRawTransaction({ serializedTransaction: '0xf87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' })
	await client.waitForTransactionReceipt({ hash: deployHash })
}

export const deployAugurConstantProductMarketContract = async (client: WriteClient) => {
	const augurConstantProductMarketDeployed = await isAugurConstantProductMarketDeployed(client)
	if (augurConstantProductMarketDeployed) throw new Error('already deployed')
	await ensureProxyDeployerDeployed(client)
	if (!augurConstantProductMarketDeployed) {
		const hash = await client.sendTransaction(deployAugurConstantProductMarketTransaction())
		await client.waitForTransactionReceipt({ hash })
	}
}

export const getReportingFee = async (client: WriteClient) => {
	return await client.readContract({
		abi: ABIS.mainnet.universe,
		functionName: 'getReportingFeeDivisor',
		address: addressString(AUGUR_UNIVERSE_ADDRESS),
		args: []
	})
}

export const approveDai = async (client: WriteClient) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const amount = 1000000000000000000000000000000n
	return await client.writeContract({
		chain: mainnet,
		abi: ABIS.mainnet.erc20,
		functionName: 'approve',
		address: addressString(DAI_ADDRESS),
		args: [acpmAddress, amount]
	})
}

export const getDaiBalance = async (client: WriteClient, address?: Address) => {
	return await client.readContract({
		abi: ABIS.mainnet.erc20,
		functionName: 'balanceOf',
		address: addressString(DAI_ADDRESS),
		args: [address ? address: client.account.address]
	})
}

export const getDaiAllowance = async (client: WriteClient) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	return await client.readContract({
		abi: ABIS.mainnet.erc20,
		functionName: 'allowance',
		address: addressString(DAI_ADDRESS),
		args: [client.account.address, acpmAddress]
	})
}

export const getPoolSupply = async (client: WriteClient) : Promise<bigint> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'totalSupply',
		address: acpmAddress,
		args: []
	}) as bigint
}

export const getPoolLiquidityBalance = async (client: WriteClient) : Promise<bigint> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'balanceOf',
		address: acpmAddress,
		args: [client.account.address]
	}) as bigint
}

export const getShareToken = async (client: ReadClient) : Promise<Address> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'shareToken',
		address: acpmAddress,
		args: []
	}) as Address
}

export const getShareBalances = async (client: ReadClient, account: Address) : Promise<bigint[]> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'shareBalances',
		address: acpmAddress,
		args: [account]
	}) as bigint[]
}

export const getNoYesShareBalances = async (client: ReadClient, account: Address) : Promise<bigint[]> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'noYesShareBalances',
		address: acpmAddress,
		args: [account]
	}) as bigint[]
}

export const getPoolConstant = async (client: ReadClient) : Promise<bigint> => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.readContract({
		abi: abi as Abi,
		functionName: 'poolConstant',
		address: acpmAddress,
		args: []
	}) as bigint
}


export const addLiquidity = async (client: WriteClient, sharesToBuy: bigint) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.writeContract({
		chain: mainnet,
		abi: abi as Abi,
		functionName: 'addLiquidity',
		address: acpmAddress,
		args: [sharesToBuy]
	})
}

export const removeLiquidity = async (client: WriteClient, poolTokensToSell: bigint) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.writeContract({
		chain: mainnet,
		abi: abi as Abi,
		functionName: 'removeLiquidity',
		address: acpmAddress,
		args: [poolTokensToSell]
	})
}

export const enterPosition = async (client: WriteClient, amountInDai: bigint, buyYes: boolean) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.writeContract({
		chain: mainnet,
		abi: abi as Abi,
		functionName: 'enterPosition',
		address: acpmAddress,
		args: [amountInDai, buyYes]
	})
}

export const approveToken = async (client: WriteClient, tokenAddress: Address, spenderAddress: Address) => {
	const amount = 1000000000000000000000000000000n
	return await client.writeContract({
		chain: mainnet,
		abi: ABIS.mainnet.erc20,
		functionName: 'approve',
		address: tokenAddress,
		args: [spenderAddress, amount]
	})
}

export const setERC1155Approval = async (client: WriteClient, tokenAddress: Address, operatorAddress: Address, approved: boolean) => {
	return await client.writeContract({
		chain: mainnet,
		abi: ABIS.mainnet.erc1155,
		functionName: 'setApprovalForAll',
		address: tokenAddress,
		args: [operatorAddress, approved]
	})
}

export const exitPosition = async (client: WriteClient, daiToBuy: bigint) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.writeContract({
		chain: mainnet,
		abi: abi as Abi,
		functionName: 'exitPosition',
		address: acpmAddress,
		args: [daiToBuy]
	})
}

export const swap = async (client: WriteClient, inputShares: bigint, inputYes: boolean) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const abi = augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.abi
	return await client.writeContract({
		chain: mainnet,
		abi: abi as Abi,
		functionName: 'swap',
		address: acpmAddress,
		args: [inputShares, inputYes]
	})
}

export const expectedSharesAfterSwap = async (client: ReadClient, sharesFromUser: bigint, yesShares: boolean) => {
	const acpmAddress = getAugurConstantProductMarketAddress()
	const shareBalances = await getShareBalances(client, acpmAddress)
	const noBalance = shareBalances[1]
	const yesBalance = shareBalances[2]
	const poolConstant = noBalance * yesBalance
	if (yesShares) {
		return noBalance - poolConstant / (yesBalance + sharesFromUser)
	}
	return  yesBalance - poolConstant / (noBalance + sharesFromUser)
}