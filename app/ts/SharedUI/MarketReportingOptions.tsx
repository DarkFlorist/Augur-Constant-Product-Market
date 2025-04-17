import { Signal, useComputed } from '@preact/signals'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { getForkValues, getLastCompletedCrowdSourcer } from '../utils/augurContractUtils.js'
import { maxStakeAmountForOutcome, requiredStake } from '../utils/augurUtils.js'

export type OutcomeStake = {
	outcomeName: string
	repStake: bigint
	status: 'Winning' | 'Losing'
	payoutNumerators: EthereumQuantity[]
	alreadyContributedToOutcome: undefined | {
		participantAddress: AccountAddress
		payoutNumerators: readonly bigint[]
		stake: bigint
		size: bigint
	}
}

type MarketReportingOptionsProps = {
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	isSlowReporting: Signal<boolean>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
	areOptionsDisabled: Signal<boolean>
	canInitialReport: Signal<boolean>
}

export const MarketReportingOptions = ({ outcomeStakes, selectedOutcome, preemptiveDisputeCrowdsourcerStake, isSlowReporting, forkValues, lastCompletedCrowdSourcer, areOptionsDisabled, canInitialReport }: MarketReportingOptionsProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))

	const maxStakeAmountForEachOption = useComputed(() => {
		if (selectedOutcome.value === null) return []
		if (outcomeStakes.deepValue === undefined) return []
		if (forkValues.deepValue === undefined) return []
		const disputeThresholdForDisputePacing = forkValues.deepValue.disputeThresholdForDisputePacing
		return outcomeStakes.deepValue.map((outcomeStake) => maxStakeAmountForOutcome(outcomeStake, totalStake.value, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, disputeThresholdForDisputePacing, lastCompletedCrowdSourcer.deepValue))
	})

	if (totalStake.value === 0n) { // initial reporting
		return <div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content', gap: '0.5rem', alignItems: 'center' } }> {
			outcomeStakes.deepValue.map((outcomeStake, index) => <>
				<input
					disabled = { !canInitialReport.value && (areOptionsDisabled || maxStakeAmountForEachOption.value[index] === 0n) }
					type = 'radio'
					name = 'selectedOutcome'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
			<span>{ outcomeStake.outcomeName }</span>
			<span>
				{ outcomeStake.alreadyContributedToOutcome === undefined ? <></> : <>
				(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcome.stake, 18n, 2) } REP / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP)
				</> }
			</span>
			</>)
		} </div>
	}
	return <div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content max-content', gap: '0.5rem', alignItems: 'center' } }> {
		outcomeStakes.deepValue.map((outcomeStake, index) => <>
			<input
				disabled = { !canInitialReport.value && (areOptionsDisabled || maxStakeAmountForEachOption.value[index] === 0n) }
				type = 'radio'
				name = 'selectedOutcome'
				checked = { selectedOutcome.value === outcomeStake.outcomeName }
				onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
			/>
			<span>{ outcomeStake.outcomeName } ({ outcomeStake.status })</span>
			<span>{ bigintToDecimalString(outcomeStake.repStake, 18n, 2) } REP</span>
			<span>
				{ outcomeStake.status === 'Winning'
					? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } REP`
					: `Required for Dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP`
				}
			</span>
			<span>
				{ outcomeStake.alreadyContributedToOutcome === undefined ? <></> : <>
				(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcome.stake, 18n, 2) } REP / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP)
				</> }
			</span>
		</>)
	} </div>
}

export type MarketOutcomeOption = {
	outcomeName: string
	payoutNumerators: EthereumQuantity[]
}

type MarketReportingWithoutStakeProps = {
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeOption[]>
}

export const MarketReportingWithoutStake = ({ outcomeStakes, selectedOutcome }: MarketReportingWithoutStakeProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	return outcomeStakes.deepValue.map((outcomeStake) => (
		<span key = { outcomeStake.outcomeName }>
			<label>
				<input
					type = 'radio'
					name = 'selectedOutcome'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
				{' '}
				{ outcomeStake.outcomeName }
			</label>
		</span>
	))
}
