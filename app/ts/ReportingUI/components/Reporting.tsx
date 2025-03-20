import { useSignal } from '@preact/signals'
import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress } from '../../types/types.js'
import { fetchHotLoadingMarketData } from '../../utils/utilities.js'
import { addressString, bigintToRoundedPrettyDecimalString, formatUnixTimestampISO } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { assertNever } from '../../utils/errorHandling.js'
import { MARKET_TYPES, REPORTING_STATES, YES_NO_OPTIONS } from '../../utils/constants.js'

type MarketData = {
	marketAddress: `0x${ string }`
	parsedExtraInfo: ExtraInfo | undefined
	hotLoadingMarketData: Awaited<ReturnType<typeof fetchHotLoadingMarketData>>
}

interface MarketProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.parsedExtraInfo === undefined) {
		return <>
			<span> Failed to parse Extra data, unparsed extra data: </span>
			<textarea
				style = 'height: fit-content; width: 100%'
				placeholder = 'This market resolves...'
				value = { marketData.deepValue.hotLoadingMarketData.extraInfo }
				readOnly = { true }
			/>
		</>
	}
	return <>
		<span><b>Description:</b> { marketData.deepValue.parsedExtraInfo.description }</span>
		<span><b>Long Description:</b> { marketData.deepValue.parsedExtraInfo.longDescription }</span>
		<span><b>Categories:</b> { (marketData.deepValue.parsedExtraInfo.categories || []).join(', ') }</span>
		<span><b>Tags:</b> { (marketData.deepValue.parsedExtraInfo.tags || []).join(', ') }</span>
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
						<span>{ option }: { volumes[index] === undefined ? 'undefined' : bigintToRoundedPrettyDecimalString(volumes[index], 18n, 4) } DAI</span>
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

	return <div style = 'display: grid'>
		<span> <b>Market Address:</b> { marketData.deepValue.marketAddress }</span>
		<span> <b>Market Creator:</b> { marketData.deepValue.hotLoadingMarketData.marketCreator }</span>
		<span> <b>Owner:</b> { marketData.deepValue.hotLoadingMarketData.owner }</span>
		<span> <b>Outcomes:</b> { marketData.deepValue.hotLoadingMarketData.outcomes.join(', ') }</span>
		<span> <b>Market Type:</b> { MARKET_TYPES[marketData.deepValue.hotLoadingMarketData.marketType] }</span>
		<span> <b>Display Prices:</b> { marketData.deepValue.hotLoadingMarketData.displayPrices.join(', ') }</span>
		<span> <b>Designated Reporter:</b> { marketData.deepValue.hotLoadingMarketData.designatedReporter }</span>
		<span> <b>Reporting State:</b> { REPORTING_STATES[marketData.deepValue.hotLoadingMarketData.reportingState] }</span>
		<span> <b>Dispute Round:</b> { marketData.deepValue.hotLoadingMarketData.disputeRound }</span>
		<span> <b>Winning Outcome:</b> { formatWinningOption() }</span>
		<span> <b>Volume:</b> { bigintToRoundedPrettyDecimalString(marketData.deepValue.hotLoadingMarketData.volume, 18n, 4) } DAI</span>
		<span> <b>Open Interest:</b> { bigintToRoundedPrettyDecimalString(marketData.deepValue.hotLoadingMarketData.openInterest, 18n, 4) } DAI</span>
		<span> <b>Last Traded Prices:</b> { marketData.deepValue.hotLoadingMarketData.lastTradedPrices.join(', ') }</span>
		<span> <b>Universe:</b> { marketData.deepValue.hotLoadingMarketData.universe }</span>
		<span> <b>Num Ticks:</b> { marketData.deepValue.hotLoadingMarketData.numTicks }</span>
		<span> <b>Fee:</b> { marketData.deepValue.hotLoadingMarketData.feeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.feeDivisor)).toFixed(2) }%` }</span>
		<span> <b>Affiliate Fee:</b> { marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor)).toFixed(2) }%` }</span>
		<span> <b>End Time:</b> { formatUnixTimestampISO(marketData.deepValue.hotLoadingMarketData.endTime) }</span>
		<span> <b>Num Outcomes:</b> { marketData.deepValue.hotLoadingMarketData.numOutcomes }</span>
		<span> <b>Validity Bond:</b> { bigintToRoundedPrettyDecimalString(marketData.deepValue.hotLoadingMarketData.validityBond, 18n, 4) } REP</span>
		<span> <b>Reporting Fee:</b> { marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor === 0n ? "0.00%" : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor)).toFixed(2) }%` }</span>
		<span> <b>Outcome Volumes:</b> { formatVolumes() }</span>
		<DisplayExtraInfo marketData = { marketData } />
	</div>
}

interface ReportingProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
}

export const Reporting = ({ maybeAccountAddress }: ReportingProps) => {
	const marketAddressString = useSignal<string>('')
	const marketData = useOptionalSignal<MarketData>(undefined)

	const getParsedExtraInfo = (extraInfo: string) => {
		try {
			return ExtraInfo.parse(JSON.parse(extraInfo))
		} catch(error) {
			return undefined
		}
	}

	const fetchMarketData = async () => {
		const account = maybeAccountAddress.peek()
		marketData.deepValue = undefined
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		const marketAddress = EthereumAddress.safeParse(marketAddressString.value.trim())
		if (!marketAddress.success) throw new Error('market not defined')
		const parsedMarketAddressString = addressString(marketAddress.value)
		const newMarketData = await fetchHotLoadingMarketData(account.value, parsedMarketAddressString)
		const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
		marketData.deepValue = { marketAddress: parsedMarketAddressString, parsedExtraInfo, hotLoadingMarketData: newMarketData }
	}

	function handleMarketAddress(value: string) {
		marketAddressString.value = value
	}

	return <div class = 'subApplication'>
		<p style = 'margin: 0;'> Reporting: </p>
		<div style = 'display: grid; width: 100%; gap: 10px;'>
			<p style = 'margin: 0;'> Market address: </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '0x...'
				value = { marketAddressString.value }
				onInput = { e => handleMarketAddress(e.currentTarget.value) }
			/>

			<button class = 'button is-primary' onClick = { fetchMarketData }> Fetch Market Information</button>
			<Market marketData = { marketData } />
		</div>
	</div>
}
