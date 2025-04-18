export const REDEEM_STAKE_ABI = [
	{
		"constant": false,
		"inputs": [
			{
				"internalType": "contract IReportingParticipant[]",
				"name": "_reportingParticipants",
				"type": "address[]"
			},
			{
				"internalType": "contract IDisputeWindow[]",
				"name": "_disputeWindows",
				"type": "address[]"
			}
		],
		"name": "redeemStake",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const
