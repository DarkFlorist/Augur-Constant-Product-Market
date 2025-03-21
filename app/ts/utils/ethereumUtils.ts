export function hexToBytes(value: string) {
	const result = new Uint8Array((value.length - 2) / 2)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number.parseInt(value.slice(i * 2 + 2, i * 2 + 4), 16)
	}
	return result
}

export function dataString(data: Uint8Array | null) {
	if (data === null) return ''
	return Array.from(data).map(x => x.toString(16).padStart(2, '0')).join('')
}

export const addressString = (address: bigint): `0x${ string }` => `0x${ address.toString(16).padStart(40, '0') }`
export const bytes32String = (bytes32: bigint): `0x${ string }` => `0x${ bytes32.toString(16).padStart(64, '0') }`

export function dataStringWith0xStart(data: Uint8Array | null): `0x${ string }` {
	if (data === null) return '0x'
	return `0x${ dataString(data) }`
}

export function bigintToUint8Array(value: bigint, numberOfBytes: number) {
	if (typeof value === 'number') value = BigInt(value)
	if (value >= 2n ** BigInt(numberOfBytes * 8) || value < 0n) throw new Error(`Cannot fit ${ value } into a ${ numberOfBytes }-byte unsigned integer.`)
	const result = new Uint8Array(numberOfBytes)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number((value >> BigInt(numberOfBytes - i - 1) * 8n) & 0xffn)
	}
	return result
}

export function stringToUint8Array(data: string) {
	const dataLength = (data.length - 2) / 2
	if (dataLength === 0) return new Uint8Array()
	return bigintToUint8Array(BigInt(data), dataLength)
}
export function stripTrailingZeros(data: Uint8Array): Uint8Array {
	const end = data.length - 1
	let lastNonZero = end
	while (lastNonZero >= 0 && data[lastNonZero] === 0) {
		lastNonZero--
	}
	return data.slice(0, lastNonZero + 1)
}

export function isDecimalString(value: string): boolean {
	return /^\d*\.?\d*$/.test(value)
}

export function decimalStringToBigint(value: string, power: bigint): bigint {
	if (!(isDecimalString(value))) throw new Error(`Value is not a decimal sring.`)
	let [integerPart, fractionalPart] = value.split('.')
	// null assertion is safe because the first element of a string.split will always be present when you split by anything other than empty string
	integerPart = integerPart!.padStart(1, '0')
	fractionalPart = (fractionalPart || '').slice(0, Number(power)).padEnd(Number(power), '0')
	return BigInt(`${ integerPart }${ fractionalPart }`)
}

export function bigintToDecimalString(value: bigint, power: bigint): string {
	const integerPart = value / 10n**power
	const fractionalPart = value % 10n**power
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(Number(power), '0').replace(/0+$/, '')}`
	}
}

export function isSameAddress(address1: `0x${ string }` | undefined, address2: `0x${ string }` | undefined) {
	if (address1 === undefined && address2 === undefined) return true
	if (address1 === undefined || address2 === undefined) return false
	return address1.toLowerCase() === address2.toLowerCase()
}

export const formatUnixTimestampISO = (timestamp: bigint): string => {
	const date = new Date(Number(timestamp) * 1000)
	return date.toISOString()
}

export function areEqualArrays<T>(first: readonly T[], second: readonly T[]) {
	if (first === second) return true
	if (first.length !== second.length) return false
	return first.every((value, index) => value === second[index])
}
