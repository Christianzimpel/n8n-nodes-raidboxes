import type { INodeProperties } from 'n8n-workflow';

type Show = { resource: string[]; operation: string[] };

export function boxLocator(show: Show, displayName = 'Box'): INodeProperties {
	return {
		displayName,
		name: 'boxId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The Box to work with',
		displayOptions: { show },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchBoxes', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12345',
			},
		],
	};
}

export function returnAllFields(show: Show): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
		},
	];
}

export function waitFields(show: Show): INodeProperties[] {
	return [
		{
			displayName: 'Wait for Completion',
			name: 'waitForCompletion',
			type: 'boolean',
			default: true,
			description:
				'Whether to poll the returned Raidboxes process until it is finished before continuing. If the API returns no process ID, the node continues immediately.',
			displayOptions: { show },
		},
		{
			displayName: 'Polling Options',
			name: 'pollingOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: { show: { ...show, waitForCompletion: [true] } },
			options: [
				{
					displayName: 'Poll Interval (Seconds)',
					name: 'pollInterval',
					type: 'number',
					typeOptions: { minValue: 2 },
					default: 30,
				},
				{
					displayName: 'Timeout (Minutes)',
					name: 'timeout',
					type: 'number',
					typeOptions: { minValue: 1 },
					default: 120,
					description: 'Backups and restores can take a long time. For very long jobs consider the Callback URL (Box create) or a separate workflow that checks the process later.',
				},
			],
		},
	];
}
