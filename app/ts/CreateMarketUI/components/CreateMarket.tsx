import { useSignal } from '@preact/signals'
import { approveErc20Token, createYesNoMarket } from '../../utils/utilities.js'
import { OptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity, NonHexBigInt } from '../../types/types.js'
import { AUGUR_CONTRACT, DAI_TOKEN_ADDRESS, GENESIS_UNIVERSE, REPV2_TOKEN_ADDRESS } from '../../utils/constants.js'
import { addressString, decimalStringToBigint, isDecimalString } from '../../utils/ethereumUtils.js'

interface CreateYesNoMarketProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
}

const isValidDate = (dateStr: string): boolean => {
	const regex = /^\d{4}-\d{2}-\d{2}$/
	if (!regex.test(dateStr)) return false

	const date = new Date(dateStr)
	const [year, month, day] = dateStr.split('-').map(Number)

	return (
		date.getFullYear() === year &&
		date.getMonth() + 1 === month &&
		date.getDate() === day
	)
}

export const CreateYesNoMarket = ({ maybeAccountAddress }: CreateYesNoMarketProps) => {
	const endTime = useSignal<string>('')
	const marketCreatorFee = useSignal<string>('')
	const affiliateValidator = useSignal<string>('')
	const affiliateFeeDivisor = useSignal<string>('')
	const designatedReporterAddress = useSignal<string>('')
	const description = useSignal<string>('')
	const longDescription = useSignal<string>('')
	const categories = useSignal<string>('')
	const tags = useSignal<string>('')

	const createMarket = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		console.log(endTime.value)
		if (!isDecimalString(marketCreatorFee.value)) throw new Error('missing feePerCashInAttoCash')
		const parsedFeePerCashInAttoCash = decimalStringToBigint(marketCreatorFee.value, 16n) //16n instead of 18n as we are converting from percentage
		const parsedAffiliateValidator = EthereumAddress.safeParse(affiliateValidator.value)
		const parsedAffiliateFeeDivisor = NonHexBigInt.safeParse(affiliateFeeDivisor.value)
		const parsedDesignatedReporterAddress = EthereumQuantity.safeParse(designatedReporterAddress.value)
		if (!isValidDate(endTime.value)) throw new Error('missing endTime')
		const marketEndTimeUnixTimeStamp = BigInt(Math.floor(new Date(endTime.value).getTime() / 1000))
		if (!parsedAffiliateValidator.success) throw new Error('missing affiliateValidator')
		if (!parsedAffiliateFeeDivisor.success) throw new Error('missing affiliateFeeDivisor')
		if (!parsedDesignatedReporterAddress.success) throw new Error('missing designatedReporterAddress')
		if (description.value.length === 0) throw new Error('missing description')
		const extraInfoString = JSON.stringify({
			description: description.value,
			longDescription: longDescription.value,
			categories: categories.value.split(',').map((category) => category.trim()).filter((category) => category.length > 0),
			tags: categories.value.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0)
		})
		await createYesNoMarket(account.value, marketEndTimeUnixTimeStamp, parsedFeePerCashInAttoCash, addressString(parsedAffiliateValidator.value), parsedAffiliateFeeDivisor.value, addressString(parsedDesignatedReporterAddress.value), extraInfoString)
	}

	const approveRep = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		return await approveErc20Token(account.value, REPV2_TOKEN_ADDRESS, GENESIS_UNIVERSE, 10000n * 10n ** 18n)
	}

	const approveDai = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		return await approveErc20Token(account.value, DAI_TOKEN_ADDRESS, AUGUR_CONTRACT, 10000n * 10n ** 18n)
	}

	function handleEndTimeInput(value: string) {
		endTime.value = value
	}
	function handleMarketCreatorFee(value: string) {
		marketCreatorFee.value = value
	}
	function handleAffiliateValidator(value: string) {
		affiliateValidator.value = value
	}
	function handleAffiliateFeeDivisor(value: string) {
		affiliateFeeDivisor.value = value
	}
	function handleDesignatedReporterAddress(value: string) {
		designatedReporterAddress.value = value
	}
	function handleDescription(value: string) {
		description.value = value
	}
	function handleLongDescription(value: string) {
		longDescription.value = value
	}
	function handleTags(value: string) {
		tags.value = value
	}
	function handleCategories(value: string) {
		categories.value = value
	}

	return <>
		<p style = 'margin: 0;'> Create Market: </p>
		<div style = 'display: grid; width: 100%; gap: 10px;'>
			<p style = 'margin: 0;'> End Time (UTC): </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'date'
				width = '100%'
				placeholder = '01/01/2024'
				value = { endTime.value }
				onInput = { e => handleEndTimeInput(e.currentTarget.value) }
			/>
			<p style = 'margin: 0;'> Market Creator Fee(%): </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '1'
				value = { marketCreatorFee.value }
				onInput = { e => handleMarketCreatorFee(e.currentTarget.value) }
			/>
			<p style = 'margin: 0;'> Affiliate Validator Address: </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '0x...'
				value = { affiliateValidator.value }
				onInput = { e => handleAffiliateValidator(e.currentTarget.value) }
			/>
			<p style = 'margin: 0;'> Affiliate Fee Divisor: </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '2'
				value = { affiliateFeeDivisor.value }
				onInput = { e => handleAffiliateFeeDivisor(e.currentTarget.value) }
			/>
			<p style = 'margin: 0;'> Designated Reporter Address: </p>
			<input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = '0x...'
				value = { designatedReporterAddress.value }
				onInput = { e => handleDesignatedReporterAddress(e.currentTarget.value) }
			/>
			<div>
				<p style = 'margin: 0;'> Description: </p>
				<input
					style = 'height: fit-content; width: 100%'
					class = 'input'
					type = 'text'
					placeholder = 'How many goats...'
					value = { description.value }
					onInput = { e => handleDescription(e.currentTarget.value) }
				/>
				<p style = 'margin: 0;'> Long description: </p>
				<textarea
					style = 'height: fit-content; width: 100%'
					placeholder = 'This market resolves...'
					value = { longDescription.value }
					onInput = { e => handleLongDescription(e.currentTarget.value) }
				/>
				<p style = 'margin: 0;'> Categories (comma separated): </p>
				<input
					style = 'height: fit-content; width: 100%'
					class = 'input'
					type = 'text'
					placeholder = 'cryptocurrency, goats...'
					value = { categories.value }
					onInput = { e => handleCategories(e.currentTarget.value) }
				/>
				<p style = 'margin: 0;'> Tags (comma separated): </p>
				<input
					style = 'height: fit-content; width: 100%'
					class = 'input'
					type = 'text'
					placeholder = 'cryptocurrency, goats...'
					value = { tags.value }
					onInput = { e => handleTags(e.currentTarget.value) }
				/>
			</div>
			<button class = 'button is-primary' onClick = { createMarket }> Create Market </button>
			<button class = 'button is-primary' onClick = { approveRep }> Approve REP </button>
			<button class = 'button is-primary' onClick = { approveDai }> Approve DAI </button>
		</div>
	</>
}
