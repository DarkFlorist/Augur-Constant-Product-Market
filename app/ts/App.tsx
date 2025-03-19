import { Signal, useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { AccountAddress } from './types/types.js'
import { OptionalSignal, useOptionalSignal } from './utils/OptionalSignal.js'
import { getAccounts, getChainId, requestAccounts, isAugurConstantProductMarketDeployed } from './utils/utilities.js'
import { DeployContract } from './ConstantProductUI/components/DeployContract.js'
import { CreateYesNoMarket } from './CreateMarketUI/components/CreateMarket.js'
import { ensureError } from './utils/errorHandling.js'

interface WalletComponentProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
	loadingAccount: Signal<boolean>
	isWindowEthereum: Signal<boolean>
}

const WalletComponent = ({ maybeAccountAddress, loadingAccount, isWindowEthereum }: WalletComponentProps) => {
	if (!isWindowEthereum.value) return <p class = 'paragraph'> An Ethereum enabled wallet is required to make immutable domains.</p>
	if (loadingAccount.value) return <></>
	const connect = async () => {
		maybeAccountAddress.deepValue = await requestAccounts()
	}
	return maybeAccountAddress.value !== undefined ? (
		<p style = 'color: gray; justify-self: right;'>{ `Connected with ${ maybeAccountAddress.value }` }</p>
	) : (
		<button class = 'button is-primary' style = 'justify-self: right;' onClick = { connect }>
			{ `Connect wallet` }
		</button>
	)
}
export function App() {
	const errorString = useOptionalSignal<string>(undefined)
	const loadingAccount = useSignal<boolean>(false)
	const isWindowEthereum = useSignal<boolean>(true)
	const areContractsDeployed = useSignal<boolean | undefined>(undefined)
	const maybeAccountAddress = useOptionalSignal<AccountAddress>(undefined)
	const chainId = useSignal<number | undefined>(undefined)
	const inputTimeoutRef = useRef<number | null>(null)

	const setError = (error: unknown) => {
		if (error === undefined) {
			errorString.value = undefined
			return
		}
		const ensured = ensureError(error)
		errorString.deepValue = ensured.message
	}

	const updateChainId = async () => {
		const account = maybeAccountAddress.deepPeek()
		if (account === undefined) return
		chainId.value = await getChainId(account)
	}

	useEffect(() => {
		if (window.ethereum === undefined) {
			isWindowEthereum.value = false
			return
		}
		isWindowEthereum.value = true
		window.ethereum.on('accountsChanged', function (accounts) { maybeAccountAddress.deepValue = accounts[0] })
		window.ethereum.on('chainChanged', async () => { updateChainId() })
		const fetchAccount = async () => {
			try {
				loadingAccount.value = true
				const fetchedAccount = await getAccounts()
				if (fetchedAccount) maybeAccountAddress.deepValue = fetchedAccount
				updateChainId()
			} catch(e) {
				setError(e)
			} finally {
				loadingAccount.value = false
				areContractsDeployed.value = await isAugurConstantProductMarketDeployed(maybeAccountAddress.deepValue)
			}
		}
		fetchAccount()
		return () => {
			if (inputTimeoutRef.current !== null) {
				clearTimeout(inputTimeoutRef.current)
			}
		}
	}, [])

	return <main style = 'overflow: auto;'>
		<div class = 'app'>
			<WalletComponent loadingAccount = { loadingAccount } isWindowEthereum = { isWindowEthereum } maybeAccountAddress = { maybeAccountAddress } />
			<div style = 'display: block'>
				<div class = 'augur-constant-product-market'>
					<img src = 'favicon.svg' alt = 'Icon' style ='width: 60px;'/> Augur Constant Product Market
				</div>
				<p class = 'sub-title'>Swap Augur tokens!</p>
			</div>
		</div>
		<DeployContract maybeAccountAddress = { maybeAccountAddress } areContractsDeployed = { areContractsDeployed } />
		<CreateYesNoMarket maybeAccountAddress = { maybeAccountAddress } />
		<div class = 'text-white/50 text-center'>
			<div class = 'mt-8'>
				Augur Constant Product Market by&nbsp;
				<a class = 'text-white hover:underline' href='https://dark.florist'>
					Dark Florist
				</a>
			</div>
			<div class = 'inline-grid'>
				<a class = 'text-white hover:underline' href='https://discord.gg/BeFnJA5Kjb'>
					Discord
				</a>
				<a class = 'text-white hover:underline' href='https://twitter.com/DarkFlorist'>
					Twitter
				</a>
				<a class = 'text-white hover:underline' href='https://github.com/DarkFlorist'>
					Github
				</a>
			</div>
		</div>
	</main>
}
