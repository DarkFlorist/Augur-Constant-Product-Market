import { useSignal } from '@preact/signals'
import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress } from '../../types/types.js'
import { fetchMarket } from '../../utils/utilities.js'
import { addressString } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'

type MarketData = {
	marketAddress: `0x${ string }`
	extraInfo: string
	parsedExtraInfo: ExtraInfo | undefined
	marketCreator: `0x${ string }`
	outcomes: readonly `0x${ string }`[]
	displayPrices: readonly bigint[]
	marketType: number
	recommendedTradeInterval: bigint
}

interface MarketProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.parsedExtraInfo === undefined) {
		return <>
			<p> Failed to parse Extra data, unparsed extra data: </p>
			<textarea
				style = 'height: fit-content; width: 100%'
				placeholder = 'This market resolves...'
				value = { marketData.deepValue.extraInfo }
				readOnly = { true }
			/>
		</>
	}
	return <>
		<p> Description: { marketData.deepValue.parsedExtraInfo.description }</p>
		<p> Long Description: { marketData.deepValue.parsedExtraInfo.longDescription }</p>
		<p> Categories: { (marketData.deepValue.parsedExtraInfo.categories || []).join(', ') }</p>
		<p> Tags: { (marketData.deepValue.parsedExtraInfo.tags || []).join(', ') }</p>
	</>
}

export const Market = ({ marketData }: MarketProps) => {
	if (marketData.deepValue === undefined) return <></>
	return <div>
		<p> Market Address: { marketData.deepValue.marketAddress }</p>
		<p> Market Creator: { marketData.deepValue.marketCreator }</p>
		<p> Market Type: { marketData.deepValue.marketType }</p>
		<p> Recommended Trade Interval: { marketData.deepValue.recommendedTradeInterval }</p>
		<p> Display Prices: { marketData.deepValue.displayPrices.join(', ') }</p>
		<p> Outcomes: { marketData.deepValue.outcomes.join(', ') }</p>
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
		const newMarketData = await fetchMarket(account.value, parsedMarketAddressString)
		const parsedExtraInfo = getParsedExtraInfo(newMarketData.extraInfo)
		marketData.deepValue = { marketAddress: parsedMarketAddressString, parsedExtraInfo, ...newMarketData }
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
