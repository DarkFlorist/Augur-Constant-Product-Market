pragma solidity 0.8.29;

import { ITyped } from "./ITyped.sol";
import { IERC1155 } from "./IERC1155.sol";

interface IShareToken is ITyped, IERC1155 {
    function initialize(address _augur) external;
    function initializeMarket(address _market, uint256 _numOutcomes, uint256 _numTicks) external;
    function unsafeTransferFrom(address _from, address _to, uint256 _id, uint256 _value) external;
    function unsafeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _values) external;
    function claimTradingProceeds(address _market, address _shareHolder, bytes32 _fingerprint) external returns (uint256[] memory _outcomeFees);
    function getMarket(uint256 _tokenId) external view returns (address);
    function getOutcome(uint256 _tokenId) external view returns (uint256);
    function getTokenId(address _market, uint256 _outcome) external pure returns (uint256 _tokenId);
    function getTokenIds(address _market, uint256[] memory _outcomes) external pure returns (uint256[] memory _tokenIds);
    function buyCompleteSets(address _market, address _account, uint256 _amount) external returns (bool);
    function buyCompleteSetsForTrade(address _market, uint256 _amount, uint256 _longOutcome, address _longRecipient, address _shortRecipient) external returns (bool);
    function sellCompleteSets(address _market, address _holder, address _recipient, uint256 _amount, bytes32 _fingerprint) external returns (uint256 _creatorFee, uint256 _reportingFee);
    function sellCompleteSetsForTrade(address _market, uint256 _outcome, uint256 _amount, address _shortParticipant, address _longParticipant, address _shortRecipient, address _longRecipient, uint256 _price, address _sourceAccount, bytes32 _fingerprint) external returns (uint256 _creatorFee, uint256 _reportingFee);
    function totalSupplyForMarketOutcome(address _market, uint256 _outcome) external view returns (uint256);
    function balanceOfMarketOutcome(address _market, uint256 _outcome, address _account) external view returns (uint256);
    function lowestBalanceOfMarketOutcomes(address _market, uint256[] memory _outcomes, address _account) external view returns (uint256);
    function publicSellCompleteSets(address _market, uint256 _amount) external returns (uint256 _creatorFee, uint256 _reportingFee);
}