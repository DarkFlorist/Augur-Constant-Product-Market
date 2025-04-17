import { ExtraInfo } from '../CreateMarketUI/types/createMarketTypes.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { fetchHotLoadingMarketData } from '../utils/augurContractUtils.js'
import { MARKET_TYPES, REPORTING_STATES, YES_NO_OPTIONS } from '../utils/constants.js'
import { assertNever } from '../utils/errorHandling.js'
import { bigintToDecimalString, formatUnixTimestampISO } from '../utils/ethereumUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'

export type MarketData = {
	marketAddress: `0x${ string }`
	parsedExtraInfo: ExtraInfo | undefined
	hotLoadingMarketData: Awaited<ReturnType<typeof fetchHotLoadingMarketData>>
}

interface DisplayExtraInfoProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: DisplayExtraInfoProps) => {
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

interface MarketProps {
	marketData: OptionalSignal<MarketData>
	universe: OptionalSignal<AccountAddress>
	repBond: OptionalSignal<EthereumQuantity>
}

export const Market = ({ marketData, universe, repBond }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (repBond.deepValue === undefined) return <></>
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
		{ universe.deepValue !== undefined && BigInt(universe.deepValue) !== BigInt(marketData.deepValue.hotLoadingMarketData.universe) ? <>
			<div style = 'padding: 10px; background-color: red;'>
				<p> This Market is for an different universe than the selected one!</p>
			</div>
		</> : <></> }
		<div style = 'display: grid'>
			<span><b>Market Address:</b>{ marketData.deepValue.marketAddress }</span>
			<span><b>Market Creator:</b>{ marketData.deepValue.hotLoadingMarketData.marketCreator }</span>
			<span><b>Owner:</b>{ marketData.deepValue.hotLoadingMarketData.owner }</span>
			<span><b>Outcomes:</b>{ marketData.deepValue.hotLoadingMarketData.outcomes.join(', ') }</span>
			<span><b>Market Type:</b>{ MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType] }</span>
			<span><b>Designated Reporter:</b>{ marketData.deepValue.hotLoadingMarketData.designatedReporter }</span>
			<span><b>Reporting State:</b>{ REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState] }</span>
			<span><b>Dispute Round:</b>{ marketData.deepValue.hotLoadingMarketData.disputeRound }</span>
			<span><b>Winning Outcome:</b>{ formatWinningOption() }</span>
			<span><b>Open Interest:</b>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.openInterest, 18n, 2) } DAI</span>
			<span><b>Universe:</b>{ marketData.deepValue.hotLoadingMarketData.universe }</span>
			<span><b>Num Ticks:</b>{ marketData.deepValue.hotLoadingMarketData.numTicks }</span>
			<span><b>Fee:</b>{ marketData.deepValue.hotLoadingMarketData.feeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.feeDivisor)).toFixed(2) }%` }</span>
			<span><b>Affiliate Fee:</b>{ marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor)).toFixed(2) }%` }</span>
			<span><b>End Time:</b>{ formatUnixTimestampISO(marketData.deepValue.hotLoadingMarketData.endTime) }</span>
			<span><b>Num Outcomes:</b>{ marketData.deepValue.hotLoadingMarketData.numOutcomes }</span>
			<span><b>Validity Bond:</b>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.validityBond, 18n, 2) } DAI</span>
			<span><b>Reporting Fee:</b>{ marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor)).toFixed(2) }%` }</span>
			<span><b>Rep Bond:</b>{ bigintToDecimalString(repBond.deepValue, 18n, 2) } REP</span>
			<DisplayExtraInfo marketData = { marketData } />
		</div>
	</div>
}
