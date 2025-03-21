import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { buyParticipationTokens, contributeToMarketDispute, contributeToMarketDisputeOnTentativeOutcome, doInitialReport, fetchHotLoadingCurrentDisputeWindowData, fetchHotLoadingMarketData, fetchHotLoadingTotalValidityBonds, finalizeMarket, getAllPayoutNumeratorCombinations, getDisputeWindow, getDisputeWindowInfo, getStakesOnAllOutcomesOnYesNoMarketOrCategorical, getWinningPayoutNumerators } from '../../utils/utilities.js'
import { addressString, areEqualArrays, bigintToDecimalString, formatUnixTimestampISO, stringToUint8Array, stripTrailingZeros } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { assertNever } from '../../utils/errorHandling.js'
import { MARKET_TYPES, REPORTING_STATES, YES_NO_OPTIONS } from '../../utils/constants.js'
import { useSignal } from '@preact/signals'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'

type MarketData = {
	marketAddress: `0x${ string }`
	parsedExtraInfo: ExtraInfo | undefined
	hotLoadingMarketData: Awaited<ReturnType<typeof fetchHotLoadingMarketData>>
}

type DisputeWindowData = {
    disputeWindow: `0x${ string }`
    startTime: bigint
    endTime: bigint
    purchased: bigint
    fees: bigint
}

interface MarketProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.parsedExtraInfo === undefined) {
		return <>
			<span>Failed to parse Extra data, unparsed extra data:</span>
			<textarea
				style = 'height: fit-content; width: 100%'
				placeholder = 'This market resolves...'
				value = { marketData.deepValue.hotLoadingMarketData.extraInfo }
				readOnly = { true }
			/>
		</>
	}
	return <>
		<span><b>Description:</b>{ marketData.deepValue.parsedExtraInfo.description }</span>
		<span><b>Long Description:</b>{ marketData.deepValue.parsedExtraInfo.longDescription }</span>
		<span><b>Categories:</b>{ (marketData.deepValue.parsedExtraInfo.categories || []).join(', ') }</span>
		<span><b>Tags:</b>{ (marketData.deepValue.parsedExtraInfo.tags || []).join(', ') }</span>
	</>
}

export const Market = ({ marketData }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>

	const formatVolumes = () => {
		if (marketData.deepValue === undefined) return ''
		const marketType = MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType]
		const volumes = marketData.deepValue.hotLoadingMarketData.outcomeVolumes
		switch(marketType) {
			case 'Categorical':
			case 'Scalar': {
				return volumes.join(', ')
			}
			case 'Yes/No': {
				return <div style = 'display: grid'>
					{ YES_NO_OPTIONS.map((option, index) => (
						<span>{ option }: { volumes[index] === undefined ? 'undefined' : bigintToDecimalString(volumes[index], 18n) } DAI</span>
					)) }
				</div>
			}
			case undefined: throw new Error(`invalid marketType: ${ marketData.deepValue.hotLoadingMarketData.marketType }`)
			default: assertNever(marketType)
		}
	}
	const formatWinningOption = () => {
		if (marketData.deepValue === undefined) return ''
		const marketType = MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType]
		const payouts = marketData.deepValue.hotLoadingMarketData.winningPayout
		switch(marketType) {
			case 'Categorical':
			case 'Scalar': {
				return payouts.join(', ')
			}
			case 'Yes/No': {
				const winningIndex = payouts.findIndex((payout) => payout > 0)
				return YES_NO_OPTIONS[winningIndex]
			}
			case undefined: throw new Error(`invalid marketType: ${ marketData.deepValue.hotLoadingMarketData.marketType }`)
			default: assertNever(marketType)
		}
	}

	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Market Address:</b>{ marketData.deepValue.marketAddress }</span>
			<span><b>Market Creator:</b>{ marketData.deepValue.hotLoadingMarketData.marketCreator }</span>
			<span><b>Owner:</b>{ marketData.deepValue.hotLoadingMarketData.owner }</span>
			<span><b>Outcomes:</b>{ marketData.deepValue.hotLoadingMarketData.outcomes.join(', ') }</span>
			<span><b>Market Type:</b>{ MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType] }</span>
			<span><b>Display Prices:</b>{ marketData.deepValue.hotLoadingMarketData.displayPrices.join(', ') }</span>
			<span><b>Designated Reporter:</b>{ marketData.deepValue.hotLoadingMarketData.designatedReporter }</span>
			<span><b>Reporting State:</b>{ REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState] }</span>
			<span><b>Dispute Round:</b>{ marketData.deepValue.hotLoadingMarketData.disputeRound }</span>
			<span><b>Winning Outcome:</b>{ formatWinningOption() }</span>
			<span><b>Volume:</b>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.volume, 18n) } DAI</span>
			<span><b>Open Interest:</b>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.openInterest, 18n) } DAI</span>
			<span><b>Last Traded Prices:</b>{ marketData.deepValue.hotLoadingMarketData.lastTradedPrices.join(', ') }</span>
			<span><b>Universe:</b>{ marketData.deepValue.hotLoadingMarketData.universe }</span>
			<span><b>Num Ticks:</b>{ marketData.deepValue.hotLoadingMarketData.numTicks }</span>
			<span><b>Fee:</b>{ marketData.deepValue.hotLoadingMarketData.feeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.feeDivisor)).toFixed(2) }%` }</span>
			<span><b>Affiliate Fee:</b>{ marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor)).toFixed(2) }%` }</span>
			<span><b>End Time:</b>{ formatUnixTimestampISO(marketData.deepValue.hotLoadingMarketData.endTime) }</span>
			<span><b>Num Outcomes:</b>{ marketData.deepValue.hotLoadingMarketData.numOutcomes }</span>
			<span><b>Validity Bond:</b>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.validityBond, 18n) } REP</span>
			<span><b>Reporting Fee:</b>{ marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor)).toFixed(2) }%` }</span>
			<span><b>Outcome Volumes:</b>{ formatVolumes() }</span>
			<DisplayExtraInfo marketData = { marketData } />
		</div>
	</div>
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

type OutcomeStake = {
	outcomeName: string
	repStake: bigint
	status: 'Winning' | 'Losing'
	payoutNumerators: EthereumQuantity[]
}
interface DisplayStakesProps {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeAccountAddress: OptionalSignal<AccountAddress>
	marketData: OptionalSignal<MarketData>
}
export const DisplayStakes = ({ outcomeStakes, maybeAccountAddress, marketData }: DisplayStakesProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const report = async (outcomeStake: OutcomeStake) => {
		if (maybeAccountAddress.deepValue === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('market missing')
		const reason = 'I feel this is the right option!'
		const amount = 10n
		const market = marketData.deepValue.marketAddress
		if (outcomeStake.status === 'Winning') {
			return await contributeToMarketDisputeOnTentativeOutcome(maybeAccountAddress.deepValue, market, outcomeStake.payoutNumerators, amount, reason)
		}
		return await contributeToMarketDispute(maybeAccountAddress.deepValue, market, outcomeStake.payoutNumerators, amount, reason)
	}
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Market REP Stakes:</b></span>
			{ outcomeStakes.deepValue.map((outcomeStake) => (
				<span>{ outcomeStake.outcomeName } ({ outcomeStake.status }): { bigintToDecimalString(outcomeStake.repStake, 18n) } REP <button class = 'button is-primary' onClick = { () => report(outcomeStake) }>Report</button></span>
			)) }
		</div>
	</div>
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

interface ReportingProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
}

export const Reporting = ({ maybeAccountAddress }: ReportingProps) => {
	const marketAddressString = useSignal<string>('')
	const marketData = useOptionalSignal<MarketData>(undefined)
	const disputeWindowData = useOptionalSignal<DisputeWindowData>(undefined)
	const totalValidityBondsForAMarket = useOptionalSignal<bigint>(undefined)
	const outcomeStakes = useOptionalSignal<readonly OutcomeStake[]>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)

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
		marketData.deepValue = undefined
		disputeWindowData.deepValue = undefined
		totalValidityBondsForAMarket.deepValue = undefined
		outcomeStakes.deepValue = undefined
		disputeWindowAddress.deepValue = undefined
		disputeWindowInfo.deepValue = undefined

		const marketAddress = EthereumAddress.safeParse(marketAddressString.value.trim())
		if (!marketAddress.success) throw new Error('market not defined')
		const parsedMarketAddressString = addressString(marketAddress.value)
		const newMarketData = await fetchHotLoadingMarketData(account.value, parsedMarketAddressString)
		const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
		marketData.deepValue = { marketAddress: parsedMarketAddressString, parsedExtraInfo, hotLoadingMarketData: newMarketData }
		const currentMarketData = marketData.deepValue
		disputeWindowData.deepValue = await fetchHotLoadingCurrentDisputeWindowData(account.value)
		totalValidityBondsForAMarket.deepValue = await fetchHotLoadingTotalValidityBonds(account.value, [parsedMarketAddressString])
		if (MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Yes/No' || MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Categorical') {
			const allPayoutNumerators = getAllPayoutNumeratorCombinations(Number(marketData.deepValue.hotLoadingMarketData.numOutcomes), marketData.deepValue.hotLoadingMarketData.numTicks)
			const winningOption = await getWinningPayoutNumerators(account.value, parsedMarketAddressString)
			const winningIndex = winningOption === undefined ? -1 : allPayoutNumerators.findIndex((option) => areEqualArrays(option, winningOption))
			const stakes = await getStakesOnAllOutcomesOnYesNoMarketOrCategorical(account.value, parsedMarketAddressString, Number(marketData.deepValue.hotLoadingMarketData.numOutcomes), marketData.deepValue.hotLoadingMarketData.numTicks)
			outcomeStakes.deepValue = stakes.map((repStake, index) => {
				const getOutcomeName = (index: number) => {
					if (index === 0) return 'Invalid'
					if (MARKET_TYPES[currentMarketData.hotLoadingMarketData.marketType] === 'Yes/No') return YES_NO_OPTIONS[index]
					const outcomeName = currentMarketData.hotLoadingMarketData.outcomes[index - 1]
					if (outcomeName === undefined) return undefined
					return new TextDecoder().decode(stripTrailingZeros(stringToUint8Array(outcomeName)))
				}
				const outcomeName = getOutcomeName(index)
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
		console.log(disputeWindowAddress.deepValue)
		if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
			console.log('info')
			disputeWindowInfo.deepValue = await getDisputeWindowInfo(account.value, disputeWindowAddress.deepValue)
		}
	}

	const buyParticipationTokensButton = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		await buyParticipationTokens(account.value, 10n)
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
			<Market marketData = { marketData } />
			<DisputeWindow disputeWindowData = { disputeWindowData } />
			<ValidityBond totalValidityBondsForAMarket = { totalValidityBondsForAMarket }/>
			<button class = 'button is-primary' onClick = { buyParticipationTokensButton }>Buy 10 Particiption Tokens</button>
			<button class = 'button is-primary' onClick = { doInitialReportButton }>Do Initial Report On First Option</button>
			<DisplayStakes outcomeStakes = { outcomeStakes } marketData = { marketData } maybeAccountAddress = { maybeAccountAddress }/>
			<DisplayDisputeWindow disputeWindowAddress = { disputeWindowAddress } disputeWindowInfo = { disputeWindowInfo }/>
			<button class = 'button is-primary' onClick = { finalizeMarketButton }>Finalize Market</button>
		</div>
	</div>
}
