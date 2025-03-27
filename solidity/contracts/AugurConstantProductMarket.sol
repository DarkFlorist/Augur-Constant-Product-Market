// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.29;

import { ERC20 } from "./ERC20.sol";
import { IERC20 } from "./IERC20.sol";
import { IShareToken } from "./IShareToken.sol";
import { IMarket } from "./IMarket.sol";

contract AugurConstantProduct is ERC20 {

	IERC20 public dai = ERC20(address(0x6B175474E89094C44Da98b954EedeAC495271d0F));
	IShareToken public shareToken;
	address public constant augurMarketAddress = address(0x5D1C6191E6c9D8DD2ea7A6CbB50265cD37BF01Ce);
	IMarket public constant augurMarket = IMarket(augurMarketAddress);
	address public constant augurAddress = address(0x23916a8F5C3846e3100e5f587FF14F3098722F5d);
	uint256 public numTicks;
	uint256 public INVALID;
	uint256 public NO;
	uint256 public YES;

	constructor() ERC20("Augur Constant Product DEV Market", "ACPM-DEV") {
		shareToken = augurMarket.shareToken();
		numTicks = augurMarket.getNumTicks();
		dai.approve(address(shareToken), 2**256-1);
		dai.approve(augurAddress, 2**256-1);
		INVALID = shareToken.getTokenId(augurMarketAddress, 0);
		NO = shareToken.getTokenId(augurMarketAddress, 1);
		YES = shareToken.getTokenId(augurMarketAddress, 2);
	}

	function addLiquidity(uint256 sharesToBuy) external {
		//TODO: gas golf this function a bit, though it doesn't really matter
		uint256 poolConstantBefore = sqrt(poolConstant());

		dai.transferFrom(msg.sender, address(this), sharesToBuy * numTicks);
		shareToken.buyCompleteSets(augurMarketAddress, address(this), sharesToBuy);

		if (poolConstantBefore == 0) {
			_mint(msg.sender, sqrt(poolConstant()));
		} else {
			_mint(msg.sender, totalSupply() * sqrt(poolConstant()) / poolConstantBefore - totalSupply());
		}
	}

	function removeLiquidity(uint256 poolTokensToSell) external {
		uint256 poolSupply = totalSupply();
		(uint256 poolInvalid, uint256 poolNo, uint256 poolYes) = shareBalances(address(this));

		_burn(msg.sender, poolTokensToSell);

		uint256 poolDai = dai.balanceOf(address(this));
		uint256 invalidShare = poolInvalid * poolTokensToSell / poolSupply;
		uint256 noShare = poolNo * poolTokensToSell / poolSupply;
		uint256 yesShare = poolYes * poolTokensToSell / poolSupply;
		
		// CONSIDER: selling complete sets incurs Augur fees, maybe we should let the user sell the sets themselves if they want to pay the fee?
		uint256 completeSetsToSell = invalidShare;
		completeSetsToSell = noShare < completeSetsToSell ? noShare : completeSetsToSell;
		completeSetsToSell = yesShare < completeSetsToSell ? yesShare : completeSetsToSell;
		shareToken.publicSellCompleteSets(augurMarketAddress, completeSetsToSell);
		uint256 poolDaiAfterSale = dai.balanceOf(address(this));
		uint256 daiFromCompleteSets = poolDaiAfterSale - poolDai;

		// Send shares
		uint256[] memory tokenIds = new uint256[](3);
		tokenIds[0] = INVALID;
		tokenIds[1] = NO;
		tokenIds[2] = YES;

		uint256[] memory tokenValues = new uint256[](3);
		tokenValues[0] = invalidShare - completeSetsToSell;
		tokenValues[1] = noShare - completeSetsToSell;
		tokenValues[2] = yesShare - completeSetsToSell;
		shareToken.unsafeBatchTransferFrom(address(this), msg.sender, tokenIds, tokenValues);

		// Send DAI
		uint256 daiShare = daiFromCompleteSets + poolDai * poolTokensToSell / poolSupply;
		dai.transfer(msg.sender, daiShare);
	}

	function enterPosition(uint256 amountInDai, bool buyYes) external {
		(uint256 poolInvalid, uint256 poolNo, uint256 poolYes) = shareBalances(address(this));
		uint256 setsToBuy = amountInDai / numTicks;

		// simulate the user buying complete sets directly from the exchange
		uint256 invalidToUser = setsToBuy;
		uint256 noToUser = setsToBuy;
		uint256 yesToUser = setsToBuy;

		require(poolInvalid > invalidToUser, "AugurCP: The pool doesn't have enough INVALID tokens to fulfill the request.");
		require(poolNo > noToUser, "AugurCP: The pool doesn't have enough NO tokens to fulfill the request.");
		require(poolYes > yesToUser, "AugurCP: The pool doesn't have enough YES tokens to fulfill the request.");

		poolInvalid = poolInvalid - invalidToUser;
		poolNo = poolNo - noToUser;
		poolYes = poolYes - yesToUser;

		// simulate user swapping YES to NO or NO to YES
		uint256 simulatedPoolConstant = poolYes * poolNo;
		if (buyYes) {
			yesToUser = yesToUser + poolYes - simulatedPoolConstant / (poolNo + noToUser);
			noToUser = 0;
		} else {
			noToUser = noToUser + poolNo - simulatedPoolConstant / (poolYes + yesToUser);
			yesToUser = 0;
		}

		// materialize the final result of the simulation
		dai.transferFrom(msg.sender, address(this), amountInDai);
		shareTransfer(address(this), msg.sender, invalidToUser, noToUser, yesToUser);
	}

	function exitPosition(uint256 daiToBuy) external {
		(uint256 userInvalid, uint256 userNo, uint256 userYes) = shareBalances(msg.sender);
		(uint256 poolNo, uint256 poolYes) = noYesShareBalances(address(this));
		uint256 setsToSell = daiToBuy / numTicks;

		// short circuit if user is closing out their own complete sets
		if (userInvalid >= setsToSell && userNo >= setsToSell && userYes >= setsToSell) {
			shareTransfer(msg.sender, address(this), setsToSell, setsToSell, setsToSell);
			shareToken.publicSellCompleteSets(augurMarketAddress, setsToSell);
			dai.transfer(msg.sender, daiToBuy);
			return;
		}

		require(userInvalid >= setsToSell, "AugurCP: You don't have enough invalid tokens to close out for this amount.");
		require(userNo > setsToSell || userYes > setsToSell, "AugurCP: You don't have enough YES or NO tokens to close out for this amount.");

		// simulate user swapping enough NO ➡ YES or YES ➡ NO to create setsToSell complete sets
		uint256 simulatedPoolConstant = poolYes * poolNo;
		uint256 invalidFromUser = setsToSell;
		uint256 noFromUser = 0;
		uint256 yesFromUser = 0;
		if (userYes > userNo) {
			uint256 noToUser = setsToSell - userNo;
			uint256 poolNoLessTouser = poolNo - noToUser;
			uint256 yesToPool = simulatedPoolConstant / poolNoLessTouser;
			if (yesToPool * poolNoLessTouser < simulatedPoolConstant) yesToPool += 1;
			yesToPool = yesToPool - poolYes;
			require(yesToPool <= userYes - setsToSell, "AugurCP: You don't have enough YES tokens to close out for this amount.");
			noFromUser = userNo;
			yesFromUser = yesToPool + setsToSell;
		} else {
			uint256 yesToUser = setsToSell - userYes;
			uint256 poolYesLessToUser = poolYes - yesToUser;
			uint256 noToPool = simulatedPoolConstant / poolYesLessToUser;
			if (noToPool * poolYesLessToUser < simulatedPoolConstant) noToPool += 1;
			noToPool = noToPool - poolNo;
			require(noToPool <= userNo - setsToSell, "AugurCP: You don't have enough NO tokens to close out for this amount.");
			yesFromUser = userYes;
			noFromUser = noToPool + setsToSell;
		}

		// materialize the complete set sale for dai
		shareTransfer(msg.sender, address(this), invalidFromUser, noFromUser, yesFromUser);
		shareToken.publicSellCompleteSets(augurMarketAddress, setsToSell);
		dai.transfer(msg.sender, daiToBuy);
	}

	function swap(uint256 inputShares, bool inputYes) external returns (uint256) {
		(uint256 poolNo, uint256 poolYes) = noYesShareBalances(address(this));
		uint256 currentPoolConstant = poolYes * poolNo;
		if (inputYes) {
			uint256 yesFromUser = inputShares;
			uint256 noToUser = poolNo - currentPoolConstant / (poolYes + yesFromUser);
			shareToken.unsafeTransferFrom(msg.sender, address(this), YES, yesFromUser);
			shareToken.unsafeTransferFrom(address(this), msg.sender, NO, noToUser);
			return noToUser;
		} else {
			uint256 noFromUser = inputShares;
			uint256 yesToUser = poolYes - currentPoolConstant / (poolNo + noFromUser);
			shareToken.unsafeTransferFrom(msg.sender, address(this), NO, noFromUser);
			shareToken.unsafeTransferFrom(address(this), msg.sender, YES, yesToUser);
			return yesToUser;
		}
	}

	function poolConstant() public view returns (uint256) {
		(uint256 poolNo, uint256 poolYes) = noYesShareBalances(address(this));
		return poolNo * poolYes;
	}

	function shareBalances(address owner) public view returns (uint256 invalid, uint256 no, uint256 yes) {
		uint256[] memory tokenIds = new uint256[](3);
		tokenIds[0] = INVALID;
		tokenIds[1] = NO;
		tokenIds[2] = YES;
		address[] memory owners = new address[](3);
		owners[0] = owner;
		owners[1] = owner;
		owners[2] = owner;
		uint256[] memory balances = shareToken.balanceOfBatch(owners, tokenIds);
		invalid = balances[0];
		no = balances[1];
		yes = balances[2];
		return (invalid, no, yes);
	}

	function noYesShareBalances(address owner) public view returns (uint256 no, uint256 yes) {
		uint256[] memory tokenIds = new uint256[](2);
		tokenIds[0] = NO;
		tokenIds[1] = YES;
		address[] memory owners = new address[](2);
		owners[0] = owner;
		owners[1] = owner;
		uint256[] memory balances = shareToken.balanceOfBatch(owners, tokenIds);
		no = balances[0];
		yes = balances[1];
		return (no, yes);
	}

	function shareTransfer(address from, address to, uint256 invalidAmount, uint256 noAmount, uint256 yesAmount) private {
		uint256 size = (invalidAmount != 0 ? 1 : 0) + (noAmount != 0 ? 1 : 0) + (yesAmount != 0 ? 1 : 0);
		uint256[] memory tokenIds = new uint256[](size);
		uint256[] memory amounts = new uint256[](size);
		if (size == 0) {
			return;
		} else if (size == 1) {
			tokenIds[0] = invalidAmount != 0 ? INVALID : noAmount != 0 ? NO : YES;
			amounts[0] = invalidAmount != 0 ? invalidAmount : noAmount != 0 ? noAmount : yesAmount;
		} else if (size == 2) {
			tokenIds[0] = invalidAmount != 0 ? INVALID : NO;
			tokenIds[1] = yesAmount != 0 ? YES : NO;
			amounts[0] = invalidAmount != 0 ? invalidAmount : noAmount;
			amounts[1] = yesAmount != 0 ? yesAmount : noAmount;
		} else {
			tokenIds[0] = INVALID;
			tokenIds[1] = NO;
			tokenIds[2] = YES;
			amounts[0] = invalidAmount;
			amounts[1] = noAmount;
			amounts[2] = yesAmount;
		}
		shareToken.unsafeBatchTransferFrom(from, to, tokenIds, amounts);
	}

	// babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
	function sqrt(uint y) private pure returns (uint z) {
		if (y > 3) {
			z = y;
			uint x = y / 2 + 1;
			while (x < z) {
				z = x;
				x = (y / x + x) / 2;
			}
		} else if (y != 0) {
			z = 1;
		}
	}
}
