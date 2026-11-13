import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, jsonParse, sleep } from 'n8n-workflow';

import {
	compact,
	getProcessId,
	pollUntil,
	raidboxesApiRequest,
	raidboxesApiRequestAllItems,
	toList,
	waitForBackup,
	waitForProcess,
} from './GenericFunctions';
import type { PollOptions } from './GenericFunctions';
import { boxFields, boxOperations } from './descriptions/BoxDescription';
import { backupFields, backupOperations } from './descriptions/BackupDescription';
import { cacheFields, cacheOperations } from './descriptions/CacheDescription';
import { settingFields, settingOperations } from './descriptions/SettingDescription';
import {
	processFields,
	processOperations,
	sshKeyFields,
	sshKeyOperations,
	subscriptionFields,
	subscriptionOperations,
	wordPressOperations,
} from './descriptions/AccountDescription';

export class Raidboxes implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Raidboxes',
		name: 'raidboxes',
		icon: 'file:raidboxes.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage WordPress Boxes, backups, cache and settings at Raidboxes',
		defaults: { name: 'Raidboxes' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'raidboxesApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'box',
				options: [
					{ name: 'Backup', value: 'backup' },
					{ name: 'Box', value: 'box' },
					{ name: 'Box Setting', value: 'setting' },
					{ name: 'Cache', value: 'cache' },
					{ name: 'Process', value: 'process' },
					{ name: 'SSH Key', value: 'sshKey' },
					{ name: 'Subscription', value: 'subscription' },
					{ name: 'WordPress', value: 'wordPress' },
				],
			},
			...boxOperations,
			...boxFields,
			...backupOperations,
			...backupFields,
			...cacheOperations,
			...cacheFields,
			...settingOperations,
			...settingFields,
			...processOperations,
			...processFields,
			...subscriptionOperations,
			...subscriptionFields,
			...sshKeyOperations,
			...sshKeyFields,
			...wordPressOperations,
		],
	};

	methods = {
		listSearch: {
			async searchBoxes(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const qs: IDataObject = {};
				if (filter) qs.search = filter;
				const boxes = await raidboxesApiRequestAllItems.call(this, '/v1/boxes', qs, 200);
				return {
					results: boxes.map((box) => ({
						name: `${box.title ?? box.name}${box.domain ? ` (${box.domain})` : ''}`,
						value: String(box.id),
					})),
				};
			},
		},
		loadOptions: {
			async getWordPressVersions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const versions = extractVersions(await raidboxesApiRequest.call(this, 'GET', '/v1/wordpress/versions'));
				return versions.map((v) => ({ name: v, value: v }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const result = await executeOperation.call(this, resource, operation, i);
				const results = Array.isArray(result) ? result : [result];
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

/** The spec nests the list as data.data (WordPressVersionsResource); accept flat arrays too. */
function extractVersions(response: IDataObject): string[] {
	let data: unknown = response.data;
	if (data && !Array.isArray(data) && typeof data === 'object') data = (data as IDataObject).data;
	return Array.isArray(data) ? data.map(String) : [];
}

/** Unwraps `{ data: ... }`; 204 responses become `{ success: true }`. */
function unwrap(response: IDataObject): IDataObject | IDataObject[] {
	if (Object.keys(response).length === 0) return { success: true };
	const data = response.data;
	if (Array.isArray(data)) return data as IDataObject[];
	if (data && typeof data === 'object') return data as IDataObject;
	return response;
}

async function getAll(this: IExecuteFunctions, endpoint: string, i: number, qs: IDataObject = {}) {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
	return raidboxesApiRequestAllItems.call(this, endpoint, qs, limit);
}

function pollOptions(this: IExecuteFunctions, i: number): PollOptions {
	const opts = this.getNodeParameter('pollingOptions', i, {}) as IDataObject;
	return {
		pollIntervalSeconds: (opts.pollInterval as number) ?? 30,
		timeoutMinutes: (opts.timeout as number) ?? 120,
	};
}

function shouldWait(this: IExecuteFunctions, i: number): boolean {
	return this.getNodeParameter('waitForCompletion', i, false) as boolean;
}

/** Runs an async (202) request and optionally waits for the returned process. */
async function runAsync(this: IExecuteFunctions, i: number, response: IDataObject): Promise<IDataObject> {
	const started = unwrap(response) as IDataObject;
	const processId = getProcessId(response);
	if (!shouldWait.call(this, i) || !processId) return started;
	const opts = pollOptions.call(this, i);
	return waitForProcess.call(this, processId, i, opts.pollIntervalSeconds, opts.timeoutMinutes);
}

async function executeOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	const boxId = () => encodeURIComponent(this.getNodeParameter('boxId', i, '', { extractValue: true }) as string);
	const req = raidboxesApiRequest.bind(this);

	// ======================= BOX =======================
	if (resource === 'box') {
		switch (operation) {
			case 'getAll': {
				const { ownership, staging, ...rest } = this.getNodeParameter('filters', i, {}) as IDataObject;
				const qs = compact(rest);
				// Laravel query filters: filter[ownership]=1&filter[staging]=0
				if (ownership !== undefined) qs['filter[ownership]'] = ownership ? 1 : 0;
				if (staging !== undefined) qs['filter[staging]'] = staging ? 1 : 0;
				return getAll.call(this, '/v1/boxes', i, qs);
			}
			case 'get':
				return unwrap(await req('GET', `/v1/boxes/${boxId()}`));
			case 'delete':
				return unwrap(await req('DELETE', `/v1/boxes/${boxId()}`));
			case 'create': {
				const planSource = this.getNodeParameter('planSource', i) as string;
				const body: IDataObject = {
					title: this.getNodeParameter('title', i),
					wordpress: {
						version: this.getNodeParameter('wordpressVersion', i),
						admin_username: this.getNodeParameter('adminUsername', i),
						admin_password: this.getNodeParameter('adminPassword', i),
					},
					...compact(this.getNodeParameter('additionalFields', i, {}) as IDataObject),
				};
				if (planSource === 'subscription') body.subscription_id = this.getNodeParameter('subscriptionId', i);
				else body.performance_level = this.getNodeParameter('performanceLevel', i);

				if (!shouldWait.call(this, i)) return unwrap(await req('POST', '/v1/boxes', body)) as IDataObject;

				// The process of POST /v1/boxes can stay "accepted" although the Box is ready (observed Nov 2026).
				// So wait for either the process to complete or a new Box with this title to appear.
				const before = new Set((await raidboxesApiRequestAllItems.call(this, '/v1/boxes')).map((b) => String(b.id)));
				const started = unwrap(await req('POST', '/v1/boxes', body)) as IDataObject;
				const processId = getProcessId({ data: started });
				let lastStatus = String(started.status ?? 'unknown');
				return pollUntil.call(this, i, pollOptions.call(this, i), 'Box creation', async () => {
					if (processId) {
						const process = unwrap(await req('GET', `/v1/processes/${encodeURIComponent(processId)}`)) as IDataObject;
						lastStatus = String(process.status ?? lastStatus);
						if (lastStatus === 'failed') {
							throw new NodeOperationError(this.getNode(), 'Raidboxes reported the Box creation as failed', {
								itemIndex: i,
								description: JSON.stringify(process.error_data ?? process),
							});
						}
					}
					const boxes = await raidboxesApiRequestAllItems.call(this, '/v1/boxes', { search: body.title as string });
					const created = boxes.find((b) => !before.has(String(b.id)) && b.title === body.title);
					if (created) return { ...created, process_id: processId, process_status: lastStatus };
					return undefined;
				}, () => `Process ${processId ?? '-'} status: ${lastStatus}`);
			}
			case 'getMetrics': {
				const metric = this.getNodeParameter('metric', i) as string;
				const data = unwrap(await req('GET', `/v1/boxes/${boxId()}/metrics/${metric}`)) as IDataObject;
				const split = metric !== 'storage' && (this.getNodeParameter('splitMetrics', i, false) as boolean);
				if (split && Array.isArray(data.values) && Array.isArray(data.labels)) {
					const labels = data.labels as string[];
					return (data.values as Array<string | number>).map((value, idx) => ({
						timestamp: labels[idx],
						value: Number(value),
					}));
				}
				return data;
			}
			case 'getLog': {
				const file = encodeURIComponent(this.getNodeParameter('logFile', i) as string);
				return unwrap(await req('GET', `/v1/boxes/${boxId()}/logs/${file}`));
			}
			case 'getSsl':
				return unwrap(await req('GET', `/v1/boxes/${boxId()}/ssl`));
			case 'installSsl': {
				const id = boxId();
				const body: IDataObject = {
					box_id: decodeURIComponent(id),
					crt: this.getNodeParameter('crt', i),
					key: this.getNodeParameter('key', i),
					...compact(this.getNodeParameter('sslAdditionalFields', i, {}) as IDataObject),
				};
				return unwrap(await req('POST', `/v1/boxes/${id}/ssl`, body));
			}
			case 'removeSsl':
				return unwrap(await req('DELETE', `/v1/boxes/${boxId()}/ssl`));
			case 'unbanAllIps':
				return unwrap(await req('DELETE', `/v1/boxes/${boxId()}/limit-login-protection/unban-all`));
			case 'getWordPressUsers':
				return unwrap(await req('GET', `/v1/boxes/${boxId()}/wordpress/users`));
		}
	}

	// ======================= BACKUP =======================
	if (resource === 'backup') {
		const id = boxId();
		const rawBoxId = decodeURIComponent(id);
		const backupId = () => this.getNodeParameter('backupId', i) as string;
		const backupPath = () => `/v1/boxes/${id}/backups/${encodeURIComponent(backupId())}`;

		switch (operation) {
			case 'getAll': {
				const filters = compact(this.getNodeParameter('filters', i, {}) as IDataObject);
				return getAll.call(this, `/v1/boxes/${id}/backups`, i, { box_id: rawBoxId, ...filters });
			}
			case 'create': {
				const name = this.getNodeParameter('name', i) as string;
				const startedAt = Date.now();
				const response = await req('POST', `/v1/boxes/${id}/backups`, { name, box_id: rawBoxId });
				if (!shouldWait.call(this, i)) return unwrap(response);
				if (getProcessId(response)) return runAsync.call(this, i, response);
				// No process id: watch the backup list instead
				return waitForBackup.call(this, rawBoxId, i, pollOptions.call(this, i), (backups) =>
					backups
						.filter((b) => b.name === name && b.restorable === true)
						.filter((b) => !b.created_at || Date.parse(String(b.created_at)) >= startedAt - 5 * 60_000)
						.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0],
				'Backup');
			}
			case 'delete': {
				const target = backupId();
				const response = await req('DELETE', backupPath(), {}, { box_id: rawBoxId, backup_id: target });
				if (!shouldWait.call(this, i)) return unwrap(response);
				if (getProcessId(response)) return runAsync.call(this, i, response);
				return waitForBackup.call(this, rawBoxId, i, pollOptions.call(this, i), (backups) =>
					backups.some((b) => b.id === target || b.uuid === target) ? undefined : { success: true, deleted: target },
				'Backup deletion');
			}
			case 'restore': {
				const target = backupId();
				const response = await req('POST', `${backupPath()}/restore`, { box_id: rawBoxId, backup_id: target });
				if (!shouldWait.call(this, i)) return unwrap(response);
				if (getProcessId(response)) return runAsync.call(this, i, response);
				// Give Raidboxes a moment to flag the restore as running before checking the list
				await sleep(10_000);
				return waitForBackup.call(this, rawBoxId, i, pollOptions.call(this, i), () => ({ success: true, restored: target }), 'Restore');
			}
			case 'getDownloadLink':
				return runAsync.call(this, i, await req('POST', `${backupPath()}/download`, { box_id: rawBoxId, backup_id: backupId() }));
			case 'clone': {
				const body: IDataObject = {
					box_id: rawBoxId,
					backup_id: backupId(),
					transfer_box_admins: this.getNodeParameter('transferBoxAdmins', i),
				};
				if (this.getNodeParameter('planSource', i) === 'subscription') body.subscription_id = this.getNodeParameter('subscriptionId', i);
				else body.plan_id = this.getNodeParameter('planId', i);
				return runAsync.call(this, i, await req('POST', `${backupPath()}/clone`, body));
			}
		}
	}

	// ======================= CACHE =======================
	if (resource === 'cache') {
		const id = boxId();
		switch (operation) {
			case 'clear': {
				const type = this.getNodeParameter('cacheType', i) as string;
				const path = type === 'all' ? `/v1/boxes/${id}/cache` : `/v1/boxes/${id}/cache/${type}`;
				return unwrap(await req('DELETE', path));
			}
			case 'getSettings':
				return unwrap(await req('GET', `/v1/boxes/${id}/cache/settings`));
			case 'updateSettings': {
				const settings = compact(this.getNodeParameter('settings', i, {}) as IDataObject);
				if (typeof settings.cache_rules === 'string') settings.cache_rules = toList(settings.cache_rules);
				return unwrap(await req('PATCH', `/v1/boxes/${id}/cache/settings`, { box_id: decodeURIComponent(id), ...settings }));
			}
		}
	}

	// ======================= SETTINGS =======================
	if (resource === 'setting') {
		if (operation === 'getMany') {
			const area = this.getNodeParameter('manyArea', i) as string;
			const ids = toList(this.getNodeParameter('boxIds', i) as string);
			return unwrap(await req('GET', `/v1/boxes/${area}/settings`, {}, { ids }));
		}
		const id = boxId();
		const rawBoxId = decodeURIComponent(id);
		switch (operation) {
			case 'get': {
				const area = this.getNodeParameter('area', i) as string;
				return unwrap(await req('GET', `/v1/boxes/${id}/${area}`));
			}
			case 'updatePhp': {
				const settings = compact(this.getNodeParameter('phpSettings', i, {}) as IDataObject);
				return unwrap(await req('PATCH', `/v1/boxes/${id}/php/settings`, { box_id: rawBoxId, settings }));
			}
			case 'updateWordPress': {
				const settings = compact(this.getNodeParameter('wpSettings', i, {}) as IDataObject);
				return unwrap(await req('PATCH', `/v1/boxes/${id}/wordpress/settings`, { box_id: rawBoxId, settings }));
			}
			case 'updateWordPressVersion': {
				const version = this.getNodeParameter('wordpressVersion', i);
				return unwrap(await req('PATCH', `/v1/boxes/${id}/wordpress/settings/version`, { box_id: rawBoxId, version }));
			}
			case 'updateSsh':
				return unwrap(await req('PATCH', `/v1/boxes/${id}/ssh/settings`, { box_id: rawBoxId, ssh: this.getNodeParameter('ssh', i) }));
			case 'updateIpBlocking': {
				const body = {
					block_mode: this.getNodeParameter('blockMode', i),
					block_blacklist: toList(this.getNodeParameter('blockBlacklist', i, '') as string),
					block_whitelist: toList(this.getNodeParameter('blockWhitelist', i, '') as string),
				};
				return unwrap(await req('PATCH', `/v1/boxes/${id}/access/website/ip-blocking`, body));
			}
			case 'updateUserAgents': {
				const rules = (this.getNodeParameter('userAgentRules', i, {}) as IDataObject).rule as IDataObject[] | undefined;
				return unwrap(await req('PATCH', `/v1/boxes/${id}/access/website/user-agents`, { block_user_agents: rules ?? [] }));
			}
			case 'updateWebsiteAccess': {
				const raw = this.getNodeParameter('websiteAccessJson', i) as string | IDataObject;
				const json = typeof raw === 'string' ? jsonParse<IDataObject>(raw, { errorMessage: 'Settings (JSON) is not valid JSON' }) : raw;
				return unwrap(await req('PATCH', `/v1/boxes/${id}/access/website`, { ...json, box_id: rawBoxId }));
			}
		}
	}

	// ======================= PROCESS =======================
	if (resource === 'process') {
		const processId = this.getNodeParameter('processId', i) as string;
		if (operation === 'get') return unwrap(await req('GET', `/v1/processes/${encodeURIComponent(processId)}`));
		if (operation === 'waitFor') {
			const opts = pollOptions.call(this, i);
			return waitForProcess.call(this, processId, i, opts.pollIntervalSeconds, opts.timeoutMinutes);
		}
	}


	// ======================= SUBSCRIPTION =======================
	if (resource === 'subscription') {
		if (operation === 'getAll') return getAll.call(this, '/v1/subscriptions', i);
		const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;
		const path = `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`;
		switch (operation) {
			case 'cancel':
				return unwrap(await req('POST', `${path}/cancel`, { subscription_id: subscriptionId }));
			case 'revokeCancellation':
				return unwrap(await req('DELETE', `${path}/cancel`));
			case 'cancelItems': {
				const itemIds = toList(this.getNodeParameter('items', i) as string);
				return unwrap(await req('POST', `${path}/items/cancel`, { subscription_id: subscriptionId, items: itemIds }));
			}
			case 'revokeItemsCancellation': {
				const itemIds = toList(this.getNodeParameter('items', i) as string);
				return unwrap(await req('DELETE', `${path}/items/cancel`, {}, { subscription_id: subscriptionId, items: itemIds }));
			}
		}
	}

	// ======================= SSH KEY =======================
	if (resource === 'sshKey') {
		switch (operation) {
			case 'getAll':
				return getAll.call(this, '/v1/ssh-keys', i);
			case 'create':
				return unwrap(await req('POST', '/v1/ssh-keys', { title: this.getNodeParameter('title', i), key: this.getNodeParameter('key', i) }));
			case 'delete': {
				const keyId = encodeURIComponent(this.getNodeParameter('sshKeyId', i) as string);
				return unwrap(await req('DELETE', `/v1/ssh-keys/${keyId}`));
			}
		}
	}

	// ======================= WORDPRESS =======================
	if (resource === 'wordPress' && operation === 'getVersions') {
		return extractVersions(await req('GET', '/v1/wordpress/versions')).map((version) => ({ version }));
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}" for resource "${resource}"`, { itemIndex: i });
}
