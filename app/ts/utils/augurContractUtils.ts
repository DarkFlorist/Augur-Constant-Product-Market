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
import { ReadClient, WriteClient } from './ethereumWallet.js'
import { UNIVERSE_ABI } from '../ABI/Universe.js'
import { getAllPayoutNumeratorCombinations } from './augurUtils.js'
import { encodePacked, keccak256 } from 'viem'

export const createYesNoMarket = async (universe: AccountAddress, writeClient: WriteClient, endTime: bigint, feePerCashInAttoCash: bigint, affiliateValidator: AccountAddress, affiliateFeeDivisor: bigint, designatedReporterAddress: AccountAddress, extraInfo: string) => {
	await writeClient.writeContract({
		address: universe,
		abi: AUGUR_UNIVERSE_ABI,
		functionName: 'createYesNoMarket',
		args: [endTime, feePerCashInAttoCash, affiliateValidator, affiliateFeeDivisor, designatedReporterAddress, extraInfo]
	})
}

export const fetchHotLoadingMarketData = async (readClient: ReadClient, marketAddress: AccountAddress) => {
	return await readClient.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getMarketData',
		address: HOT_LOADING_ADDRESS,
		args: [AUGUR_CONTRACT, marketAddress, FILL_ORDER_CONTRACT, ORDERS_CONTRACT]
	})
}

export const fetchHotLoadingCurrentDisputeWindowData = async (readClient: ReadClient, universe: AccountAddress) => {
	return await readClient.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getCurrentDisputeWindowData',
		address: HOT_LOADING_ADDRESS,
		args: [AUGUR_CONTRACT, universe]
	})
}

export const fetchHotLoadingTotalValidityBonds = async (readClient: ReadClient, marketAddresses: readonly AccountAddress[]) => {
	return await readClient.readContract({
		abi: HOT_LOADING_ABI,
		functionName: 'getTotalValidityBonds',
		address: HOT_LOADING_ADDRESS,
		args: [marketAddresses]
	})
}

export const buyParticipationTokens = async (writeClient: WriteClient, universe: AccountAddress, attotokens: EthereumQuantity) => {
	return await writeClient.writeContract({
		abi: BUY_PARTICIPATION_TOKENS_ABI,
		functionName: 'buyParticipationTokens',
		address: BUY_PARTICIPATION_TOKENS_CONTRACT,
		args: [universe, attotokens]
	})
}

export const doInitialReport = async (writeClient: WriteClient, market: AccountAddress, payoutNumerators: EthereumQuantity[], description: string, additionalStake: EthereumQuantity) => {
	return await writeClient.writeContract({
		abi: MARKET_ABI,
		functionName: 'doInitialReport',
		address: market,
		args: [payoutNumerators, description, additionalStake]
	})
}

export const finalizeMarket = async (writeClient: WriteClient, market: AccountAddress) => {
	return await writeClient.writeContract({
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

export const getStakeInOutcome = async (readClient: ReadClient, market: AccountAddress, payoutDistributionHash: EthereumBytes32) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getStakeInOutcome',
		address: market,
		args: [bytes32String(payoutDistributionHash)]
	})
}

export const getStakesOnAllOutcomesOnYesNoMarketOrCategorical = async (readClient: ReadClient, market: AccountAddress, numOutcomes: bigint, numTicks: EthereumQuantity) => {
	const allPayoutNumeratorCombinations = getAllPayoutNumeratorCombinations(numOutcomes, numTicks)
	const payoutDistributionHashes = allPayoutNumeratorCombinations.map((payoutNumerators) => EthereumQuantity.parse(derivePayoutDistributionHash(payoutNumerators, numTicks, numOutcomes)))
	return await Promise.all(payoutDistributionHashes.map((payoutDistributionHash) => getStakeInOutcome(readClient, market, payoutDistributionHash)))
}

export const contributeToMarketDispute = async (writeClient: WriteClient, market: AccountAddress, payoutNumerators: EthereumQuantity[], amount: EthereumQuantity, reason: string) => {
	return await writeClient.writeContract({
		abi: MARKET_ABI,
		functionName: 'contribute',
		address: market,
		args: [payoutNumerators, amount, reason]
	})
}

export const contributeToMarketDisputeOnTentativeOutcome = async (writeClient: WriteClient, market: AccountAddress, payoutNumerators: EthereumQuantity[], amount: EthereumQuantity, reason: string) => {
	return await writeClient.writeContract({
		abi: MARKET_ABI,
		functionName: 'contributeToTentative',
		address: market,
		args: [payoutNumerators, amount, reason]
	})
}

export const getDisputeWindow = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getDisputeWindow',
		address: market,
		args: []
	})
}

export const getDisputeWindowInfo = async (readClient: ReadClient, disputeWindow: AccountAddress) => {
	const startTime = await readClient.readContract({
		abi: DISPUTE_WINDOW_ABI,
		functionName: 'getStartTime',
		address: disputeWindow,
		args: []
	})
	const endTime = await readClient.readContract({
		abi: DISPUTE_WINDOW_ABI,
		functionName: 'getEndTime',
		address: disputeWindow,
		args: []
	})
	const isActive = await readClient.readContract({
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

export const getWinningReportingParticipant = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getWinningReportingParticipant',
		address: market,
		args: []
	})
}

export const getPayoutNumeratorsForReportingParticipant = async (readClient: ReadClient, reportingParticipant: AccountAddress) => {
	return await readClient.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getPayoutNumerators',
		address: reportingParticipant,
		args: []
	})
}

export const getWinningPayoutNumerators = async (readClient: ReadClient, market: AccountAddress) => {
	const participantAddress = await getWinningReportingParticipant(readClient, market)
	if (EthereumQuantity.parse(participantAddress) === 0n) return undefined
	return await getPayoutNumeratorsForReportingParticipant(readClient, participantAddress)
}

export const getPreemptiveDisputeCrowdsourcer = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'preemptiveDisputeCrowdsourcer',
		address: market,
		args: []
	})
}

export const getStakeOfReportingParticipant = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getStake',
		address: market,
		args: []
	})
}

// false if we are in fast reporting
export const getDisputePacingOn = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getDisputePacingOn',
		address: market,
		args: []
	})
}

export const getReputationTotalTheoreticalSupply = async (readClient: ReadClient, reputationTokenAddress: AccountAddress) => {
	return await readClient.readContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'getTotalTheoreticalSupply',
		address: reputationTokenAddress,
		args: []
	})
}

// https://github.com/AugurProject/augur/blob/bd13a797016b373834e9414096c6086f35aa628f/packages/augur-core/src/contracts/reporting/Universe.sol#L109
export const getForkValues = async (readClient: ReadClient, reputationTokenAddress: AccountAddress) => {
	const FORK_THRESHOLD_DIVISOR = 40n // 2.5% of the total REP supply being filled in a single dispute bond will trigger a fork
	const MAXIMUM_DISPUTE_ROUNDS = 20n // We ensure that after 20 rounds of disputes a fork will occur
	const MINIMUM_SLOW_ROUNDS = 8n // We ensure that at least 8 dispute rounds take DISPUTE_ROUND_DURATION_SECONDS+ seconds to complete until the next round begins

	const totalRepSupply = await getReputationTotalTheoreticalSupply(readClient, reputationTokenAddress)
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
	size: bigint
	type: 'Preemptive' | 'Completed'
}

export const getCrowdsourcerInfo = async (readClient: ReadClient, participantAddress: AccountAddress) => {
	const payoutNumerators = await readClient.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getPayoutNumerators',
		address: participantAddress,
		args: []
	})
	const stake = await readClient.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getStake',
		address: participantAddress,
		args: []
	})
	const size = await readClient.readContract({
		abi: REPORTING_PARTICIPANT_ABI,
		functionName: 'getSize',
		address: participantAddress,
		args: []
	})
	return {
		participantAddress,
		payoutNumerators,
		stake,
		size
	}
}

export const getReportingHistory = async(readClient: ReadClient, market: AccountAddress, currentRound: bigint) => {
	// loop over all (intentionally sequential not to spam)
	const result: ReportingHistoryElement[] = []

	for (let round = 0n; round <= currentRound; round++) {
		const participantAddress = await readClient.readContract({
			abi: MARKET_ABI,
			functionName: 'participants',
			address: market,
			args: [round]
		})
		result.push({
			round,
			type: 'Completed' as const,
			...await getCrowdsourcerInfo(readClient, participantAddress)
		})
	}
	const preemptiveDisputeCrowdsourcer = await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'preemptiveDisputeCrowdsourcer',
		address: market,
		args: []
	})
	if (BigInt(preemptiveDisputeCrowdsourcer) !== 0n) {
		result.push({
			round: currentRound + 2n,
			type: 'Preemptive' as const,
			...await getCrowdsourcerInfo(readClient, preemptiveDisputeCrowdsourcer)
		})
	}
	return result
}

export const getLastCompletedCrowdSourcer = async(readClient: ReadClient, market: AccountAddress, currentRound: bigint) => {
	const participantAddress = await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'participants',
		address: market,
		args: [currentRound]
	})
	if (BigInt(participantAddress) === 0n) return undefined
	return await getCrowdsourcerInfo(readClient, participantAddress)
}

export const getCrowdsourcerInfoByPayoutNumerator = async (readClient: ReadClient, market: AccountAddress, payoutDistributionHash: bigint) => {
	const crowdsourcer = await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getCrowdsourcer',
		address: market,
		args: [bytes32String(payoutDistributionHash)]
	})
	if (BigInt(crowdsourcer) === 0n) return undefined
	return await getCrowdsourcerInfo(readClient, crowdsourcer)
}

export const getAlreadyContributedCrowdSourcerInfoOnAllOutcomesOnYesNoMarketOrCategorical = async (readClient: ReadClient, market: AccountAddress, numOutcomes: bigint, numTicks: EthereumQuantity) => {
	const allPayoutNumeratorCombinations = getAllPayoutNumeratorCombinations(numOutcomes, numTicks)
	const payoutDistributionHashes = allPayoutNumeratorCombinations.map((payoutNumerators) => EthereumQuantity.parse(derivePayoutDistributionHash(payoutNumerators, numTicks, numOutcomes)))
	return await Promise.all(payoutDistributionHashes.map((payoutDistributionHash) => getCrowdsourcerInfoByPayoutNumerator(readClient, market, payoutDistributionHash)))
}

export const redeemStake = async (writeClient: WriteClient, reportingParticipants: readonly AccountAddress[], disputeWindows: readonly AccountAddress[]) => {
	return await writeClient.writeContract({
		abi: REDEEM_STAKE_ABI,
		functionName: 'redeemStake',
		address: REDEEM_STAKE_ADDRESS,
		args: [reportingParticipants, disputeWindows]
	})
}

export const getAvailableShareData = async (readClient: ReadClient, account: AccountAddress) => {
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, payout: bigint }[] = []
	do {
		const page = await readClient.readContract({
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

export const getAvailableReports = async (readClient: ReadClient, account: AccountAddress) => {
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await readClient.readContract({
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

export const getAvailableDisputes = async (readClient: ReadClient, account: AccountAddress) => {
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await readClient.readContract({
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

export const migrateThroughOneFork = async (writeClient: WriteClient, market: AccountAddress, initialReportPayoutNumerators: readonly EthereumQuantity[], initialReportReason: string) => {
	return await writeClient.writeContract({
		abi: MARKET_ABI,
		functionName: 'migrateThroughOneFork',
		address: market,
		args: [initialReportPayoutNumerators, initialReportReason]
	})
}

export const disavowCrowdsourcers = async (writeClient: WriteClient, market: AccountAddress) => {
	return await writeClient.writeContract({
		abi: MARKET_ABI,
		functionName: 'disavowCrowdsourcers',
		address: market,
		args: []
	})
}

export const getUniverseForkingInformation = async (readClient: ReadClient, universe: AccountAddress) => {
	const isForking = await readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'isForking',
		address: universe,
		args: []
	})
	if (isForking === false) return { universe, isForking } as const
	const forkEndTimePromise = readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getForkEndTime',
		address: universe,
		args: []
	})
	const forkingMarketPromise = readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getForkingMarket',
		address: universe,
		args: []
	})
	const payoutNumeratorsPromise = readClient.readContract({
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

export const migrateReputationToChildUniverseByPayout = async (writeClient: WriteClient, reputationTokenAddress: AccountAddress, payoutNumerators: readonly bigint[], attotokens: bigint) => {
	return await writeClient.writeContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'migrateOutByPayout',
		address: reputationTokenAddress,
		args: [payoutNumerators, attotokens]
	})
}

export const migrateFromRepV1toRepV2GenesisToken = async (writeClient: WriteClient, genesisReputationV2TokenAddress: AccountAddress) => {
	return await writeClient.writeContract({
		abi: REPUTATION_TOKEN_ABI,
		functionName: 'migrateFromLegacyReputationToken',
		address: genesisReputationV2TokenAddress,
		args: []
	})
}

export const getReputationTokenForUniverse = async (readClient: ReadClient, universe: AccountAddress) => {
	return await readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getReputationToken',
		address: universe,
		args: []
	})
}

export const getMaximumMarketEndDate = async (readClient: ReadClient) => {
	return await readClient.readContract({
		abi: AUGUR_ABI_GET_MAXIUM_MARKET_END_DATE,
		functionName: 'getMaximumMarketEndDate',
		address: AUGUR_CONTRACT,
		args: []
	})
}

export const isKnownUniverse = async (readClient: ReadClient, universe: AccountAddress) => {
	return await readClient.readContract({
		abi: AUGUR_ABI,
		functionName: 'isKnownUniverse',
		address: AUGUR_CONTRACT,
		args: [universe]
	})
}

export const getParentUniverse = async (readClient: ReadClient, universe: AccountAddress) => {
	return await readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getParentUniverse',
		address: universe,
		args: []
	})
}

export const getChildUniverse = async (readClient: ReadClient, universe: AccountAddress, payoutNumerators: EthereumQuantity[], numTicks: bigint, numOutcomes: bigint) => {
	const PayoutDistributionHash = derivePayoutDistributionHash(payoutNumerators, numTicks, numOutcomes)
	return await readClient.readContract({
		abi: UNIVERSE_ABI,
		functionName: 'getChildUniverse',
		address: universe,
		args: [PayoutDistributionHash]
	})
}

export const getRepBond = async (readClient: ReadClient, market: AccountAddress) => {
	return await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'repBond',
		address: market,
		args: []
	})
}
