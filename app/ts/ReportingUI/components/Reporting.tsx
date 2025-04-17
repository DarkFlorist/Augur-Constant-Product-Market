import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { contributeToMarketDispute, contributeToMarketDisputeOnTentativeOutcome, disavowCrowdsourcers, doInitialReport, fetchHotLoadingMarketData, finalizeMarket, getAlreadyContributedCrowdSourcerInfoOnAllOutcomesOnYesNoMarketOrCategorical, getDisputeWindow, getDisputeWindowInfo, getForkValues, getPreemptiveDisputeCrowdsourcer, getReportingHistory, getStakeOfReportingParticipant, getStakesOnAllOutcomesOnYesNoMarketOrCategorical, getWinningPayoutNumerators, migrateThroughOneFork, ReportingHistoryElement, getLastCompletedCrowdSourcer, getRepBond } from '../../utils/augurContractUtils.js'
import { addressString, areEqualArrays, bigintToDecimalString, decimalStringToBigint, formatUnixTimestampISO } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { MARKET_TYPES, REPORTING_STATES } from '../../utils/constants.js'
import { Signal, useComputed, useSignal } from '@preact/signals'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'
import { SomeTimeAgo } from './SomeTimeAgo.js'
import { MarketReportingOptions, MarketReportingWithoutStake, OutcomeStake } from '../../SharedUI/MarketReportingOptions.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { getAllPayoutNumeratorCombinations, getOutcomeName, maxStakeAmountForOutcome } from '../../utils/augurUtils.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { bigintSecondsToDate, humanReadableDateDelta, humanReadableDateDeltaFromTo } from '../../utils/utils.js'

interface ForkMigrationProps {
	marketData: OptionalSignal<MarketData>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	canMigrate: Signal<boolean >
}

export const ForkMigration = ({ marketData, maybeWriteClient, outcomeStakes, canMigrate }: ForkMigrationProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (outcomeStakes.deepValue === undefined) return <></>
	const initialReportReason = useSignal<string>('')
	const selectedOutcome = useSignal<string | null>(null)
	const disavowCrowdsourcersButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		await disavowCrowdsourcers(writeClient, marketData.deepValue.marketAddress)
	}
	const migrateThroughOneForkButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		if (outcomeStakes.deepValue === undefined) throw new Error('outcomeStakes missing')
		const initialReportPayoutNumerators = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!initialReportPayoutNumerators) throw new Error('Selected outcome not found')
		await migrateThroughOneFork(writeClient, marketData.deepValue.marketAddress, initialReportPayoutNumerators, initialReportReason.peek())
	}
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Market Fork Migration:</b></span>
			<MarketReportingWithoutStake outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } enabled = { canMigrate }/>
			<label>
				Initial Report Reason:{' '}
				<input
				 	disabled = { !canMigrate.value }
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
			<button class = 'button is-primary' onClick = { disavowCrowdsourcersButton } disabled = { !canMigrate.value }>Disavow Crowdsourcers</button>
		</div>
		<div style = 'margin-top: 1rem'>
			<button class = 'button is-primary' onClick = { migrateThroughOneForkButton } disabled = { !canMigrate.value }>Migrate Through One Fork</button>
		</div>
	</div>
}

interface DisplayStakesProps {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
	repBond: OptionalSignal<EthereumQuantity>
}

export const DisplayStakes = ({ outcomeStakes, maybeWriteClient, marketData, disputeWindowInfo, preemptiveDisputeCrowdsourcerStake, forkValues, lastCompletedCrowdSourcer, repBond }: DisplayStakesProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	if (lastCompletedCrowdSourcer.deepValue === undefined) return <></>
	if (forkValues.deepValue === undefined) return <></>

	const selectedOutcome = useSignal<string | null>(null)
	const reason = useSignal<string>('')
	const amountInput = useSignal<string>('')
	const isSlowReporting = useComputed(() => lastCompletedCrowdSourcer.deepValue !== undefined && forkValues.deepValue !== undefined && lastCompletedCrowdSourcer.deepValue.size >= forkValues.deepValue.disputeThresholdForDisputePacing)
	const isInitialReporting = useComputed(() => {
		if (marketData.deepValue == undefined) return false
		const state = REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState]
		if (state === 'OpenReporting' || state === 'DesignatedReporting') return true
		return false
	})
	const canInitialReport = useComputed(() => {
		if (marketData.deepValue == undefined) return false
		const state = REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState]
		if (state === 'OpenReporting') return true
		if (state === 'DesignatedReporting' && marketData.deepValue.hotLoadingMarketData.designatedReporter === maybeWriteClient.deepValue?.account.address) return true
		return false
	})

	const areOptionsDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)

	const maxStakeAmount = useComputed(() => {
		if (selectedOutcome.value === null) return undefined
		if (outcomeStakes.deepValue === undefined) return undefined
		if (forkValues.deepValue === undefined) return undefined
		const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
		if (outcomeStake === undefined) return undefined
		const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
		return maxStakeAmountForOutcome(outcomeStake, totalStake, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, forkValues.deepValue.disputeThresholdForDisputePacing, lastCompletedCrowdSourcer.deepValue)
	})

	const isDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)
	const report = async (outcomeStake: OutcomeStake, reportReason: string, amount: bigint) => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('market missing')
		const market = marketData.deepValue.marketAddress

		const totalRepStake = outcomeStakes.deepValue?.reduce((prev, current) => prev + current.repStake, 0n)
		if (totalRepStake === 0n) return await doInitialReport(writeClient, market, outcomeStake.payoutNumerators, reportReason, amount)
		if (outcomeStake.status === 'Winning') {
			return await contributeToMarketDisputeOnTentativeOutcome(
				writeClient,
				market,
				outcomeStake.payoutNumerators,
				amount,
				reportReason
			)
		}
		return await contributeToMarketDispute(
			writeClient,
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
		const endDate = bigintSecondsToDate(disputeWindowInfo.deepValue.endTime)
		return <div style = 'margin-top: 1rem'>
			<SomeTimeAgo priorTimestamp = { endDate } countBackwards = { true } diffToText = {
				(time: number) => {
					if (disputeWindowInfo.deepValue === undefined) return <></>
					if (time <= 0) return <>The market has resolved to "<b>{ winningOption.outcomeName }</b>".</>
					if (disputeWindowInfo.deepValue.isActive || !isSlowReporting.value) return <>Resolving To "<b>{ winningOption.outcomeName }</b>" if not disputed in { humanReadableDateDelta(time) } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.endTime) }).</>
					const timeUntilNext = humanReadableDateDeltaFromTo(new Date(), bigintSecondsToDate(disputeWindowInfo.deepValue.startTime))
					const nextWindowLength = humanReadableDateDeltaFromTo(bigintSecondsToDate(disputeWindowInfo.deepValue.startTime), bigintSecondsToDate(disputeWindowInfo.deepValue.endTime))
					return <>Resolving To "<b>{ winningOption.outcomeName }</b>" if not disputed in the next dispute round. Next round starts in { timeUntilNext } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.startTime) } and lasts { nextWindowLength }).</>
				}
			}/>
		</div>
	}

	const TotalRepStaked = () => {
		if (outcomeStakes.deepValue === undefined || forkValues.deepValue === undefined) return <></>
		return <div style = 'display: grid; margin-top: 1rem'>
			<span><b>Total Rep staked:</b>{ ' ' }{ bigintToDecimalString(outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n), 18n, 2) } REP</span>
			<span><b>Forking Augur after:</b>{ ' ' }{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForFork, 18n, 2) } REP is staked within one round</span>
		</div>
	}

	const setMaxStake = () => {
		if (maxStakeAmount.value === undefined) return
		amountInput.value = bigintToDecimalString(maxStakeAmount.value, 18n)
	}

	return (
		<div class = 'panel'>
			<div style = 'display: grid'>
				<span><b>Market Reporting ({ isInitialReporting.value ? 'Initial reporting' : (isSlowReporting.value ? 'Slow reporting' : 'Fast reporting') }):</b></span>
				{ isDisabled.value ? <span><b>The reporting is closed for this round. Please check again in the next round.</b></span> : <></>}
				<MarketReportingOptions outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } isSlowReporting = { isSlowReporting } forkValues = { forkValues } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } areOptionsDisabled = { areOptionsDisabled } canInitialReport = { canInitialReport }/>
				<TotalRepStaked/>
				<ResolvingTo/>
				<div style = 'margin-top: 1rem'>
					<label>
						Reason:{' '}
						<input
							type = 'text'
							value = { reason.value }
							disabled = { isDisabled.value }
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
					<div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content max-content', gap: '0.5rem' } }>
						Amount:{' '}
						<input
							type = 'text'
							placeholder = ''
							value = { amountInput.value }
							disabled = { isDisabled.value }
							onChange = { (event) => {
								const target = event.target as HTMLInputElement
								amountInput.value = target.value
							} }
						/>
						{ maxStakeAmount.value === undefined || isDisabled.value ? <></> : <>
							/ { bigintToDecimalString(maxStakeAmount.value, 18n, 2) } REP
							<button class = 'button is-primary' onClick = { setMaxStake }>Max</button>
							{ repBond.deepValue !== undefined && isInitialReporting.value ? `+ ${ bigintToDecimalString(repBond.deepValue,18n, 2) } (initial reporter bond)` : '' }
						</> }
					</div>
				</div>
				<div style = 'margin-top: 1rem'>
					<button class = 'button is-primary' disabled = { (isDisabled.value || maxStakeAmount.value === undefined || maxStakeAmount.value === 0n) && !isInitialReporting.value } onClick = { handleReport }>Report</button>
				</div>
			</div>
		</div>
	)
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
				return <span><b>{ round.type }{ 'Round ' }{ round.round }</b>{ ': ' }
					{ outcomeName }
					{ ' Stake: ' }{ bigintToDecimalString(round.stake, 18n, 2) }{ ' ' }REP
					{ ' Size: ' }{ bigintToDecimalString(round.size, 18n, 2) }{ ' ' }REP
				</span>
			})}
		</div>
	</div>
}

interface ReportingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
}

export const Reporting = ({ maybeReadClient, maybeWriteClient, universe, reputationTokenAddress }: ReportingProps) => {
	const marketAddressString = useSignal<string>('')
	const marketData = useOptionalSignal<MarketData>(undefined)
	const outcomeStakes = useOptionalSignal<readonly OutcomeStake[]>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const preemptiveDisputeCrowdsourcerAddress = useOptionalSignal<AccountAddress>(undefined)
	const preemptiveDisputeCrowdsourcerStake = useOptionalSignal<bigint>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const reportingHistory = useOptionalSignal<readonly ReportingHistoryElement[]>(undefined)
	const lastCompletedCrowdSourcer = useOptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>(undefined)
	const repBond = useOptionalSignal<EthereumQuantity>(undefined)

	const canFinalize = useComputed(() => {
		if (marketData.deepValue === undefined) return false
		const state = REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState]
		if (state === 'AwaitingFinalization') return true
		return false
	})

	const canMigrate = useComputed(() => {
		if (marketData.deepValue === undefined) return false
		const state = REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState]
		if (state === 'AwaitingForkMigration') return true
		return false
	})

	const getParsedExtraInfo = (extraInfo: string) => {
		try {
			return ExtraInfo.parse(JSON.parse(extraInfo))
		} catch(error) {
			return undefined
		}
	}

	const fetchMarketData = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) throw new Error('missing readClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		marketData.deepValue = undefined
		outcomeStakes.deepValue = undefined
		disputeWindowAddress.deepValue = undefined
		disputeWindowInfo.deepValue = undefined
		preemptiveDisputeCrowdsourcerAddress.deepValue = undefined
		preemptiveDisputeCrowdsourcerStake.deepValue = 0n
		forkValues.deepValue = undefined
		reportingHistory.deepValue = undefined
		lastCompletedCrowdSourcer.deepValue = undefined
		repBond.deepValue = undefined

		const marketAddress = EthereumAddress.safeParse(marketAddressString.value.trim())
		if (!marketAddress.success) throw new Error('market not defined')
		const parsedMarketAddressString = addressString(marketAddress.value)
		const newMarketData = await fetchHotLoadingMarketData(readClient, parsedMarketAddressString)
		lastCompletedCrowdSourcer.deepValue = await getLastCompletedCrowdSourcer(readClient, parsedMarketAddressString, newMarketData.disputeRound)
		const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
		marketData.deepValue = { marketAddress: parsedMarketAddressString, parsedExtraInfo, hotLoadingMarketData: newMarketData }
		const currentMarketData = marketData.deepValue
		if (MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Yes/No' || MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Categorical') {
			const allPayoutNumerators = getAllPayoutNumeratorCombinations(marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)
			const winningOption = await getWinningPayoutNumerators(readClient, parsedMarketAddressString)
			const winningIndex = winningOption === undefined ? -1 : allPayoutNumerators.findIndex((option) => areEqualArrays(option, winningOption))
			const stakes = await getStakesOnAllOutcomesOnYesNoMarketOrCategorical(readClient, parsedMarketAddressString, marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)
			const alreadyContributedToOutcomes = await getAlreadyContributedCrowdSourcerInfoOnAllOutcomesOnYesNoMarketOrCategorical(readClient, parsedMarketAddressString, marketData.deepValue.hotLoadingMarketData.numOutcomes, marketData.deepValue.hotLoadingMarketData.numTicks)
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
					alreadyContributedToOutcome: alreadyContributedToOutcomes[index]
				}
			})
		}
		disputeWindowAddress.deepValue = await getDisputeWindow(readClient, parsedMarketAddressString)
		if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
			disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue)
		}
		preemptiveDisputeCrowdsourcerAddress.deepValue = await getPreemptiveDisputeCrowdsourcer(readClient, parsedMarketAddressString)
		if (EthereumAddress.parse(preemptiveDisputeCrowdsourcerAddress.deepValue) !== 0n) {
			preemptiveDisputeCrowdsourcerStake.deepValue = await getStakeOfReportingParticipant(readClient, preemptiveDisputeCrowdsourcerAddress.deepValue)
		}

		repBond.deepValue = await getRepBond(readClient, parsedMarketAddressString)

		forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)
		const state = REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState]
		if (!(state === 'PreReporting' || state === 'OpenReporting' || state === 'DesignatedReporting')) {
			reportingHistory.deepValue = await getReportingHistory(readClient, parsedMarketAddressString, newMarketData.disputeRound)
		}
	}

	const finalizeMarketButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (marketData.deepValue === undefined) throw new Error('missing market data')
		await finalizeMarket(writeClient, marketData.deepValue.marketAddress)
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
			<Market marketData = { marketData } universe = { universe } repBond = { repBond }/>
			<ReportingHistory marketData = { marketData } reportingHistory = { reportingHistory }/>
			<DisplayStakes outcomeStakes = { outcomeStakes } marketData = { marketData } maybeWriteClient = { maybeWriteClient } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } disputeWindowInfo = { disputeWindowInfo } forkValues = { forkValues } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } repBond = { repBond }/>
			{ marketData.deepValue === undefined ? <> </> : <button class = 'button is-primary' onClick = { finalizeMarketButton } disabled = { !canFinalize.value }>Finalize Market</button> }
			<ForkMigration marketData = { marketData } maybeWriteClient = { maybeWriteClient } outcomeStakes = { outcomeStakes } canMigrate = { canMigrate }/>
		</div>
	</div>
}
