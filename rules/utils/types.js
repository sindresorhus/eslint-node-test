const unknownTypeNames = new Set(['any', 'error', 'unknown']);

const isUnknownType = type => unknownTypeNames.has(type.intrinsicName);

export {isUnknownType};
