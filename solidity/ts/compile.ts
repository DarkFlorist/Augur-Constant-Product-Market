import { promises as fs } from 'fs'
import * as path from 'path'
import solc from 'solc'
import * as funtypes from 'funtypes'

const CompileError = funtypes.ReadonlyObject({
	severity: funtypes.String,
	formattedMessage: funtypes.String
})

type CompileResult = funtypes.Static<typeof CompileResult>
const CompileResult = funtypes.ReadonlyObject({
	errors: funtypes.Array(CompileError)
})

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
			'Context.sol': { content: await fs.readFile('contracts/Context.sol', 'utf8') },
			'draft-IERC6093.sol': { content: await fs.readFile('contracts/draft-IERC6093.sol', 'utf8') },
			'ERC20.sol': { content: await fs.readFile('contracts/ERC20.sol', 'utf8') },
			'IERC20.sol': { content: await fs.readFile('contracts/IERC20.sol', 'utf8') },
			'IERC20Metadata.sol': { content: await fs.readFile('contracts/IERC20Metadata.sol', 'utf8') },
			'IOwnable.sol': { content: await fs.readFile('contracts/IOwnable.sol', 'utf8') },
			'ITyped.sol': { content: await fs.readFile('contracts/ITyped.sol', 'utf8') },
			'IERC1155.sol': { content: await fs.readFile('contracts/IERC1155.sol', 'utf8') },
			'IShareToken.sol': { content: await fs.readFile('contracts/IShareToken.sol', 'utf8') },
			'IMarket.sol': { content: await fs.readFile('contracts/IMarket.sol', 'utf8') },
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
	var result = CompileResult.parse(JSON.parse(output))
	let errors = (result!.errors || []).filter((x: any) => (x.severity === "error")).map((x: any) => x.formattedMessage);
	if (errors.length) {
        let error = new Error("compilation error");
        (<any>error).errors = errors;
        throw error;
    }
	const artifactsDir = path.join(process.cwd(), 'artifacts')
	if (!await exists(artifactsDir)) await fs.mkdir(artifactsDir, { recursive: false })
	await fs.writeFile(path.join(artifactsDir, 'AugurConstantProductMarket.json'), output)
}

compileAugurConstantProductMarket().catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})
