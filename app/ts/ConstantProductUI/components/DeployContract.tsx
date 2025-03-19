import { Signal } from '@preact/signals'
import { deployAugurConstantProductMarketContract } from '../../utils/utilities.js'
import { OptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress } from '../../types/types.js'

interface DeployProps {
	areContractsDeployed: Signal<boolean | undefined>
	maybeAccountAddress: OptionalSignal<AccountAddress>
}

export const DeployContract = ({ maybeAccountAddress, areContractsDeployed }: DeployProps) => {
	const deploy = async () => {
		const account = maybeAccountAddress.peek()
		if (account === undefined) throw new Error('missing maybeAccountAddress')
		await deployAugurConstantProductMarketContract(account.value)
		areContractsDeployed.value = true
	}
	if (areContractsDeployed.value !== false) return <></>
	return <>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'> Augur Constant Product Market contract is not deployed. </p>
		<button class = 'button is-primary' onClick = { deploy }> Deploy contract</button>
	</>
}
