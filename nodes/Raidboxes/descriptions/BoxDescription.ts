import type { INodeProperties } from 'n8n-workflow';
import { boxLocator, returnAllFields, waitFields } from './shared';

const R = ['box'];

export const boxOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: R } },
		default: 'getAll',
		options: [
			{ name: 'Create', value: 'create', action: 'Create a box', description: 'Create a new WordPress Box' },
			{ name: 'Delete', value: 'delete', action: 'Delete a box' },
			{ name: 'Get', value: 'get', action: 'Get a box' },
			{ name: 'Get Log', value: 'getLog', action: 'Get a log file of a box', description: 'Get a signed download URL for a log file' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many boxes' },
			{ name: 'Get Metrics', value: 'getMetrics', action: 'Get metrics of a box', description: 'Get CPU, memory or storage usage' },
			{ name: 'Get SSL Certificate', value: 'getSsl', action: 'Get the SSL certificate of a box' },
			{ name: 'Get WordPress Users', value: 'getWordPressUsers', action: 'Get the word press users of a box' },
			{ name: 'Install SSL Certificate', value: 'installSsl', action: 'Install a custom SSL certificate on a box' },
			{ name: 'Remove SSL Certificate', value: 'removeSsl', action: 'Remove the custom SSL certificate from a box' },
			{ name: 'Unban All IPs', value: 'unbanAllIps', action: 'Unban all i ps blocked by login protection', description: 'Unban all IPs blocked by Limit-Login-Protection' },
		],
	},
];

export const boxFields: INodeProperties[] = [
	boxLocator({ resource: R, operation: ['get', 'delete', 'getMetrics', 'getLog', 'getSsl', 'installSsl', 'removeSsl', 'unbanAllIps', 'getWordPressUsers'] }),

	// ---------- getAll ----------
	...returnAllFields({ resource: R, operation: ['getAll'] }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: R, operation: ['getAll'] } },
		options: [
			{ displayName: 'Only Own Boxes', name: 'ownership', type: 'boolean', default: true, description: 'Whether to return only Boxes you own (not those shared with you)' },
			{ displayName: 'Search', name: 'search', type: 'string', default: '', description: 'Search term for Box name, title or domain' },
			{ displayName: 'Sort', name: 'sort', type: 'string', default: '', placeholder: 'e.g. -created_at', description: 'Field to sort by, prefix with "-" for descending order' },
			{ displayName: 'Staging', name: 'staging', type: 'boolean', default: false, description: 'Whether to return only staging Boxes (true) or only live Boxes (false)' },
		],
	},

	// ---------- create ----------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		description: 'Title of the new Box (3–150 characters)',
		displayOptions: { show: { resource: R, operation: ['create'] } },
	},
	{
		displayName: 'Plan Source',
		name: 'planSource',
		type: 'options',
		default: 'performanceLevel',
		displayOptions: { show: { resource: R, operation: ['create'] } },
		options: [
			{ name: 'Performance Level (New Subscription)', value: 'performanceLevel' },
			{ name: 'Existing Subscription', value: 'subscription' },
		],
	},
	{
		displayName: 'Performance Level',
		name: 'performanceLevel',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['create'], planSource: ['performanceLevel'] } },
	},
	{
		displayName: 'Subscription ID',
		name: 'subscriptionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['create'], planSource: ['subscription'] } },
	},
	{
		displayName: 'WordPress Version Name or ID',
		name: 'wordpressVersion',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getWordPressVersions' },
		required: true,
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { show: { resource: R, operation: ['create'] } },
	},
	{
		displayName: 'Admin Username',
		name: 'adminUsername',
		type: 'string',
		required: true,
		default: '',
		description: 'Allowed characters: letters, digits, "_" and "-"',
		displayOptions: { show: { resource: R, operation: ['create'] } },
	},
	{
		displayName: 'Admin Password',
		name: 'adminPassword',
		type: 'string',
		typeOptions: { password: true },
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: R, operation: ['create'] } },
		options: [
			{ displayName: 'AI Assistant', name: 'ai_assistant', type: 'boolean', default: false, description: 'Whether to enable the Raidboxes AI assistant' },
			{ displayName: 'Callback URL', name: 'callback_url', type: 'string', default: '', description: 'URL that Raidboxes calls when the process status changes, e.g. an n8n Webhook URL' },
		],
	},
	...waitFields({ resource: R, operation: ['create'] }),

	// ---------- getMetrics ----------
	{
		displayName: 'Metric',
		name: 'metric',
		type: 'options',
		default: 'cpu',
		displayOptions: { show: { resource: R, operation: ['getMetrics'] } },
		options: [
			{ name: 'CPU', value: 'cpu' },
			{ name: 'Memory', value: 'memory' },
			{ name: 'Storage', value: 'storage' },
		],
	},
	{
		displayName: 'Split Into Items',
		name: 'splitMetrics',
		type: 'boolean',
		default: false,
		description: 'Whether to output one item per data point ({timestamp, value}) instead of the raw arrays. Applies to CPU and memory.',
		displayOptions: { show: { resource: R, operation: ['getMetrics'], metric: ['cpu', 'memory'] } },
	},

	// ---------- getLog ----------
	{
		displayName: 'Log File',
		name: 'logFile',
		type: 'string',
		required: true,
		default: 'wp_debug',
		description: 'Name of the log file, e.g. "wp_debug" for the WordPress debug log',
		displayOptions: { show: { resource: R, operation: ['getLog'] } },
	},

	// ---------- installSsl ----------
	{
		displayName: 'Certificate (CRT)',
		name: 'crt',
		type: 'string',
		typeOptions: { rows: 5 },
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['installSsl'] } },
	},
	{
		displayName: 'Private Key',
		name: 'key',
		type: 'string',
		typeOptions: { rows: 5, password: true },
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['installSsl'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'sslAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: R, operation: ['installSsl'] } },
		options: [
			{ displayName: 'CA Bundle', name: 'bundle', type: 'string', typeOptions: { rows: 5 }, default: '' },
			{ displayName: 'CSR', name: 'csr', type: 'string', typeOptions: { rows: 5 }, default: '' },
		],
	},
];
