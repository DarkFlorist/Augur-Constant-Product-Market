import { EIP1193Provider } from 'viem'
import { CANNOT_SIMULATE_OFF_LEGACY_BLOCK, DEFAULT_CALL_ADDRESS } from './utils/constants.js'
import { EthereumClientService } from './EthereumClientService.js'
import { EthCallParams, EthereumJsonRpcRequest, EthGetLogsResponse, EthTransactionReceiptResponse, GetBlockReturn, SendTransactionParams } from './types/jsonRpcTypes.js'
import { appendTransaction, createSimulationState, getInputFieldFromDataOrInput, getPreSimulated, getSimulatedBlock, getSimulatedBlockNumber, getSimulatedCode, getSimulatedLogs, getSimulatedTransactionByHash, getSimulatedTransactionCountOverStack, getSimulatedTransactionReceipt, mockSignTransaction, simulatedCall, simulateEstimateGas } from './SimulationModeEthereumClientService.js'
import { SimulationState } from './types/visualizerTypes.js'
import { StateOverrides } from './types/ethSimulateTypes.js'
import { EthereumJSONRpcRequestHandler } from './EthereumJSONRpcRequestHandler.js'
import { EthereumBytes32, EthereumData, EthereumQuantity, EthereumSignedTransactionWithBlockData } from './types/wire-types.js'
import { ErrorWithDataAndCode, JsonRpcResponseError, printError } from './utils/errors.js'
import * as funtypes from 'funtypes'

async function singleCallWithFromOverride(ethereumClientService: EthereumClientService, simulationState: SimulationState | undefined, request: EthCallParams, from: bigint) {
	const callParams = request.params[0]
	const blockTag = request.params.length > 1 ? request.params[1] : 'latest' as const
	const gasPrice = callParams.gasPrice !== undefined ? callParams.gasPrice : 0n
	const value = callParams.value !== undefined ? callParams.value : 0n

	const callTransaction = {
		type: '1559' as const,
		from,
		chainId: ethereumClientService.getChainId(),
		nonce: await getSimulatedTransactionCountOverStack(ethereumClientService, undefined, simulationState, from),
		maxFeePerGas: gasPrice,
		maxPriorityFeePerGas: 0n,
		to: callParams.to === undefined ? null : callParams.to,
		value,
		input: getInputFieldFromDataOrInput(callParams),
		accessList: [],
	}

	return await simulatedCall(ethereumClientService, undefined, simulationState, callTransaction, blockTag)
}

export async function call(ethereumClientService: EthereumClientService, simulationState: SimulationState | undefined, request: EthCallParams) {
	const callParams = request.params[0]
	const from = callParams.from !== undefined ? callParams.from : DEFAULT_CALL_ADDRESS
	const callResult = await singleCallWithFromOverride(ethereumClientService, simulationState, request, from)
	return { type: 'result' as const, method: request.method, ...callResult }
}

export const formEthSendTransaction = async (ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined, simulationState: SimulationState | undefined, blockDelta: number, activeAddress: bigint | undefined, sendTransactionParams: SendTransactionParams) => {
	const parentBlockPromise = ethereumClientService.getBlock(requestAbortController) // we are getting the real block here, as we are not interested in the current block where this is going to be included, but the parent
	const transactionDetails = sendTransactionParams.params[0]
	if (activeAddress === undefined) throw new Error('Access to active address is denied')
	const from = transactionDetails.from !== undefined ? transactionDetails.from : activeAddress
	const transactionCountPromise = getSimulatedTransactionCountOverStack(ethereumClientService, requestAbortController, simulationState, from)
	const parentBlock = await parentBlockPromise
	if (parentBlock === null) throw new Error('The latest block is null')
	if (parentBlock.baseFeePerGas === undefined) throw new Error(CANNOT_SIMULATE_OFF_LEGACY_BLOCK)
	const maxPriorityFeePerGas = transactionDetails.maxPriorityFeePerGas !== undefined && transactionDetails.maxPriorityFeePerGas !== null ? transactionDetails.maxPriorityFeePerGas : 10n**8n // 0.1 nanoEth/gas
	const transactionWithoutGas = {
		type: '1559' as const,
		from,
		chainId: ethereumClientService.getChainId(),
		nonce: await transactionCountPromise,
		maxFeePerGas: transactionDetails.maxFeePerGas !== undefined && transactionDetails.maxFeePerGas !== null ? transactionDetails.maxFeePerGas : parentBlock.baseFeePerGas * 2n + maxPriorityFeePerGas,
		maxPriorityFeePerGas,
		to: transactionDetails.to === undefined ? null : transactionDetails.to,
		value: transactionDetails.value !== undefined  ? transactionDetails.value : 0n,
		input: getInputFieldFromDataOrInput(transactionDetails),
		accessList: [],
	} as const
	const extraParams = {
		originalRequestParameters: sendTransactionParams,
		error: undefined,
	}
	if (transactionDetails.gas === undefined) {
		try {
			const estimateGas = await simulateEstimateGas(ethereumClientService, requestAbortController, simulationState, transactionWithoutGas, blockDelta)
			if ('error' in estimateGas) return { ...extraParams, ...estimateGas, success: false } as const
			return { transaction: { ...transactionWithoutGas, gas: estimateGas.gas }, ...extraParams, success: true } as const
		} catch(error: unknown) {
			if (error instanceof JsonRpcResponseError) return { ...extraParams, error: { code: error.code, message: error.message, data: typeof error.data === 'string' ? error.data : '0x' }, success: false } as const
			printError(error)
			if (error instanceof Error) return { ...extraParams, error: { code: 123456, message: error.message, data: 'data' in error && typeof error.data === 'string' ? error.data : '0x' }, success: false } as const
			return { ...extraParams, error: { code: 123456, message: 'Unknown Error', data: '0x' }, success: false } as const
		}
	}
	return { transaction: { ...transactionWithoutGas, gas: transactionDetails.gas }, ...extraParams, success: true } as const
}

export type MockWindowEthereum = EIP1193Provider & {
	addStateOverrides: (stateOverrides: StateOverrides) => Promise<void>
	advanceTime: (amountInSeconds: EthereumQuantity) => Promise<void>
}
export const getMockedEthSimulateWindowEthereum = (): MockWindowEthereum => {
	const specifiedEndpoint = process.env.ETHEREUM_TEST_RPC_ENDPOINT
	const httpsRpc = specifiedEndpoint ? specifiedEndpoint : 'https://ethereum.dark.florist'
	const ethereumClientService = new EthereumClientService(
		new EthereumJSONRpcRequestHandler(httpsRpc, false),
		async () => {},
		async () => {},
		{ name: 'Ethereum', chainId: 1n, httpsRpc }
	)
	let simulationState: SimulationState | undefined = undefined
	const activeAddress = 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045n

	return {
		request: async (unknownArgs: unknown): Promise<any> => {
			const args = EthereumJsonRpcRequest.parse(unknownArgs)
			switch(args.method) {
				case 'eth_call': {
					const result = await call(ethereumClientService, simulationState, args)
					if (result.error !== undefined) throw new Error(result.error.message)
					return EthereumData.serialize(result.result)
				}
				case 'eth_getLogs': {
					const result = await getSimulatedLogs(ethereumClientService, undefined, simulationState, args.params[0])
					return EthGetLogsResponse.serialize(result)
				}
				case 'eth_getTransactionByHash': {
					const result = await getSimulatedTransactionByHash(ethereumClientService, undefined, simulationState, args.params[0])
					return funtypes.Union(EthereumSignedTransactionWithBlockData, funtypes.Null).serialize(result)
				}
				case 'eth_chainId': {
					const result = ethereumClientService.getChainId()
					return EthereumQuantity.serialize(result)
				}
				case 'eth_sendTransaction': {
					//TODO, only one transaction should be included at once
					const blockDelta = simulationState?.blocks.length || 0 // always create new block to add transactions to
					const transaction = await formEthSendTransaction(ethereumClientService, undefined, simulationState, blockDelta, activeAddress, args)
					if (transaction.success === false) throw new Error(transaction.error?.message)
					const signed = mockSignTransaction(transaction.transaction)
					simulationState = await appendTransaction(ethereumClientService, undefined, simulationState, [transaction.transaction], blockDelta)
					return EthereumBytes32.serialize(signed.hash)
				}
				case 'eth_blockNumber': {
					const result = await getSimulatedBlockNumber(ethereumClientService, undefined, simulationState)
					return EthereumQuantity.serialize(result)
				}
				case 'eth_getBlockByNumber': {
					const result = await getSimulatedBlock(ethereumClientService, undefined, simulationState, args.params[0], args.params[1])
					return GetBlockReturn.serialize(result)
				}
				case 'eth_gasPrice': {
					const result = await ethereumClientService.getGasPrice(undefined)
					return EthereumQuantity.serialize(result)
				}
				case 'eth_estimateGas': {
					const estimatedGas = await simulateEstimateGas(ethereumClientService, undefined, simulationState, args.params[0], simulationState?.blocks.length || 0)
					if ('error' in estimatedGas) throw new ErrorWithDataAndCode(estimatedGas.error.code, estimatedGas.error.data, estimatedGas.error.message)
					return EthereumQuantity.serialize(estimatedGas.gas)
				}
				case 'eth_getTransactionCount': {
					const result = await getSimulatedTransactionCountOverStack(ethereumClientService, undefined, simulationState, args.params[0], args.params[1])
					return EthereumQuantity.serialize(result)
				}
				case 'eth_getCode': {
					const result = await getSimulatedCode(ethereumClientService, undefined, simulationState, args.params[0], args.params[1])
					if (result.statusCode === 'failure') throw new ErrorWithDataAndCode(-40001, '', 'Failed to getCode')
					return EthereumData.serialize(result.getCodeReturn)
				}
				case 'eth_getTransactionReceipt': {
					const result =  await getSimulatedTransactionReceipt(ethereumClientService, undefined, simulationState, args.params[0])
					return EthTransactionReceiptResponse.serialize(result)
				}
				default: {
					console.log('unknown RPC call:')
					console.log(args)
					throw new ErrorEvent(`unknown method: ${ args.method }`)
				}
			}
		},
		on: () => {
			console.log('on called')
		},
		removeListener: () => {
			console.log('removeListener')
		},
		addStateOverrides: async (stateOverrides: StateOverrides) => {
			const newBlock = { simulatedTransactions: [], signedMessages: [], stateOverrides, timeIncreaseDelta: 12n }
			if (simulationState === undefined) {
				simulationState = {
					blocks: [newBlock],
					blockNumber: await ethereumClientService.getBlockNumber(undefined),
					blockTimestamp: new Date(),
					simulationConductedTimestamp: new Date(),
					baseFeePerGas: 0n,
				}
			} else {
				simulationState = { ...simulationState, blocks: [...simulationState.blocks, newBlock] }
			}
			const input = {
				blocks: [
					...simulationState.blocks.map((block) => ({
						stateOverrides: block.stateOverrides,
						transactions: getPreSimulated(block.simulatedTransactions),
						signedMessages: block.signedMessages,
						timeIncreaseDelta: block.timeIncreaseDelta,
					}))
				]
			}
			simulationState = await createSimulationState(ethereumClientService, undefined, input)
		},
		advanceTime: async (amountInSeconds: EthereumQuantity) => {
			const newBlock = { simulatedTransactions: [], signedMessages: [], stateOverrides: {}, timeIncreaseDelta: amountInSeconds }
			if (simulationState === undefined) {
				simulationState = {
					blocks: [newBlock],
					blockNumber: await ethereumClientService.getBlockNumber(undefined),
					blockTimestamp: new Date(),
					simulationConductedTimestamp: new Date(),
					baseFeePerGas: 0n,
				}
			} else {
				simulationState = { ...simulationState, blocks: [...simulationState.blocks, newBlock] }
			}
			const input = {
				blocks: [
					...simulationState.blocks.map((block) => ({
						stateOverrides: block.stateOverrides,
						transactions: getPreSimulated(block.simulatedTransactions),
						signedMessages: block.signedMessages,
						timeIncreaseDelta: block.timeIncreaseDelta,
					}))
				]
			}
			simulationState = await createSimulationState(ethereumClientService, undefined, input)
		}
	}
}
