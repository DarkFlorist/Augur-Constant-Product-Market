import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumQuantity } from '../../types/types.js'
import { fetchHotLoadingMarketData, getChildUniverse, getForkValues, getParentUniverse, getRepBond, getUniverseForkingInformation, migrateFromRepV1toRepV2GenesisToken, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { approveErc20Token, getErc20TokenBalance } from '../../utils/erc20.js'
import { MARKET_TYPES, REPUTATION_V1_TOKEN_ADDRESS } from '../../utils/constants.js'
import { getOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, getUniverseUrl, isGenesisUniverse } from '../../utils/augurUtils.js'
import { Signal, useComputed, useSignal } from '@preact/signals'
import { addressString, bigintToDecimalString, decimalStringToBigint, formatUnixTimestampISO } from '../../utils/ethereumUtils.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { MarketOutcomeOption, MarketReportingWithoutStake } from '../../SharedUI/MarketReportingOptions.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'

interface MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	pathSignal: Signal<string>
}

interface GetForkValuesProps {
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
}
// todo modify this to show this with the current rep in different universes and not just the goal
export const DisplayForkValues = ({ forkValues }: GetForkValuesProps) => {
	if (forkValues.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<span><b>Fork Values</b></span>
		<div style = 'display: grid'>
			<span><b>Fork Reputation Goal (rep required for universe to win):</b>{ bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n, 2) } REP</span>
		</div>
	</div>
}

const GENESIS_REPUTATION_V2_TOKEN_ADDRESS = '0x221657776846890989a759BA2973e427DfF5C9bB'

export const Migration = ({ maybeReadClient, maybeWriteClient, reputationTokenAddress, universe, universeForkingInformation, pathSignal }: MigrationProps) => {
	const v2ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const v1ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const isGenesisUniverseField = useComputed(() => isGenesisUniverse(universe.deepValue))
	const forkingoutcomeStakes = useOptionalSignal<readonly MarketOutcomeOption[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const forkingRepBond = useOptionalSignal<EthereumQuantity>(undefined)
	const selectedOutcome = useSignal<string | null>(null)
	const repV2ToMigrateToNewUniverse = useSignal<string>('')
	const parentUniverse = useOptionalSignal<AccountAddress>(undefined)
	const childUniverseAddress = useOptionalSignal<AccountAddress>(undefined)
	const childUniverseUrl = useComputed(() => childUniverseAddress.deepValue === undefined ? '' : getUniverseUrl(childUniverseAddress.deepValue, 'migration'))
	const parentUniverseUrl = useComputed(() => parentUniverse.deepValue === undefined ? '' : getUniverseUrl(parentUniverse.deepValue, 'migration'))
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)

	const getParsedExtraInfo = (extraInfo: string) => {
		try {
			return ExtraInfo.parse(JSON.parse(extraInfo))
		} catch(error) {
			return undefined
		}
	}

	const update = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) throw new Error('missing readClient')
		if (readClient.account?.address === undefined) throw new Error('missing own address')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		v2ReputationBalance.deepValue = await getErc20TokenBalance(readClient, reputationTokenAddress.deepValue, readClient.account.address)
		if (isGenesisUniverse(universe.deepValue)) {
			// retrieve v1 balance only for genesis universe as its only relevant there
			v1ReputationBalance.deepValue = await getErc20TokenBalance(readClient, REPUTATION_V1_TOKEN_ADDRESS, readClient.account.address)
			parentUniverse.deepValue = addressString(0n) // we know that genesis doesn't have parent universe
		} else if (universe.deepValue !== undefined) {
			parentUniverse.deepValue = await getParentUniverse(readClient, universe.deepValue)
		}
		if (universeForkingInformation.deepValue?.isForking) {
			const newMarketData = await fetchHotLoadingMarketData(readClient, universeForkingInformation.deepValue.forkingMarket)
			const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
			forkingMarketData.deepValue = { marketAddress: universeForkingInformation.deepValue.forkingMarket, parsedExtraInfo, hotLoadingMarketData: newMarketData }
			forkingRepBond.deepValue = await getRepBond(readClient, universeForkingInformation.deepValue.forkingMarket)
			const marketType = MARKET_TYPES[forkingMarketData.deepValue.hotLoadingMarketData.marketType]
			if (marketType === undefined) throw new Error('invalid marketType')
			forkingoutcomeStakes.deepValue = getOutcomeNamesAndNumeratorCombinationsForMarket(marketType, forkingMarketData.deepValue.hotLoadingMarketData.numOutcomes, forkingMarketData.deepValue.hotLoadingMarketData.numTicks, forkingMarketData.deepValue.hotLoadingMarketData.outcomes)
			forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)
		}
	}

	const migrateReputationToChildUniverseByPayoutButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		if (forkingoutcomeStakes.deepValue === undefined) throw new Error('missing forkingoutcomeStakes')
		const payoutNumerators = forkingoutcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!payoutNumerators) throw new Error('Selected outcome not found')

		if (repV2ToMigrateToNewUniverse.value.trim() === '') throw new Error ('Input missing')
		const repV2ToMigrateToNewUniverseBigInt = decimalStringToBigint(repV2ToMigrateToNewUniverse.value, 18n)
		if (selectedOutcome.value === null) throw new Error('Invalid input')

		await migrateReputationToChildUniverseByPayout(writeClient, reputationTokenAddress.deepValue, payoutNumerators, repV2ToMigrateToNewUniverseBigInt)
	}

	const migrateFromRepV1toRepV2GenesisTokenButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		await migrateFromRepV1toRepV2GenesisToken(writeClient, GENESIS_REPUTATION_V2_TOKEN_ADDRESS)
	}

	const approveRepV1ForMigration = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (v1ReputationBalance.deepValue === undefined) throw new Error('missing v1ReputationBalance balance')
		await approveErc20Token(writeClient, REPUTATION_V1_TOKEN_ADDRESS, GENESIS_REPUTATION_V2_TOKEN_ADDRESS, v1ReputationBalance.deepValue)
	}

	const getChildUniverseButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (forkingoutcomeStakes.deepValue === undefined) throw new Error('missing forkingoutcomeStakes')
		const payoutNumerators = forkingoutcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!payoutNumerators) throw new Error('Selected outcome not found')
		if (selectedOutcome.value === null) throw new Error('Invalid input')
		if (forkingMarketData.deepValue === undefined) throw new Error('Forking market missing')
		const hotLoading = forkingMarketData.deepValue.hotLoadingMarketData
		childUniverseAddress.deepValue = await getChildUniverse(writeClient, hotLoading.universe, payoutNumerators, hotLoading.numTicks, hotLoading.numOutcomes)
	}

	if (universe.deepValue === undefined || reputationTokenAddress.deepValue === undefined || universeForkingInformation.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<button class = 'button is-primary' onClick = { update }>Update data</button>
		<div class = 'panel'>
			<div style = 'display: grid'>
				<span><b>Universe Name:</b>{ getUniverseName(universe.deepValue) }</span>
				<span><b>Universe Address:</b>{ universe.deepValue }</span>
				<span><b>Parent Universe Name:</b>{ parentUniverse.deepValue === undefined ? '' : getUniverseName(parentUniverse.deepValue) }</span>
				<span><b>Parent Universe Address:</b><a href = '#' onClick = { (event) => { event.preventDefault(); pathSignal.value = parentUniverseUrl.value } }> { parentUniverse.value }</a></span>
				<span><b>Reputation V2 Address For The Universe:</b>{ reputationTokenAddress.deepValue }</span>
				<span><b>Is Universe Forking:</b>{ universeForkingInformation.deepValue.isForking ? 'Yes' : 'No' }</span>
				<span><b>Forking End Time:</b>{ universeForkingInformation.deepValue.forkEndTime === undefined ? 'Not Forking' : formatUnixTimestampISO(universeForkingInformation.deepValue.forkEndTime) }</span>
				<span><b>Has Forking Time Ended:</b>{ universeForkingInformation.deepValue.forkEndTime !== undefined && universeForkingInformation.deepValue.forkEndTime < new Date().getUTCSeconds() ? 'Yes' : 'No' }</span>
				<span><b>Forking Market:</b>{ universeForkingInformation.deepValue.forkingMarket === undefined ? 'No Forking Market' : universeForkingInformation.deepValue.forkingMarket }</span>
				<span><b>Your Reputation V2 Balance:</b>{ v2ReputationBalance.deepValue !== undefined ? `${ bigintToDecimalString(v2ReputationBalance.deepValue, 18n, 2) } REP` : '' }</span>
			</div>
		</div>
		{ universeForkingInformation.deepValue.isForking ? <>
			<div class = 'panel'>
				<Market marketData = { forkingMarketData } universe = { universe } repBond = { forkingRepBond }/>
				<MarketReportingWithoutStake outcomeStakes = { forkingoutcomeStakes } selectedOutcome = { selectedOutcome }/>
				<DisplayForkValues forkValues = { forkValues }/>
				<p> Child universe address: <a href = '#' onClick = { (event) => { event.preventDefault(); pathSignal.value = childUniverseUrl.value } }> { childUniverseAddress.value }</a></p>
				<div style = 'margin-top: 0.5rem'>
					<label>
						Amount to migrate to new universe:{' '}
						<input
							type = 'text'
							placeholder = ''
							value = { repV2ToMigrateToNewUniverse.value }
							onChange = { (event) => {
								const target = event.target as HTMLInputElement
								repV2ToMigrateToNewUniverse.value = target.value
							} }
						/>
					</label>
				</div>
			</div>
			<button class = 'button is-primary' onClick = { getChildUniverseButton }>Refresh child universe for the selection</button>
			<button class = 'button is-primary' onClick = { migrateReputationToChildUniverseByPayoutButton }>Migrate Reputation to the new universe</button>
		</> : <></> }
		{ isGenesisUniverseField.value ? <>
			<div class = 'panel'>
				<div style = 'display: grid'>
					<span><b>Reputation V1 Address:</b>{ REPUTATION_V1_TOKEN_ADDRESS }</span>
					<span><b>Your Reputation V1 Balance:</b>{ v1ReputationBalance.deepValue !== undefined ? `${ bigintToDecimalString(v1ReputationBalance.deepValue, 18n, 2) } REPv1` : '' }</span>
				</div>
			</div>
			<button class = 'button is-primary' onClick = { approveRepV1ForMigration }>Approve Reputation V1 For Migration</button>
			<button class = 'button is-primary' onClick = { migrateFromRepV1toRepV2GenesisTokenButton }>Migrate Reputation V1 Tokens To Reputation V2</button>
		</> : <></> }
	</div>
}
