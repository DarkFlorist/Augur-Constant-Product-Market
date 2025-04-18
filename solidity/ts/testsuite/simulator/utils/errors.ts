import { JsonRpcErrorResponse } from '../types/jsonRpcTypes.js'
import { NEW_BLOCK_ABORT } from './constants.js'

class ErrorWithData extends Error {
	public constructor(message: string, public data: unknown) {
		super(message)
		Object.setPrototypeOf(this, ErrorWithData.prototype)
	}
}

export class ErrorWithDataAndCode extends ErrorWithData {
	public constructor(public code: number, message: string, public override data: unknown) {
		super(message, data)
		Object.setPrototypeOf(this, ErrorWithDataAndCode.prototype)
	}
}

export class JsonRpcResponseError extends ErrorWithDataAndCode {
	public readonly id: string | number
	public constructor(jsonRpcResponse: JsonRpcErrorResponse) {
		super(jsonRpcResponse.error.code, jsonRpcResponse.error.message, jsonRpcResponse.error.data)
		this.id = jsonRpcResponse.id
		Object.setPrototypeOf(this, JsonRpcResponseError.prototype)
	}
}

export function isFailedToFetchError(error: Error) {
	if (error.message.includes('Fetch request timed out.') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError when attempting to fetch resource')) return true
	return false
}

export const isNewBlockAbort = (error: Error) => error.message.includes(NEW_BLOCK_ABORT)

export function printError(error: unknown) {
	if (error instanceof Error) {
		try {
			if ('data' in error) return console.error(`Error: ${ error.message }\n${ JSON.stringify(error.data) }\n${ error.stack !== undefined ? error.stack : ''}`)
			return console.error(`Error: ${ error.message }\n${ error.stack || ''}`)
		} catch(stringifyError) {
			console.error(stringifyError)
		}
	}
	return console.error(error)
}
