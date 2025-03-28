import { promises as fs } from 'fs'
import * as path from 'path'
import solc from 'solc'

async function exists(path: string) {
	try {
		await fs.stat(path)
		return true
	} catch {
		return false
	}
}

const compileAugurConstantProductMarket = async () => {
	const input = {
		language: 'Solidity',
		sources: {
			'AugurConstantProductMarket.sol': { content: await fs.readFile('contracts/AugurConstantProductMarket.sol', 'utf8') },
			'AugurMock.sol': { content: await fs.readFile('contracts/AugurMock.sol', 'utf8') },
			'Context.sol': { content: await fs.readFile('contracts/Context.sol', 'utf8') },
			'DaiMock.sol': { content: await fs.readFile('contracts/DaiMock.sol', 'utf8') },
			'draft-IERC6093.sol': { content: await fs.readFile('contracts/draft-IERC6093.sol', 'utf8') },
			'ERC20.sol': { content: await fs.readFile('contracts/ERC20.sol', 'utf8') },
			'IERC20.sol': { content: await fs.readFile('contracts/IERC20.sol', 'utf8') },
			'IERC20Metadata.sol': { content: await fs.readFile('contracts/IERC20Metadata.sol', 'utf8') },
		},
		settings: {
			viaIR: true,
			optimizer: {
				enabled: true,
				runs: 500,
				details: {
					inliner: true,
				}
			},
			outputSelection: {
				"*": {
					'*': [ 'evm.bytecode.object', 'evm.deployedBytecode.object', 'abi' ]
				}
			},
		},
	}
	var output = solc.compile(JSON.stringify(input))
	const artifactsDir = path.join(process.cwd(), 'artifacts')
	if (!await exists(artifactsDir)) await fs.mkdir(artifactsDir, { recursive: false })
	await fs.writeFile(path.join(artifactsDir, 'AugurConstantProductMarket.json'), output)
}

compileAugurConstantProductMarket().catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})
