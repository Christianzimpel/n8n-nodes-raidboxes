import type { INodeProperties } from 'n8n-workflow';
import { boxLocator, returnAllFields, waitFields } from './shared';

const R = ['backup'];

export const backupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: R } },
		default: 'create',
		options: [
			{ name: 'Clone', value: 'clone', action: 'Clone a backup into a new box' },
			{ name: 'Create', value: 'create', action: 'Create a backup' },
			{ name: 'Delete', value: 'delete', action: 'Delete a backup' },
			{ name: 'Get Download Link', value: 'getDownloadLink', action: 'Get a download link for a backup' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many backups' },
			{ name: 'Restore', value: 'restore', action: 'Restore a backup' },
		],
	},
];

const withBackupId = ['delete', 'restore', 'clone', 'getDownloadLink'];

export const backupFields: INodeProperties[] = [
	boxLocator({ resource: R, operation: ['getAll', 'create', ...withBackupId] }),
	{
		displayName: 'Backup ID',
		name: 'backupId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID of the backup',
		displayOptions: { show: { resource: R, operation: withBackupId } },
	},

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
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: '',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Automatic', value: 'auto' },
					{ name: 'Manual', value: 'manual' },
				],
			},
			{ displayName: 'Sort', name: 'sort', type: 'string', default: '', placeholder: 'e.g. -date_time' },
		],
	},

	// ---------- create ----------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Before plugin update',
		description: 'Name of the backup (max. 100 characters).',
		displayOptions: { show: { resource: R, operation: ['create'] } },
	},

	// ---------- clone ----------
	{
		displayName: 'Plan Source',
		name: 'planSource',
		type: 'options',
		default: 'plan',
		displayOptions: { show: { resource: R, operation: ['clone'] } },
		options: [
			{ name: 'Plan ID (New Subscription)', value: 'plan' },
			{ name: 'Existing Subscription', value: 'subscription' },
		],
	},
	{
		displayName: 'Plan ID',
		name: 'planId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['clone'], planSource: ['plan'] } },
	},
	{
		displayName: 'Subscription ID',
		name: 'subscriptionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: R, operation: ['clone'], planSource: ['subscription'] } },
	},
	{
		displayName: 'Transfer Box Admins',
		name: 'transferBoxAdmins',
		type: 'boolean',
		default: false,
		description: 'Whether to give the admins of the source Box access to the clone',
		displayOptions: { show: { resource: R, operation: ['clone'] } },
	},

	...waitFields({ resource: R, operation: ['create', 'delete', 'restore', 'clone', 'getDownloadLink'] }),
];
