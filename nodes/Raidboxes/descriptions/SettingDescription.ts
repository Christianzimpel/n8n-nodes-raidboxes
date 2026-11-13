import type { INodeProperties } from 'n8n-workflow';
import { boxLocator } from './shared';

const R = ['setting'];

export const settingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: R } },
		default: 'get',
		options: [
			{ name: 'Get', value: 'get', action: 'Get settings of a box' },
			{ name: 'Get for Many Boxes', value: 'getMany', action: 'Get settings for many boxes' },
			{ name: 'Update IP Blocking', value: 'updateIpBlocking', action: 'Update IP blocking of a box' },
			{ name: 'Update PHP', value: 'updatePhp', action: 'Update PHP settings of a box' },
			{ name: 'Update SSH', value: 'updateSsh', action: 'Enable or disable SSH on a box' },
			{ name: 'Update User Agent Blocking', value: 'updateUserAgents', action: 'Replace user agent block rules of a box' },
			{ name: 'Update Website Access', value: 'updateWebsiteAccess', action: 'Update website access settings of a box', description: 'Password protection, redirects, origin lock (raw JSON)' },
			{ name: 'Update WordPress', value: 'updateWordPress', action: 'Update word press settings of a box' },
			{ name: 'Update WordPress Version', value: 'updateWordPressVersion', action: 'Change the word press core version of a box' },
		],
	},
];

export const settingFields: INodeProperties[] = [
	boxLocator({
		resource: R,
		operation: ['get', 'updatePhp', 'updateWordPress', 'updateWordPressVersion', 'updateSsh', 'updateIpBlocking', 'updateUserAgents', 'updateWebsiteAccess'],
	}),

	// ---------- get ----------
	{
		displayName: 'Area',
		name: 'area',
		type: 'options',
		default: 'wordpress/settings',
		displayOptions: { show: { resource: R, operation: ['get'] } },
		options: [
			{ name: 'IP Blocking', value: 'access/website/ip-blocking' },
			{ name: 'PHP', value: 'php/settings' },
			{ name: 'Redis', value: 'redis/settings' },
			{ name: 'SSH', value: 'ssh/settings' },
			{ name: 'User Agent Blocking', value: 'access/website/user-agents' },
			{ name: 'Website Access', value: 'access/website' },
			{ name: 'WordPress', value: 'wordpress/settings' },
		],
	},

	// ---------- getMany ----------
	{
		displayName: 'Area',
		name: 'manyArea',
		type: 'options',
		default: 'wordpress',
		displayOptions: { show: { resource: R, operation: ['getMany'] } },
		options: [
			{ name: 'Cache', value: 'cache' },
			{ name: 'PHP', value: 'php' },
			{ name: 'WordPress', value: 'wordpress' },
		],
	},
	{
		displayName: 'Box IDs',
		name: 'boxIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 123, 456',
		description: 'Comma-separated list of Box IDs',
		displayOptions: { show: { resource: R, operation: ['getMany'] } },
	},

	// ---------- updatePhp ----------
	{
		displayName: 'PHP Settings',
		name: 'phpSettings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: { show: { resource: R, operation: ['updatePhp'] } },
		options: [
			{ displayName: 'Max Execution Time (Seconds)', name: 'max_execution_time_in_seconds', type: 'number', default: 60 },
			{ displayName: 'Memory Limit (MB)', name: 'memory_limit', type: 'number', default: 256 },
			{ displayName: 'PHP Version', name: 'version', type: 'string', default: '', placeholder: 'e.g. 8.3' },
		],
	},

	// ---------- updateWordPress ----------
	{
		displayName: 'WordPress Settings',
		name: 'wpSettings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: { show: { resource: R, operation: ['updateWordPress'] } },
		options: [
			{ displayName: 'AI Assistant', name: 'ai_assistant', type: 'boolean', default: false },
			{ displayName: 'Block XML-RPC', name: 'block_xmlrpc', type: 'boolean', default: true },
			{ displayName: 'Debug Mode', name: 'debug', type: 'boolean', default: false, description: 'Whether WP_DEBUG is enabled' },
			{ displayName: 'Disallow File Edit', name: 'disallow_file_edit', type: 'boolean', default: true },
			{ displayName: 'Frozen Major Version', name: 'frozen_major_version', type: 'string', default: '', description: 'Pin WordPress core to this major version' },
			{ displayName: 'LiteSpeed Plugin', name: 'litespeed_plugin', type: 'boolean', default: false },
			{ displayName: 'PHP Config Code', name: 'php_config_code', type: 'string', typeOptions: { rows: 4 }, default: '', description: 'Additional code for wp-config.php' },
			{ displayName: 'Single Sign-On', name: 'sso', type: 'boolean', default: true },
			{ displayName: 'Table Prefix', name: 'table_prefix', type: 'string', default: '' },
		],
	},

	// ---------- updateWordPressVersion ----------
	{
		displayName: 'WordPress Version Name or ID',
		name: 'wordpressVersion',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getWordPressVersions' },
		required: true,
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { show: { resource: R, operation: ['updateWordPressVersion'] } },
	},

	// ---------- updateSsh ----------
	{
		displayName: 'SSH Enabled',
		name: 'ssh',
		type: 'boolean',
		default: true,
		description: 'Whether SSH access is enabled for the Box',
		displayOptions: { show: { resource: R, operation: ['updateSsh'] } },
	},

	// ---------- updateIpBlocking ----------
	{
		displayName: 'Block Mode',
		name: 'blockMode',
		type: 'options',
		default: 0,
		displayOptions: { show: { resource: R, operation: ['updateIpBlocking'] } },
		options: [
			{ name: 'Off', value: 0 },
			{ name: 'Blacklist (Block Listed IPs)', value: 1 },
			{ name: 'Whitelist (Allow Only Listed IPs)', value: 2 },
		],
	},
	{
		displayName: 'Blacklist',
		name: 'blockBlacklist',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'IPs or ranges to block, one per line or comma-separated',
		displayOptions: { show: { resource: R, operation: ['updateIpBlocking'] } },
	},
	{
		displayName: 'Whitelist',
		name: 'blockWhitelist',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'IPs or ranges to allow, one per line or comma-separated',
		displayOptions: { show: { resource: R, operation: ['updateIpBlocking'] } },
	},

	// ---------- updateUserAgents ----------
	{
		displayName: 'This replaces all existing user agent rules of the Box',
		name: 'userAgentNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: R, operation: ['updateUserAgents'] } },
	},
	{
		displayName: 'Rules',
		name: 'userAgentRules',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Rule',
		default: {},
		displayOptions: { show: { resource: R, operation: ['updateUserAgents'] } },
		options: [
			{
				displayName: 'Rule',
				name: 'rule',
				values: [
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'User Agent', name: 'user_agent', type: 'string', default: '' },
					{
						displayName: 'Matching',
						name: 'regex',
						type: 'options',
						default: 'off',
						options: [
							{ name: 'Exact (Case-Sensitive)', value: 'off' },
							{ name: 'Case-Insensitive', value: 'case_insensitive' },
						],
					},
				],
			},
		],
	},

	// ---------- updateWebsiteAccess ----------
	{
		displayName: 'Settings (JSON)',
		name: 'websiteAccessJson',
		type: 'json',
		default: '{\n  "level": "1",\n  "user": "",\n  "password": ""\n}',
		description:
			'Fields of the Raidboxes "BoxAccessUpdateRequest": level, user, password, redirects, block_mode, block_blacklist, block_whitelist, block_user_agents, origin_lock_secret. box_id is added automatically.',
		displayOptions: { show: { resource: R, operation: ['updateWebsiteAccess'] } },
	},
];
