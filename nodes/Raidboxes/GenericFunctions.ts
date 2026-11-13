import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export const BASE_URL = 'https://api.raidboxes.io';

type Context = IExecuteFunctions | ILoadOptionsFunctions;

const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Raidboxes errors look like { message: "Unprocessable Entity (422) Response: {\"message\":\"i18n.key|default:Text\", \"errors\": {...}}" }.
 * Dig out the human-readable text (field errors first, then the message without the i18n prefix).
 */
export function raidboxesErrorMessage(body: unknown): string | undefined {
	let data: unknown = body;
	if (typeof data === 'string') {
		try { data = JSON.parse(data); } catch { data = { message: data }; }
	}
	if (!data || typeof data !== 'object') return undefined;
	const obj = data as IDataObject;

	let message = typeof obj.message === 'string' ? obj.message : undefined;
	const embedded = message?.match(/Response:\s*(\{[\s\S]*\})\s*$/);
	if (embedded) {
		const inner = raidboxesErrorMessage(embedded[1]);
		if (inner) return inner;
	}

	const fieldErrors: string[] = [];
	for (const value of Object.values(((obj.errors ?? obj.details) as IDataObject) ?? {})) {
		for (const entry of Array.isArray(value) ? value : [value]) {
			if (typeof entry === 'string') fieldErrors.push(entry);
			else if (entry && typeof entry === 'object' && typeof (entry as IDataObject).message === 'string') {
				fieldErrors.push((entry as IDataObject).message as string);
			}
		}
	}
	if (fieldErrors.length) return [...new Set(fieldErrors)].join(' ');
	if (message?.includes('|default:')) message = message.split('|default:')[1];
	return message;
}

/** Milliseconds to wait after a 429: honours X-RateLimit-Reset (epoch seconds or seconds), else backs off 15/30/60 s. */
export function rateLimitDelay(error: { response?: { headers?: Record<string, unknown> } }, attempt: number, now = Date.now()): number {
	const raw = Number(error?.response?.headers?.['x-ratelimit-reset']);
	if (raw > 0) {
		const ms = raw > 1e9 ? raw * 1000 - now : raw * 1000;
		if (ms > 0 && ms <= 120_000) return ms + 500;
	}
	return 15_000 * 2 ** attempt;
}

export async function raidboxesApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${endpoint}`,
		headers: { Accept: 'application/json' },
		qs,
		arrayFormat: 'brackets', // Laravel style: items[]=a&items[]=b
		json: true,
	};
	if (Object.keys(body).length > 0) options.body = body;
	if (Object.keys(qs).length === 0) delete options.qs;

	// Raidboxes limits: 100 req/min general, 20 req/min resource creation, 10 req/min auth.
	// On HTTP 429 wait and retry a few times instead of failing the workflow.
	for (let attempt = 0; ; attempt++) {
		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'raidboxesApi',
				options,
			);
			// 204 No Content and some 202 responses have no body
			if (response === undefined || response === null || response === '') return {};
			return response as IDataObject;
		} catch (error) {
			const status = Number(error?.httpCode ?? error?.response?.status ?? error?.statusCode);
			if (status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
				await sleep(rateLimitDelay(error, attempt));
				continue;
			}
			// httpRequestWithAuthentication may already throw a NodeApiError (whose constructor ignores new options),
			// so find the Raidboxes text wherever it ended up and set it directly.
			const candidates = [
				error?.cause?.response?.data,
				error?.response?.data,
				error?.response?.body,
				error?.context?.data,
				error?.description,
				error?.cause?.message,
			];
			let readable: string | undefined;
			for (const candidate of candidates) {
				readable = candidate ? raidboxesErrorMessage(candidate) : undefined;
				if (readable) break;
			}
			const apiError = error instanceof NodeApiError ? error : new NodeApiError(this.getNode(), error as JsonObject);
			if (readable) {
				if (apiError.description === readable || !apiError.description) apiError.description = null;
				apiError.message = `Raidboxes: ${readable}`;
			}
			throw apiError;
		}
	}
}

/** Follows Laravel-style pagination (meta.last_page) and returns all items of `data`. */
export async function raidboxesApiRequestAllItems(
	this: Context,
	endpoint: string,
	qs: IDataObject = {},
	limit = 0,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let page = 1;
	let lastPage = 1;
	do {
		const response = await raidboxesApiRequest.call(this, 'GET', endpoint, {}, {
			...qs,
			per_page: 100,
			page,
		});
		const data = extractList(response);
		items.push(...data);
		// Live API uses camelCase (lastPage), the OpenAPI spec says last_page
		const meta = response.meta as IDataObject | undefined;
		const last = meta?.lastPage ?? meta?.last_page;
		lastPage = last ? Number(last) : page;
		page++;
		if (limit > 0 && items.length >= limit) return items.slice(0, limit);
		if (data.length === 0) break;
	} while (page <= lastPage);
	return items;
}

/**
 * List endpoints are not uniform: most return `{ data: [...] }`, GET /v1/boxes returns `{ boxes: [...] }`.
 * Take `data` if it is an array, otherwise the first top-level array.
 */
export function extractList(response: IDataObject): IDataObject[] {
	if (Array.isArray(response.data)) return response.data as IDataObject[];
	for (const [key, value] of Object.entries(response)) {
		if (key !== 'meta' && key !== 'links' && Array.isArray(value)) return value as IDataObject[];
	}
	if (response.data && typeof response.data === 'object') return [response.data as IDataObject];
	return [];
}

/** Async operations answer with 202 and a process object; extract its id if present. */
export function getProcessId(response: IDataObject): string | undefined {
	// Docs show the process both at top level and wrapped in `data`
	const data = (response.data ?? {}) as IDataObject;
	const id = data.process_id ?? data.processId ?? response.process_id ?? response.processId;
	return typeof id === 'string' && id !== '' ? id : undefined;
}

export interface PollOptions {
	pollIntervalSeconds: number;
	timeoutMinutes: number;
}

/**
 * Generic poll loop: calls `check` until it returns a result, or throws after the timeout.
 * `describe` returns the last known state for the timeout message.
 */
export async function pollUntil(
	this: IExecuteFunctions,
	itemIndex: number,
	opts: PollOptions,
	what: string,
	check: () => Promise<IDataObject | undefined>,
	describe: () => string,
): Promise<IDataObject> {
	const deadline = Date.now() + opts.timeoutMinutes * 60_000;
	while (true) {
		const result = await check();
		if (result) return result;
		if (Date.now() > deadline) {
			throw new NodeOperationError(this.getNode(), `${what} did not finish within ${opts.timeoutMinutes} minutes`, {
				itemIndex,
				description: describe(),
			});
		}
		await sleep(opts.pollIntervalSeconds * 1000);
	}
}

/**
 * POST /v1/boxes/{id}/backups answers 202 without a body (no process id).
 * Wait until the backup list reports no running backup and return the newest backup with the given name.
 */
export async function waitForBackup(
	this: IExecuteFunctions,
	boxId: string,
	itemIndex: number,
	opts: PollOptions,
	match: (backups: IDataObject[]) => IDataObject | undefined,
	what: string,
): Promise<IDataObject> {
	let last = 'unknown';
	return pollUntil.call(this, itemIndex, opts, what, async () => {
		const response = await raidboxesApiRequest.call(this, 'GET', `/v1/boxes/${encodeURIComponent(boxId)}/backups`, {}, {
			box_id: boxId,
			per_page: 100,
		});
		const backups = extractList(response);
		last = `has_in_progress_backup: ${String(response.has_in_progress_backup)}, backups: ${backups.length}`;
		if (response.has_in_progress_backup === true) return undefined;
		if (backups.some((b) => String(b.status ?? '').includes('in_progress'))) return undefined;
		return match(backups);
	}, () => `Last state: ${last}`);
}

const DONE_STATES = ['completed', 'finished', 'done', 'success', 'succeeded'];
const FAILED_STATES = ['failed', 'error', 'cancelled', 'canceled'];

export async function waitForProcess(
	this: IExecuteFunctions,
	processId: string,
	itemIndex: number,
	pollIntervalSeconds = 10,
	timeoutMinutes = 30,
): Promise<IDataObject> {
	const deadline = Date.now() + timeoutMinutes * 60_000;
	while (true) {
		const response = await raidboxesApiRequest.call(this, 'GET', `/v1/processes/${processId}`);
		const process = (response.data as IDataObject) ?? response;
		const status = String(process.status ?? '').toLowerCase();

		if (DONE_STATES.includes(status)) return process;
		if (FAILED_STATES.includes(status)) {
			throw new NodeOperationError(this.getNode(), `Raidboxes process ${processId} ended with status "${status}"`, {
				itemIndex,
				description: JSON.stringify(process.meta_data ?? process),
			});
		}
		if (Date.now() > deadline) {
			throw new NodeOperationError(this.getNode(), `Raidboxes process ${processId} did not finish within ${timeoutMinutes} minutes`, {
				itemIndex,
				description: `Last status: "${status}", progress: ${process.progress ?? '?'} %`,
			});
		}
		await sleep(pollIntervalSeconds * 1000);
	}
}

/** Splits a comma or newline separated string into a trimmed array. */
export function toList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((v) => v.trim())
		.filter((v) => v !== '');
}

/** Removes keys whose value is an empty string so PATCH requests only send what the user set. */
export function compact(obj: IDataObject): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value === '' || value === undefined) continue;
		result[key] = value;
	}
	return result;
}
