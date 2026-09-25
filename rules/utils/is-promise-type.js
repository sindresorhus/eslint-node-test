import {isUnknownType} from './types.js';

// Best-effort check whether a TypeScript type is a promise. Returns `true`/`false` when known, `undefined` when indeterminate.
export default function isPromiseType(type, checker) {
	if (isUnknownType(type)) {
		return;
	}

	// A type parameter stands for whatever the caller passed, so nothing about it is knowable here: a
	// `T` instantiated with a Promise is one, and the rule must not read that as a concrete value.
	if (type.isTypeParameter()) {
		return;
	}

	type = checker.getNonNullableType(type);

	// An intersection with a type parameter (`T & {}`, which is also what `checker.getNonNullableType`
	// and `NonNullable<T>` make of a `T`) is as unknown as the type parameter itself.
	if (type.isIntersection() && type.types.some(member => member.isTypeParameter())) {
		return;
	}

	if (type.isUnion()) {
		const results = type.types.map(type => isPromiseType(type, checker));

		if (results.every(Boolean)) {
			return true;
		}

		if (results.every(result => result === false)) {
			return false;
		}

		return;
	}

	return checker.getPromisedTypeOfPromise(type) !== undefined;
}
