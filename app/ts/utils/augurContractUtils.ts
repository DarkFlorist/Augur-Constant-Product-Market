import 'viem/window'
import { AccountAddress, EthereumBytes32, EthereumQuantity } from '../types/types.js'
import { AUGUR_UNIVERSE_ABI } from '../ABI/UniverseAbi.js'
import { AUDIT_FUNDS_ADDRESS, AUGUR_CONTRACT, BUY_PARTICIPATION_TOKENS_CONTRACT, FILL_ORDER_CONTRACT, HOT_LOADING_ADDRESS, ORDERS_CONTRACT, REDEEM_STAKE_ADDRESS } from './constants.js'
import { AUGUR_ABI, AUGUR_ABI_GET_MAXIUM_MARKET_END_DATE } from '../ABI/AugurAbi.js'
import { HOT_LOADING_ABI } from '../ABI/HotLoading.js'
import { BUY_PARTICIPATION_TOKENS_ABI } from '../ABI/BuyParticipationTokensAbi.js'
import { MARKET_ABI } from '../ABI/MarketAbi.js'
import { bytes32String } from './ethereumUtils.js'
import { DISPUTE_WINDOW_ABI } from '../ABI/DisputeWindow.js'
import { REPORTING_PARTICIPANT_ABI } from '../ABI/ReportingParticipant.js'
import { REPUTATION_TOKEN_ABI } from '../ABI/ReputationToken.js'
import { REDEEM_STAKE_ABI } from '../ABI/RedeemStakeAbi.js'
import { AUDIT_FUNDS_ABI } from '../ABI/AuditFunds.js'
import { createReadClient, createWriteClient } from './ethereumWallet.js'
import { UNIVERSE_ABI } from '../ABI/Universe.js'
import { getAllPayoutNumeratorCombinations } from './augurUtils.js'
import { encodePacked, keccak256 } from 'viem'

export const createYesNoMarket = async (universe: AccountAddress, marketCreator: AccountAddress, endTime: bigint, feePerCashInAttoCash: bigint, affiliateValidator: AccountAddress, affiliateFeeDivisor: bigint, designatedReporterAddress: AccountAddress, extraInfo: string) => {
	const client = createWriteClient(marketCreator)
	const { request } = await client.simulateContract({
		account: marketCreator,
		address: universe,
		abi: AUGUR_UNIVERSE_ABI,
		functionName: 'createYesNoMarket',
		args: [endTime, feePerCashInAttoCash, affiliateValidator, affiliateFeeDivisor, designatedReporterAddress, extraInfo]
	})
	await client.writeContract(request)
}

export const fetchMarket = async (reader: AccountAddress, marketAddress: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.readContract({
		abi: AUGUR_ABI,
		functionName: 'getMarketCreationData',
		address: AUGUR_CONTRACT,
		args: [marketAddress]
	})
}

export const fetchHotLoadingMarketData = async (reader: AccountAddress, marketAddress: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getMarketData',
		address: HOT_LOADING_ADDRESS,
		args: [AUGUR_CONTRACT, marketAddress, FILL_ORDER_CONTRACT, ORDERS_CONTRACT]
	})
}

export const fetchHotLoadingCurrentDisputeWindowData = async (reader: AccountAddress, universe: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getCurrentDisputeWindowData',
		address: HOT_LOADING_ADDRESS,
		args: [AUGUR_CONTRACT, universe]
	})
}

export const fetchHotLoadingTotalValidityBonds = async (reader: AccountAddress, marketAddresses: readonly AccountAddress[]) => {
	const client = createWriteClient(reader)
	return await client.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getTotalValidityBonds',
		address: HOT_LOADING_ADDRESS,
		args: [marketAddresses]
	})
}

export const buyParticipationTokens = async (writer: AccountAddress, universe: AccountAddress, attotokens: EthereumQuantity) => {
	const client = createWriteClient(writer)
	return await client.writeContract({
		abi: BUY_PARTICIPATION_TOKENS_ABI,
		functionName: 'buyParticipationTokens',
		address: BUY_PARTICIPATION_TOKENS_CONTRACT,
		args: [universe, attotokens]
	})
}

export const doInitialReport = async (writer: AccountAddress, market: AccountAddress, payoutNumerators: EthereumQuantity[], description: string, additionalStake: EthereumQuantity) => {
	const client = createWriteClient(writer)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'doInitialReport',
		address: market,
		args: [payoutNumerators, description, additionalStake]
	})
}

export const finalizeMarket = async (writer: AccountAddress, market: AccountAddress) => {
	const client = createWriteClient(writer)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'finalize',
		address: market,
		args: []
	})
}

// see here: https://github.com/AugurProject/augur/blob/dev/packages/augur-core/src/contracts/Augur.sol#L243
export const derivePayoutDistributionHash = (payoutNumerators: bigint[], numTicks: bigint, numOutcomes: bigint): `0x${ string }` => {
	if (BigInt(payoutNumerators.length) !== numOutcomes) throw new Error('Malformed payout length')
	if (!(payoutNumerators[0] === 0n || payoutNumerators[0] === numTicks)) throw new Error('Invalid report must be fully paid to Invalid')
	const _sum = payoutNumerators.reduce((acc, val) => acc + val, 0n)
	if (_sum !== numTicks) throw new Error('Malformed payout sum')
	const encoded = encodePacked(['uint256[]'], [payoutNumerators])
	return keccak256(encoded)
}

export const getStakeInOutcome = async (reader: AccountAddress, market: AccountAddress, payoutDistributionHash: EthereumBytes32) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: MARKET_ABI,
		functionName: 'getStakeInOutcome',
		address: market,
		args: [bytes32String(payoutDistributionHash)]
	})
}

export const getStakesOnAllOutcomesOnYesNoMarketOrCategorical = async (reader: AccountAddress, market: AccountAddress, numOutcomes: bigint, numTicks: EthereumQuantity) => {
	const allPayoutNumeratorCombinations = getAllPayoutNumeratorCombinations(numOutcomes, numTicks)
	const payoutDistributionHashes = allPayoutNumeratorCombinations.map((payoutNumerators) => EthereumQuantity.parse(derivePayoutDistributionHash(payoutNumerators, numTicks, numOutcomes)))
	return await Promise.all(payoutDistributionHashes.map((payoutDistributionHash) => getStakeInOutcome(reader, market, payoutDistributionHash)))
}

export const contributeToMarketDispute = async (writer: AccountAddress, market: AccountAddress, payoutNumerators: EthereumQuantity[], amount: EthereumQuantity, reason: string) => {
	const client = createWriteClient(writer)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'contribute',
		address: market,
		args: [payoutNumerators, amount, reason]
	})
}

export const contributeToMarketDisputeOnTentativeOutcome = async (writer: AccountAddress, market: AccountAddress, payoutNumerators: EthereumQuantity[], amount: EthereumQuantity, reason: string) => {
	const client = createWriteClient(writer)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'contributeToTentative',
		address: market,
		args: [payoutNumerators, amount, reason]
	})
}

export const getDisputeWindow = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: MARKET_ABI,
		functionName: 'getDisputeWindow',
		address: market,
		args: []
	})
}

export const getDisputeWindowInfo = async (reader: AccountAddress, disputeWindow: AccountAddress) => {
	const client = createReadClient(reader)
	const startTime = await client.readContract({
		abi: DISPUTE_WINDOW_ABI,
		functionName: 'getStartTime',
		address: disputeWindow,
		args: []
	})
	const endTime = await client.readContract({
		abi: DISPUTE_WINDOW_ABI,
		functionName: 'getEndTime',
		address: disputeWindow,
		args: []
	})
	const isActive = await client.readContract({
		abi: DISPUTE_WINDOW_ABI,
		functionName: 'isActive',
		address: disputeWindow,
		args: []
	})
	return {
		startTime,
		endTime,
		isActive
	}
}

export const getWinningReportingParticipant = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: MARKET_ABI,
		functionName: 'getWinningReportingParticipant',
		address: market,
		args: []
	})
}

export const getPayoutNumeratorsForReportingParticipant = async (reader: AccountAddress, reportingParticipant: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getPayoutNumerators',
		address: reportingParticipant,
		args: []
	})
}

export const getWinningPayoutNumerators = async (reader: AccountAddress, market: AccountAddress) => {
	const participantAddress = await getWinningReportingParticipant(reader, market)
	if (EthereumQuantity.parse(participantAddress) === 0n) return undefined
	return await getPayoutNumeratorsForReportingParticipant(reader, participantAddress)
}

export const getPreemptiveDisputeCrowdsourcer = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: MARKET_ABI,
		functionName: 'preemptiveDisputeCrowdsourcer',
		address: market,
		args: []
	})
}

export const getStakeOfReportingParticipant = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getStake',
		address: market,
		args: []
	})
}

// false if we are in fast reporting
export const getDisputePacingOn = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: MARKET_ABI,
		functionName: 'getDisputePacingOn',
		address: market,
		args: []
	})
}

export const getReputationTotalTheoreticalSupply = async (reader: AccountAddress, reputationTokenAddress: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'getTotalTheoreticalSupply',
		address: reputationTokenAddress,
		args: []
	})
}

// https://github.com/AugurProject/augur/blob/bd13a797016b373834e9414096c6086f35aa628f/packages/augur-core/src/contracts/reporting/Universe.sol#L109
export const getForkValues = async (reader: AccountAddress, reputationTokenAddress: AccountAddress) => {
	const FORK_THRESHOLD_DIVISOR = 40n // 2.5% of the total REP supply being filled in a single dispute bond will trigger a fork
	const MAXIMUM_DISPUTE_ROUNDS = 20n // We ensure that after 20 rounds of disputes a fork will occur
	const MINIMUM_SLOW_ROUNDS = 8n // We ensure that at least 8 dispute rounds take DISPUTE_ROUND_DURATION_SECONDS+ seconds to complete until the next round begins

	const totalRepSupply = await getReputationTotalTheoreticalSupply(reader, reputationTokenAddress)
	const forkReputationGoal = totalRepSupply / 2n // 50% of REP migrating results in a victory in a fork
	const disputeThresholdForFork = totalRepSupply / FORK_THRESHOLD_DIVISOR // 2.5% of the total rep supply
	const initialReportMinValue = (disputeThresholdForFork / 3n) / (2n ** (MAXIMUM_DISPUTE_ROUNDS - 2n)) + 1n // This value will result in a maximum 20 round dispute sequence
	const disputeThresholdForDisputePacing = disputeThresholdForFork / (2n ** (MINIMUM_SLOW_ROUNDS + 1n)) // Disputes begin normal pacing once there are 8 rounds remaining in the fastest case to fork. The "last" round is the one that causes a fork and requires no time so the exponent here is 9 to provide for that many rounds actually occurring.

	return {
		forkReputationGoal,
		disputeThresholdForFork,
		initialReportMinValue,
		disputeThresholdForDisputePacing
	}
}

// a slow function that gets history of reporting rounds
export type ReportingHistoryElement = {
	round: bigint,
	participantAddress: AccountAddress,
	payoutNumerators: readonly bigint[],
	stake: bigint
}

export const getReportingHistory = async(reader: AccountAddress, market: AccountAddress, currentRound: bigint) => {
	const client = createReadClient(reader)

	// loop over all (intentionally sequential not to spam)
	const result: ReportingHistoryElement[] = []
	for (let round = 0n; round <= currentRound; round++) {
		const participantAddress = await client.readContract({
			abi: MARKET_ABI,
			functionName: 'participants',
			address: market,
			args: [round]
		})
		const payoutNumerators = await client.readContract({
			abi: REPORTING_PARTICIPANT_ABI,
			functionName: 'getPayoutNumerators',
			address: participantAddress,
			args: []
		})
		const stake = await client.readContract({
			abi: REPORTING_PARTICIPANT_ABI,
			functionName: 'getStake',
			address: participantAddress,
			args: []
		})
		result.push({
			round,
			participantAddress,
			payoutNumerators,
			stake
		})
	}
	return result
}

export const redeemStake = async (reader: AccountAddress, reportingParticipants: readonly AccountAddress[], disputeWindows: readonly AccountAddress[]) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: REDEEM_STAKE_ABI,
		functionName: 'redeemStake',
		address: REDEEM_STAKE_ADDRESS,
		args: [reportingParticipants, disputeWindows]
	})
}

export const getAvailableShareData = async (reader: AccountAddress, account: AccountAddress) => {
	const client = createReadClient(reader)
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, payout: bigint }[] = []
	do {
		const page = await client.readContract({
			abi: AUDIT_FUNDS_ABI,
			functionName: 'getAvailableShareData',
			address: AUDIT_FUNDS_ADDRESS,
			args: [account, offset, pageSize]
		})
		pages.push(...page[0])
		if (page[1]) break
		offset += pageSize
	} while(true)
	return pages.filter((data) => EthereumQuantity.parse(data.market) !== 0n)
}

export const getAvailableReports = async (reader: AccountAddress, account: AccountAddress) => {
	const client = createReadClient(reader)
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await client.readContract({
			abi: AUDIT_FUNDS_ABI,
			functionName: 'getAvailableReports',
			address: AUDIT_FUNDS_ADDRESS,
			args: [account, offset, pageSize]
		})
		pages.push(...page[0])
		if (page[1]) break
		offset += pageSize
	} while(true)
	return pages.filter((data) => EthereumQuantity.parse(data.market) !== 0n)
}

export const getAvailableDisputes = async (reader: AccountAddress, account: AccountAddress) => {
	const client = createReadClient(reader)
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await client.readContract({
			abi: AUDIT_FUNDS_ABI,
			functionName: 'getAvailableDisputes',
			address: AUDIT_FUNDS_ADDRESS,
			args: [account, offset, pageSize]
		})
		pages.push(...page[0])
		if (page[1]) break
		offset += pageSize
	} while(true)
	return pages.filter((data) => EthereumQuantity.parse(data.market) !== 0n)
}

export const migrateThroughOneFork = async (reader: AccountAddress, market: AccountAddress, initialReportPayoutNumerators: readonly EthereumQuantity[], initialReportReason: string) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'migrateThroughOneFork',
		address: market,
		args: [initialReportPayoutNumerators, initialReportReason]
	})
}

export const disavowCrowdsourcers = async (reader: AccountAddress, market: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: MARKET_ABI,
		functionName: 'disavowCrowdsourcers',
		address: market,
		args: []
	})
}

export const getUniverseForkingInformation = async (reader: AccountAddress, universe: AccountAddress) => {
	const client = createReadClient(reader)
	const isForking = await client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'isForking',
		address: universe,
		args: []
	})
	if (isForking === false) return { universe, isForking } as const
	const forkEndTimePromise = client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getForkEndTime',
		address: universe,
		args: []
	})
	const forkingMarketPromise = client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getForkingMarket',
		address: universe,
		args: []
	})
	const payoutNumeratorsPromise = client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getPayoutNumerators',
		address: universe,
		args: []
	})
	return {
		isForking,
		universe,
		forkEndTime: await forkEndTimePromise,
		forkingMarket: await forkingMarketPromise,
		payoutNumerators: await payoutNumeratorsPromise
	}
}

export const migrateReputationToChildUniverseByPayout = async (reader: AccountAddress, reputationTokenAddress: AccountAddress, payoutNumerators: readonly bigint[], attotokens: bigint) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'migrateOutByPayout',
		address: reputationTokenAddress,
		args: [payoutNumerators, attotokens]
	})
}

export const migrateFromRepV1toRepV2GenesisToken = async (reader: AccountAddress, genesisReputationV2TokenAddress: AccountAddress) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'migrateFromLegacyReputationToken',
		address: genesisReputationV2TokenAddress,
		args: []
	})
}

export const getReputationTokenForUniverse = async (reader: AccountAddress, universe: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getReputationToken',
		address: universe,
		args: []
	})
}

export const getMaximumMarketEndDate = async (reader: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: AUGUR_ABI_GET_MAXIUM_MARKET_END_DATE,
		functionName: 'getMaximumMarketEndDate',
		address: AUGUR_CONTRACT,
		args: []
	})
}

export const isKnownUniverse = async (reader: AccountAddress, universe: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: AUGUR_ABI,
		functionName: 'isKnownUniverse',
		address: AUGUR_CONTRACT,
		args: [universe]
	})
}

export const getParentUniverse = async (reader: AccountAddress, universe: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getParentUniverse',
		address: universe,
		args: []
	})
}

export const getChildUniverse = async (reader: AccountAddress, universe: AccountAddress, payoutNumerators: EthereumQuantity[], numTicks: bigint, numOutcomes: bigint) => {
	const PayoutDistributionHash = derivePayoutDistributionHash(payoutNumerators, numTicks, numOutcomes)
	const client = createReadClient(reader)
	return await client.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getChildUniverse',
		address: universe,
		args: [PayoutDistributionHash]
	})
}
