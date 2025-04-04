import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { GENESIS_UNIVERSE, YES_NO_OPTIONS } from './constants.js'
import { stringToUint8Array, stripTrailingZeros } from './ethereumUtils.js'

// TODO, try to come up with nice ways to call universes (based on market information)
export const getUniverseName = (universeAddress: AccountAddress) => {
	if (BigInt(universeAddress) == BigInt(GENESIS_UNIVERSE)) return 'Genesis'
	return universeAddress
}

export const isGenesisUniverse = (universeAddress: AccountAddress | undefined) => universeAddress !== undefined && getUniverseName(universeAddress) === 'Genesis'

export const getAllPayoutNumeratorCombinations = (numOutcomes: bigint, numTicks: EthereumQuantity): readonly bigint[][] => Array.from({ length: Number(numOutcomes) }, (_, outcome) => Array.from({ length: Number(numOutcomes) }, (_, index) => index === outcome ? numTicks : 0n))

type MarketType = 'Yes/No' | 'Categorical' | 'Scalar'
export const getOutcomeName = (index: number, marketType: MarketType, outcomes: readonly `0x${ string }`[]) => {
	if (index === 0) return 'Invalid'
	if (marketType === 'Yes/No') return YES_NO_OPTIONS[index]
	const outcomeName = outcomes[index - 1]
	if (outcomeName === undefined) return undefined
	return new TextDecoder().decode(stripTrailingZeros(stringToUint8Array(outcomeName)))
}

export const getOutcomeNamesAndNumeratorCombinationsForMarket = (marketType: MarketType, numOutcomes: bigint, numTicks: bigint, outcomes: readonly `0x${ string }`[]) => {
	if (marketType === 'Scalar') throw new Error ('Scalar markets not implemented')
	const allPayoutNumerators = getAllPayoutNumeratorCombinations(numOutcomes, numTicks)
	return allPayoutNumerators.map((payoutNumerators, index) => {
		const outcomeName = getOutcomeName(index, marketType, outcomes)
		if (outcomeName === undefined) throw new Error(`outcome did not found for index: ${ index }. Outcomes: [${ outcomes.join(',') }]`)
		return { outcomeName, payoutNumerators }
	})
}

// todo, make path typesafe
export const getUniverseUrl = (universe: AccountAddress, path: string) => `/#/${ path }?universe=${ universe }`
