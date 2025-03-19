import * as funtypes from 'funtypes'

export type ExtraInfo = funtypes.Static<typeof ExtraInfo>
export const ExtraInfo = funtypes.Intersect(
	funtypes.ReadonlyObject({
		description: funtypes.String,
	}).asReadonly(),
	funtypes.Partial({
		categories: funtypes.ReadonlyArray(funtypes.String),
		tags: funtypes.ReadonlyArray(funtypes.String),
		longDescription: funtypes.String,
		template: funtypes.Unknown
	})
)
