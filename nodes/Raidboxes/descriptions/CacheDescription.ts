import type { INodeProperties } from 'n8n-workflow';
import { boxLocator } from './shared';

const R = ['cache'];

export const cacheOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: R } },
		default: 'clear',
		options: [
			{ name: 'Clear', value: 'clear', action: 'Clear the cache of a box' },
			{ name: 'Get Settings', value: 'getSettings', action: 'Get cache settings of a box' },
			{ name: 'Update Settings', value: 'updateSettings', action: 'Update cache settings of a box' },
		],
	},
];

export const cacheFields: INodeProperties[] = [
	boxLocator({ resource: R, operation: ['clear', 'getSettings', 'updateSettings'] }),
	{
		displayName: 'Cache Type',
		name: 'cacheType',
		type: 'options',
		default: 'all',
		displayOptions: { show: { resource: R, operation: ['clear'] } },
		options: [
			{ name: 'All Caches', value: 'all' },
			{ name: 'OPcache', value: 'opcache' },
			{ name: 'Varnish', value: 'varnish' },
		],
	},
	{
		displayName: 'Settings',
		name: 'settings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: { show: { resource: R, operation: ['updateSettings'] } },
		options: [
			{ displayName: 'Cache Enabled', name: 'cache', type: 'boolean', default: true, description: 'Whether the page cache is enabled' },
			{ displayName: 'Exclusion Rules', name: 'cache_rules', type: 'string', typeOptions: { rows: 4 }, default: '', description: 'One rule per line (or comma-separated)' },
			{ displayName: 'Ignore Headers', name: 'cache_ignore_headers', type: 'boolean', default: false },
			{ displayName: 'Responsive Cache', name: 'cache_responsive', type: 'boolean', default: false, description: 'Whether to keep separate caches for mobile and desktop' },
			{ displayName: 'TTL', name: 'cache_ttl', type: 'string', default: '', description: 'Cache lifetime as expected by Raidboxes' },
		],
	},
];
