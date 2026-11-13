import type { INodeProperties } from 'n8n-workflow';
import { returnAllFields, waitFields } from './shared';

// ---------------- Process ----------------
export const processOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['process'] } },
		default: 'get',
		options: [
			{ name: 'Get', value: 'get', action: 'Get the status of a process' },
			{ name: 'Wait for Completion', value: 'waitFor', action: 'Wait until a process is finished' },
		],
	},
];

export const processFields: INodeProperties[] = [
	{
		displayName: 'Process ID',
		name: 'processId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
		displayOptions: { show: { resource: ['process'] } },
	},
	...waitFields({ resource: ['process'], operation: ['waitFor'] }).filter((f) => f.name === 'pollingOptions')
		.map((f) => ({ ...f, displayOptions: { show: { resource: ['process'], operation: ['waitFor'] } } })),
];

// ---------------- Subscription ----------------
const S = ['subscription'];

export const subscriptionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: S } },
		default: 'getAll',
		options: [
			{ name: 'Cancel', value: 'cancel', action: 'Cancel a subscription' },
			{ name: 'Cancel Add-Ons', value: 'cancelItems', action: 'Cancel add ons of a subscription' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many subscriptions' },
			{ name: 'Revoke Add-On Cancellation', value: 'revokeItemsCancellation', action: 'Revoke the cancellation of add ons' },
			{ name: 'Revoke Cancellation', value: 'revokeCancellation', action: 'Revoke the cancellation of a subscription' },
		],
	},
];

export const subscriptionFields: INodeProperties[] = [
	{
		displayName: 'Subscription ID',
		name: 'subscriptionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: S, operation: ['cancel', 'revokeCancellation', 'cancelItems', 'revokeItemsCancellation'] } },
	},
	{
		displayName: 'Item IDs',
		name: 'items',
		type: 'string',
		required: true,
		default: '',
		description: 'Comma-separated IDs of the add-on items',
		displayOptions: { show: { resource: S, operation: ['cancelItems', 'revokeItemsCancellation'] } },
	},
	...returnAllFields({ resource: S, operation: ['getAll'] }),
];

// ---------------- SSH Key ----------------
const K = ['sshKey'];

export const sshKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: K } },
		default: 'getAll',
		options: [
			{ name: 'Create', value: 'create', action: 'Add an SSH key' },
			{ name: 'Delete', value: 'delete', action: 'Delete an SSH key' },
			{ name: 'Get Many', value: 'getAll', action: 'Get many SSH keys' },
		],
	},
];

export const sshKeyFields: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Work Laptop',
		displayOptions: { show: { resource: K, operation: ['create'] } },
	},
	{
		displayName: 'Public Key',
		name: 'key',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		placeholder: 'ssh-ed25519 AAAA...',
		displayOptions: { show: { resource: K, operation: ['create'] } },
	},
	{
		displayName: 'SSH Key ID',
		name: 'sshKeyId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: K, operation: ['delete'] } },
	},
	...returnAllFields({ resource: K, operation: ['getAll'] }),
];

// ---------------- WordPress ----------------
export const wordPressOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['wordPress'] } },
		default: 'getVersions',
		options: [{ name: 'Get Versions', value: 'getVersions', action: 'Get available word press versions' }],
	},
];
