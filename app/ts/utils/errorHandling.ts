import { hexToBytes } from './ethereumUtils.js'

export function jsonStringify(value: unknown, space?: string | number | undefined): string {
	return JSON.stringify(value, (_, value) => {
		if (typeof value === 'bigint') return `0x${ value.toString(16) }n`
		if (value instanceof Uint8Array) return `b'${ Array.from(value).map(x => x.toString(16).padStart(2, '0')).join('') }'`
		// cast works around https://github.com/uhyo/better-typescript-lib/issues/36
		return value as JSONValueF<unknown>
	}, space)
}

export function jsonParse(text: string): unknown {
	return JSON.parse(text, (_key: string, value: unknown) => {
		if (typeof value !== 'string') return value
		if (/^0x[a-fA-F0-9]+n$/.test(value)) return BigInt(value.slice(0, -1))
		const bytesMatch = /^b'(:<hex>[a-fA-F0-9])+'$/.exec(value)
		if (bytesMatch && 'groups' in bytesMatch && bytesMatch.groups && 'hex' in bytesMatch.groups && bytesMatch.groups['hex'].length % 2 === 0) return hexToBytes(`0x${ bytesMatch.groups['hex'] }`)
		return value
	})
}

export function ensureError(caught: unknown) {
	return (caught instanceof Error) ? caught
		: typeof caught === 'string' ? new Error(caught)
		: typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string' ? new Error(caught.message)
		: new Error(`Unknown error occurred.\n${ jsonStringify(caught) }`)
}

export function assertNever(value: never): never {
	throw new Error(`Unhandled discriminated union member: ${ JSON.stringify(value) }`)
}

