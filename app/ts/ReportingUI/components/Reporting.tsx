import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { buyParticipationTokens, contributeToMarketDispute, contributeToMarketDisputeOnTentativeOutcome, disavowCrowdsourcers, doInitialReport, fetchHotLoadingCurrentDisputeWindowData, fetchHotLoadingMarketData, fetchHotLoadingTotalValidityBonds, finalizeMarket, getDisputeWindow, getDisputeWindowInfo, getForkValues, getPreemptiveDisputeCrowdsourcer, getReportingHistory, getStakeOfReportingParticipant, getStakesOnAllOutcomesOnYesNoMarketOrCategorical, getWinningPayoutNumerators, migrateThroughOneFork, ReportingHistoryElement } from '../../utils/augurContractUtils.js'
import { addressString, areEqualArrays, bigintToDecimalString, decimalStringToBigint, formatUnixTimestampISO } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { MARKET_TYPES } from '../../utils/constants.js'
import { useSignal } from '@preact/signals'
import { AccountAddress, EthereumAddress } from '../../types/types.js'
import { humanReadableDateDelta, SomeTimeAgo } from './SomeTimeAgo.js'
import { MarketReportingOptions, MarketReportingWithoutStake, OutcomeStake } from '../../SharedUI/MarketReportingOptions.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { getAllPayoutNumeratorCombinations, getOutcomeName } from '../../utils/augurUtils.js'

type DisputeWindowData = {
    disputeWindow: `0x${ string }`
    startTime: bigint
    endTime: bigint
    purchased: bigint
    fees: bigint
}

interface DisputeWindowProps {
	disputeWindowData: OptionalSignal<DisputeWindowData>
}
export const DisputeWindow = ({ disputeWindowData }: DisputeWindowProps) => {
	if (disputeWindowData.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Dispute Window:</b>{ disputeWindowData.deepValue.disputeWindow }</span>
			<span><b>Start Time:</b>{ formatUnixTimestampISO(disputeWindowData.deepValue.startTime) }</span>
			<span><b>End Time:</b>{ formatUnixTimestampISO(disputeWindowData.deepValue.endTime) }</span>
			<span><b>Fees:</b>{ bigintToDecimalString(disputeWindowData.deepValue.fees, 18n) } DAI</span>
			<span><b>Purchased:</b>{ disputeWindowData.deepValue.purchased } Participation Tokens</span>
		</div>
	</div>
}

interface ValidityBondProps {
	totalValidityBondsForAMarket: OptionalSignal<bigint>
}
export const ValidityBond = ({ totalValidityBondsForAMarket }: ValidityBondProps) => {
	if (totalValidityBondsForAMarket.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Total Validity Bonds For A Market:</b>{ bigintToDecimalString(totalValidityBondsForAMarket.deepValue, 18n) } REP</span>
		</div>
	</div>
}

interface ForkMigrationProps {
	marketData: OptionalSignal<MarketData>
	maybeAccountAddress: OptionalSignal<AccountAddress>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
}

export const ForkMigration = ({ marketData, maybeAccountAddress, outcomeStakes }: ForkMigrationProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	const initialReportReason = useSignal<string>('')
	const selectedOutcome = useSignal<string | null>(null)
	const disavowCrowdsourcersButton = async () => {
		if (maybeAccountAddress.deepValue === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		await disavowCrowdsourcers(maybeAccountAddress.deepValue, marketData.deepValue.marketAddress)
	}
	const migrateThroughOneForkButton = async () => {
		if (maybeAccountAddress.deepValue === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		if (outcomeStakes.deepValue === undefined) throw new Error('outcomeStakes missing')
		const initialReportPayoutNumerators = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!initialReportPayoutNumerators) throw new Error('Selected outcome not found')
		await migrateThroughOneFork(maybeAccountAddress.deepValue, marketData.deepValue.marketAddress, initialReportPayoutNumerators, initialReportReason.peek())
	}
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Market Fork Migration:</b></span>
			<MarketReportingWithoutStake outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome }/>
			<label>
				Initial Report Reason:{' '}
				<input
					type = 'text'
					value = { initialReportReason.value }
					onChange = { (event) => {
						const target = event.target as HTMLInputElement
						initialReportReason.value = target.value
					} }
				/>
			</label>
		</div>
		<div style = 'margin-top: 1rem'>
			<button class = 'button is-primary' onClick = { disavowCrowdsourcersButton }>Disavow Crowdsourcers</button>
		</div>
		<div style = 'margin-top: 1rem'>
			<button class = 'button is-primary' onClick = { migrateThroughOneForkButton }>Migrate Through One Fork</button>
		</div>
	</div>
}

interface DisplayStakesProps {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeAccountAddress: OptionalSignal<AccountAddress>
	marketData: OptionalSignal<MarketData>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
}

export const DisplayStakes = ({ outcomeStakes, maybeAccountAddress, marketData, disputeWindowInfo, preemptiveDisputeCrowdsourcerStake, forkValues }: DisplayStakesProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const selectedOutcome = useSignal<string | null>(null)
	const reason = useSignal<string>('')
	const amountInput = useSignal<string>('')

	const report = async (outcomeStake: OutcomeStake, reportReason: string, amount: bigint) => {
		if (maybeAccountAddress.deepValue === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('market missing')
		const market = marketData.deepValue.marketAddress
		if (outcomeStake.status === 'Winning') {
			return await contributeToMarketDisputeOnTentativeOutcome(
				maybeAccountAddress.deepValue,
				market,
				outcomeStake.payoutNumerators,
				amount,
				reportReason
			)
		}
		return await contributeToMarketDispute(
			maybeAccountAddress.deepValue,
			market,
			outcomeStake.payoutNumerators,
			amount,
			reportReason
		)
	}

	const handleReport = async () => {
		if (outcomeStakes.deepValue === undefined) return
		if (amountInput.value.trim() === '') throw new Error ('Input missing')
		const amountBigInt = decimalStringToBigint(amountInput.value, 18n)
		if (selectedOutcome.value === null) throw new Error('Invalid input')
		const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
		if (!outcomeStake) throw new Error('Selected outcome not found')
		try {
			await report(outcomeStake, reason.value, amountBigInt)
		} catch (error) {
			console.error('Error reporting for outcome:', outcomeStake.outcomeName, error)
		}
	}

	const ResolvingTo = () => {
		if (outcomeStakes.deepValue === undefined) return <></>
		if (disputeWindowInfo.deepValue === undefined) return <></>
		const winningOption = outcomeStakes.deepValue.find((outcome) => outcome.status === 'Winning')
		if (winningOption === undefined) return <></>
		const endDate = new Date(Number(disputeWindowInfo.deepValue.endTime) * 1000)
		return <div style = 'margin-top: 1rem'>
			<SomeTimeAgo priorTimestamp = { endDate } countBackwards = { true } diffToText = {
				(time: number) => {
					if (disputeWindowInfo.deepValue === undefined) return <></>
					if (time <= 0) return <>`The market has resolved to "${ winningOption.outcomeName }."`</>
					return <>Resolving To "{ winningOption.outcomeName }" if not disputed in { humanReadableDateDelta(time) } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.endTime) }).</>
				}
			}/>
		</div>
	}

	const TotalRepStaked = () => {
		if (outcomeStakes.deepValue === undefined || forkValues.deepValue === undefined) return <></>
		return <div style = 'display: grid; margin-top: 1rem'>
			<span><b>Total Rep staked on the market:</b>{ ' ' }{ bigintToDecimalString(outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n), 18n) } REP</span>
			<span><b>Entering Slow Reporting after:</b>{ ' ' }{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForDisputePacing, 18n) } REP is staked within one round</span>
			<span><b>Forking Augur after:</b>{ ' ' }{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForFork, 18n) } REP is staked within one round</span>
		</div>
	}

	return (
		<div class = 'panel'>
			<div style = 'display: grid'>
				<span><b>Market REP Stakes:</b></span>
				<MarketReportingOptions outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake }/>
				<TotalRepStaked/>
				<ResolvingTo/>
				<div style = 'margin-top: 1rem'>
					<label>
						Reason:{' '}
						<input
							type = 'text'
							value = { reason.value }
							style = { 'width: 100%' }
							placeholder = 'Optional: Explain why you believe this outcome is correct'
							onChange = { (event) => {
								const target = event.target as HTMLInputElement
								reason.value = target.value
							} }
						/>
					</label>
				</div>
				<div style = 'margin-top: 0.5rem'>
					<label>
						Amount:{' '}
						<input
							type = 'text'
							placeholder = ''
							value = { amountInput.value }
							onChange = { (event) => {
								const target = event.target as HTMLInputElement
								amountInput.value = target.value
							} }
						/>
					</label>
				</div>
				<div style = 'margin-top: 1rem'>
					<button class = 'button is-primary' onClick = { handleReport }>Report</button>
				</div>
			</div>
		</div>
	)
}

interface DisplayDisputeWindowProps {
	disputeWindowAddress: OptionalSignal<AccountAddress>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
}

export const DisplayDisputeWindow = ({ disputeWindowAddress, disputeWindowInfo }: DisplayDisputeWindowProps) => {
	if (disputeWindowAddress.deepValue === undefined) return <></>
	if (disputeWindowInfo.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Dispute Window Address:</b>{ disputeWindowAddress.deepValue }</span>
			<span><b>Start:</b>{ formatUnixTimestampISO(disputeWindowInfo.deepValue.startTime) }</span>
			<span><b>End:</b>{ formatUnixTimestampISO(disputeWindowInfo.deepValue.endTime) }</span>
			<span><b>Is Active:</b>{ disputeWindowInfo.deepValue.isActive ? 'Yes' : 'No' }</span>
		</div>
	</div>
}

interface GetForkValuesProps {
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
}
export const DisplayForkValues = ({ forkValues }: GetForkValuesProps) => {
	if (forkValues.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<span><b>Fork Values</b></span>
		<div style = 'display: grid'>
			<span><b>Initial Report Min Value:</b>{ bigintToDecimalString(forkValues.deepValue.initialReportMinValue, 18n) } REP</span>
			<span><b>Dispute Threshold For Dispute Pacing (one round):</b>{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForDisputePacing, 18n) } REP</span>
			<span><b>Dispute Threshold For Fork (one round):</b>{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForFork, 18n) } REP</span>
			<span><b>Fork Reputation Goal:</b>{ bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n) } REP</span>
		</div>
	</div>
}

interface ReportingHistoryProps {
	reportingHistory: OptionalSignal<readonly ReportingHistoryElement[]>
	marketData: OptionalSignal<MarketData>
}
export const ReportingHistory = ({ reportingHistory, marketData }: ReportingHistoryProps) => {
	if (reportingHistory.deepValue === undefined) return <></>
	if (marketData.deepValue === undefined) return <></>
	const allPayoutNumerators = getAllPayoutNumeratorCombinations(marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)

	return <div class = 'panel'>
		<span><b>Reporting history for the market</b></span>
		<div style = 'display: grid'>
			{ reportingHistory.deepValue.map((round) => {
				if (marketData.deepValue === undefined) return <></>
				const marketType = MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType]
				if (marketType === undefined) throw new Error(`Invalid market type Id: ${ marketData.deepValue.hotLoadingMarketData.marketType }`)
				const payoutIndex = allPayoutNumerators.findIndex((option) => areEqualArrays(option, round.payoutNumerators))
				const outcomeName = getOutcomeName(payoutIndex, marketType, marketData.deepValue.hotLoadingMarketData.outcomes || [])
				return <span><b>Round { ' ' }{ round.round }</b>{ ': ' }{ outcomeName }{ ' ' }for{ ' ' }{ bigintToDecimalString(round.stake, 18n) }{ ' ' }REP</span>
			})}
		</div>
	</div>
}

interface ReportingProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
}

export const Reporting = ({ maybeAccountAddress, universe, reputationTokenAddress }: ReportingProps) => {
	const marketAddressString = useSignal<string>('')
	const marketData = useOptionalSignal<MarketData>(undefined)
	const disputeWindowData = useOptionalSignal<DisputeWindowData>(undefined)
	const totalValidityBondsForAMarket = useOptionalSignal<bigint>(undefined)
	const outcomeStakes = useOptionalSignal<readonly OutcomeStake[]>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const preemptiveDisputeCrowdsourcerAddress = useOptionalSignal<AccountAddress>(undefined)
	const preemptiveDisputeCrowdsourcerStake = useOptionalSignal<bigint>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const reportingHistory = useOptionalSignal<readonly ReportingHistoryElement[]>(undefined)

	const getParsedExtraInfo = (extraInfo: string) => {
		try {
			return ExtraInfo.parse(JSON.parse(extraInfo))
		} catch(error) {
			return undefined
		}
	}

	const fetchMarketData = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		marketData.deepValue = undefined
		disputeWindowData.deepValue = undefined
		totalValidityBondsForAMarket.deepValue = undefined
		outcomeStakes.deepValue = undefined
		disputeWindowAddress.deepValue = undefined
		disputeWindowInfo.deepValue = undefined
		preemptiveDisputeCrowdsourcerAddress.deepValue = undefined
		preemptiveDisputeCrowdsourcerStake.deepValue = 0n
		forkValues.deepValue = undefined
		reportingHistory.deepValue = undefined

		const marketAddress = EthereumAddress.safeParse(marketAddressString.value.trim())
		if (!marketAddress.success) throw new Error('market not defined')
		const parsedMarketAddressString = addressString(marketAddress.value)
		const newMarketData = await fetchHotLoadingMarketData(account.value, parsedMarketAddressString)
		const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
		marketData.deepValue = { marketAddress: parsedMarketAddressString, parsedExtraInfo, hotLoadingMarketData: newMarketData }
		const currentMarketData = marketData.deepValue
		disputeWindowData.deepValue = await fetchHotLoadingCurrentDisputeWindowData(account.value, currentMarketData.hotLoadingMarketData.universe)
		totalValidityBondsForAMarket.deepValue = await fetchHotLoadingTotalValidityBonds(account.value, [parsedMarketAddressString])
		if (MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Yes/No' || MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Categorical') {
			const allPayoutNumerators = getAllPayoutNumeratorCombinations(marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)
			const winningOption = await getWinningPayoutNumerators(account.value, parsedMarketAddressString)
			const winningIndex = winningOption === undefined ? -1 : allPayoutNumerators.findIndex((option) => areEqualArrays(option, winningOption))
			const stakes = await getStakesOnAllOutcomesOnYesNoMarketOrCategorical(account.value, parsedMarketAddressString, marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)
			outcomeStakes.deepValue = stakes.map((repStake, index) => {
				const marketType = MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType]
				if (marketType === undefined) throw new Error(`Invalid market type Id: ${ currentMarketData.hotLoadingMarketData.marketType }`)
				const outcomeName = getOutcomeName(index, marketType, currentMarketData.hotLoadingMarketData.outcomes || [])
				const payoutNumerators = allPayoutNumerators[index]
				if (outcomeName === undefined || payoutNumerators === undefined) throw new Error(`outcome did not found for index: ${ index }. Outcomes: [${ currentMarketData.hotLoadingMarketData.outcomes.join(',') }]`)
				return {
					outcomeName,
					repStake,
					status: index === winningIndex ? 'Winning' : 'Losing',
					payoutNumerators,
				}
			})
		}
		disputeWindowAddress.deepValue = await getDisputeWindow(account.value, parsedMarketAddressString)
		if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
			disputeWindowInfo.deepValue = await getDisputeWindowInfo(account.value, disputeWindowAddress.deepValue)
		}
		preemptiveDisputeCrowdsourcerAddress.deepValue = await getPreemptiveDisputeCrowdsourcer(account.value, parsedMarketAddressString)
		if (EthereumAddress.parse(preemptiveDisputeCrowdsourcerAddress.deepValue) !== 0n) {
			preemptiveDisputeCrowdsourcerStake.deepValue = await getStakeOfReportingParticipant(account.value, preemptiveDisputeCrowdsourcerAddress.deepValue)
		}

		forkValues.deepValue = await getForkValues(account.value, reputationTokenAddress.deepValue)
		reportingHistory.deepValue = await getReportingHistory(account.value, parsedMarketAddressString, newMarketData.disputeRound)
	}

	const buyParticipationTokensButton = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		if (universe.deepValue === undefined) throw new Error('missing universe')
		await buyParticipationTokens(account.value, universe.deepValue, 10n)
	}

	const doInitialReportButton = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		if (marketData.deepValue === undefined) throw new Error('missing market data')
		const ticks = marketData.deepValue.hotLoadingMarketData.numTicks
		const report = Array(Number(marketData.deepValue.hotLoadingMarketData.numOutcomes)).fill(0n).map((_, option) => option === 1 ? ticks : 0n)
		const reason = 'Just my initial report'
		const additionalStake = 0n
		await doInitialReport(account.value, marketData.deepValue.marketAddress, report, reason, additionalStake)
	}

	const finalizeMarketButton = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		if (marketData.deepValue === undefined) throw new Error('missing market data')
		await finalizeMarket(account.value, marketData.deepValue.marketAddress)
	}

	function handleMarketAddress(value: string) {
		marketAddressString.value = value
	}

	return <div class = 'subApplication'>
		<p style = 'margin: 0;'>Reporting:</p>
		<div style = 'display: grid; width: 100%; gap: 10px;'>
			<p style = 'margin: 0;'>Market address:</p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '0x...'
				value = { marketAddressString.value }
				onInput = { e => handleMarketAddress(e.currentTarget.value) }
			/>
			<button class = 'button is-primary' onClick = { fetchMarketData }>Fetch Market Information</button>
			<Market marketData = { marketData } universe = { universe }/>
			<DisputeWindow disputeWindowData = { disputeWindowData }/>
			<ValidityBond totalValidityBondsForAMarket = { totalValidityBondsForAMarket }/>
			<button class = 'button is-primary' onClick = { buyParticipationTokensButton }>Buy 10 Particiption Tokens</button>
			<button class = 'button is-primary' onClick = { doInitialReportButton }>Do Initial Report On First Option</button>
			<DisplayStakes outcomeStakes = { outcomeStakes } marketData = { marketData } maybeAccountAddress = { maybeAccountAddress } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } disputeWindowInfo = { disputeWindowInfo } forkValues = { forkValues }/>
			<DisplayDisputeWindow disputeWindowAddress = { disputeWindowAddress } disputeWindowInfo = { disputeWindowInfo }/>
			<DisplayForkValues forkValues = { forkValues }/>
			<ReportingHistory marketData = { marketData } reportingHistory = { reportingHistory }/>
			<button class = 'button is-primary' onClick = { finalizeMarketButton }>Finalize Market</button>
			<ForkMigration marketData = { marketData } maybeAccountAddress = { maybeAccountAddress } outcomeStakes = { outcomeStakes }/>
		</div>
	</div>
}
