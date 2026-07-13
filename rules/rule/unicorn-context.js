/**
@import * as ESLint from 'eslint';
@import {UnicornListeners, ListenerType, Listener} from './to-eslint-create.js'
*/

/**
@typedef {(type: ListenerType | ListenerType[], listener: Listener) => ReturnType<Listener>} UnicornRuleListen
@typedef {ESLint.Rule.RuleContext & {
	on: UnicornRuleListen
	onExit: UnicornRuleListen
}} UnicornContext
*/

/**
Create a better `Context` object with `on` and `onExit` method to add listeners

@param {ESLint.Rule.RuleContext} eslintContext
@param {UnicornListeners} listeners
@returns {UnicornContext}
*/
export default function createUnicornContext(eslintContext, listeners) {
	// Keep the `Proxy`. One context is created per rule per file, and ESLint hands each rule a distinct
	// context object, so deriving from it with `Object.create` builds a fresh hidden class every time and
	// measures several times slower. Creation is the hot part here, not property access.
	/** @type {UnicornContext} */
	const context = new Proxy(eslintContext, {
		get(target, property, receiver) {
			if (property === 'on' || property === 'onExit') {
				return listeners[property].bind(listeners);
			}

			return Reflect.get(target, property, receiver);
		},
	});

	return context;
}
