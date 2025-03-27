pragma solidity 0.8.29;

import { IOwnable } from "./IOwnable.sol";
import { IShareToken } from "./IShareToken.sol";

interface IMarket is IOwnable {
    enum MarketType {
        YES_NO,
        CATEGORICAL,
        SCALAR
    }

    function initialize(address _augur, address _universe, uint256 _endTime, uint256 _feePerCashInAttoCash, address _affiliateValidator, uint256 _affiliateFeeDivisor, address _designatedReporterAddress, address _creator, uint256 _numOutcomes, uint256 _numTicks) external;
    function derivePayoutDistributionHash(uint256[] memory _payoutNumerators) external view returns (bytes32);
    function doInitialReport(uint256[] memory _payoutNumerators, string memory _description, uint256 _additionalStake) external returns (bool);
    function getUniverse() external view returns (address);
    function getDisputeWindow() external view returns (address);
    function getNumberOfOutcomes() external view returns (uint256);
    function getNumTicks() external view returns (uint256);
    function getMarketCreatorSettlementFeeDivisor() external view returns (uint256);
    function getForkingMarket() external view returns (IMarket _market);
    function getEndTime() external view returns (uint256);
    function getWinningPayoutDistributionHash() external view returns (bytes32);
    function getWinningPayoutNumerator(uint256 _outcome) external view returns (uint256);
    function getWinningReportingParticipant() external view returns (address);
    function getReputationToken() external view returns (address);
    function getFinalizationTime() external view returns (uint256);
    function getInitialReporter() external view returns (address);
    function getDesignatedReportingEndTime() external view returns (uint256);
    function getValidityBondAttoCash() external view returns (uint256);
    function affiliateFeeDivisor() external view returns (uint256);
    function getNumParticipants() external view returns (uint256);
    function getDisputePacingOn() external view returns (bool);
    function deriveMarketCreatorFeeAmount(uint256 _amount) external view returns (uint256);
    function recordMarketCreatorFees(uint256 _marketCreatorFees, address _sourceAccount, bytes32 _fingerprint) external returns (bool);
    function isContainerForReportingParticipant(address _reportingParticipant) external view returns (bool);
    function isFinalizedAsInvalid() external view returns (bool);
    function finalize() external returns (bool);
    function isFinalized() external view returns (bool);
    function getOpenInterest() external view returns (uint256);
    function shareToken() external view returns (IShareToken);
}