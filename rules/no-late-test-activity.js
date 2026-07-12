import {createLateTestActivity} from './no-unawaited-promise-assertion.js';

const MESSAGE_ID = 'no-late-test-activity';

const messages = {
	[MESSAGE_ID]: '{{activity}} in a detached `{{scheduler}}` callback can run after the test or hook has finished.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	createLateTestActivity(context, {messageId: MESSAGE_ID});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow test activity inside detached asynchronous callbacks.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
