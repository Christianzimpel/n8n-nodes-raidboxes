// Offline test: runs every operation against a fake Raidboxes API and checks method, path, query and body.
const assert = require('assert');
const { Raidboxes } = require('../dist/nodes/Raidboxes/Raidboxes.node.js');
const { RaidboxesApi, totp } = require('../dist/credentials/RaidboxesApi.credentials.js');
const { rateLimitDelay, raidboxesErrorMessage } = require('../dist/nodes/Raidboxes/GenericFunctions.js');

function fakeApi(req) {
	const { method, url } = req;
	const path = url.replace('https://api.raidboxes.io', '');
	if (method === 'GET' && path === '/v1/boxes' && req.qs.search === 'Neu') {
		return { boxes: fakeApi.boxCreated ? [{ id: 'old', title: 'Neu' }, { id: 'NEWBOX', title: 'Neu' }] : [{ id: 'old', title: 'Neu' }], meta: { lastPage: 1 } };
	}
	if (method === 'GET' && path === '/v1/boxes' && !req.qs.search && fakeApi.boxCreateTest) {
		return { boxes: [{ id: 'old', title: 'Neu' }], meta: { lastPage: 1 } };
	}
	if (method === 'GET' && path === '/v1/boxes') {
		const page = req.qs.page;
		return { boxes: [{ id: `b${page}`, title: `Box ${page}`, domain: `site${page}.de` }], meta: { lastPage: 3 } }; // shape of the live API
	}
	if (method === 'GET' && path === '/v1/ssh-keys' && !fakeApi.limited) {
		fakeApi.limited = true;
		const err = new Error('Too Many Requests'); err.httpCode = '429'; err.response = { headers: { 'x-ratelimit-reset': '0.01' } };
		throw err;
	}
	if (method === 'GET' && path === '/v1/ssh-keys') return { data: [{ id: 'k1' }], meta: { last_page: 1 } };
	if (method === 'POST' && path === '/v1/boxes') { fakeApi.boxCreated = true; return { data: { process_id: 'p-2', status: 'accepted' } }; }
	if (method === 'GET' && path === '/v1/processes/p-2') return { data: { process_id: 'p-2', status: 'accepted' } }; // never moves (live behaviour)
	if (method === 'POST' && path.endsWith('/backups')) { fakeApi.backupPolls = 0; return undefined; } // live: 202 without body
	if (method === 'GET' && path.endsWith('/backups')) {
		fakeApi.backupPolls = (fakeApi.backupPolls || 0) + 1;
		const running = fakeApi.backupPolls < 2;
		return {
			data: running
				? [{ id: 'NEW', name: null, status: 'backup_in_progress', restorable: false, created_at: null }]
				: [{ id: 'NEW', name: 'vor Update', status: null, restorable: true, created_at: new Date().toISOString() }, { id: 'OLD', name: 'vor Update', restorable: true, created_at: '2020-01-01T00:00:00+00:00' }],
			has_in_progress_backup: running,
			meta: { lastPage: 1 },
		};
	}
	if (method === 'GET' && path === '/v1/processes/p-1') {
		fakeApi.polls = (fakeApi.polls || 0) + 1;
		return { data: { process_id: 'p-1', status: fakeApi.polls < 2 ? 'in_progress' : 'completed', progress: 100 } };
	}
	if (path.endsWith('/metrics/cpu')) return { data: { values: ['1.5', '2'], labels: ['t1', 't2'] } };
	if (path === '/v1/wordpress/versions') return { data: { data: ['6.8.1', '6.7.2'] } };
	if (method === 'DELETE' || method === 'PATCH') return undefined; // 204
	return { data: { ok: true } };
}

function makeContext(params, calls) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback, opts) => {
			const v = name in params ? params[name] : fallback;
			if (v && typeof v === 'object' && 'mode' in v && opts && opts.extractValue) return v.value;
			if (v === undefined) throw new Error(`missing param ${name}`);
			return v;
		},
		getNode: () => ({ name: 'Raidboxes', type: 'raidboxes', typeVersion: 1, parameters: {} }),
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async (cred, req) => {
				assert.strictEqual(cred, 'raidboxesApi');
				calls.push(req);
				return fakeApi(req);
			},
		},
	};
}

async function run(params) {
	const calls = [];
	const node = new Raidboxes();
	const out = await node.execute.call(makeContext(params, calls));
	return { calls, out: out[0].map((x) => x.json) };
}

const box = { mode: 'id', value: '42' };
const short = (c) => `${c.method} ${c.url.replace('https://api.raidboxes.io', '')}`;

(async () => {
	// pagination: 3 pages, returnAll
	let r = await run({ resource: 'box', operation: 'getAll', returnAll: true, filters: { search: 'shop', sort: '' } });
	assert.strictEqual(r.out.length, 3);
	assert.deepStrictEqual(r.calls[0].qs, { search: 'shop', per_page: 100, page: 1 });

	// limit stops early
	r = await run({ resource: 'box', operation: 'getAll', returnAll: false, limit: 1, filters: {} });
	assert.strictEqual(r.calls.length, 1);
	assert.strictEqual(r.out.length, 1);

	// backup create + wait for process
	r = await run({ resource: 'backup', operation: 'create', boxId: box, name: 'vor Update', waitForCompletion: true, pollingOptions: { pollInterval: 0.01 } });
	assert.strictEqual(short(r.calls[0]), 'POST /v1/boxes/42/backups');
	assert.deepStrictEqual(r.calls[0].body, { name: 'vor Update', box_id: '42' });
	assert.strictEqual(r.out[0].id, 'NEW'); // newest finished backup with that name
	assert.strictEqual(r.calls.filter((c) => c.method === 'GET' && c.url.endsWith('/backups')).length, 2);

	// backup delete sends box_id/backup_id in query
	r = await run({ resource: 'backup', operation: 'delete', boxId: box, backupId: 'uuid-1', waitForCompletion: false });
	assert.strictEqual(short(r.calls[0]), 'DELETE /v1/boxes/42/backups/uuid-1');
	assert.deepStrictEqual(r.calls[0].qs, { box_id: '42', backup_id: 'uuid-1' });
	assert.deepStrictEqual(r.out[0], { success: true });

	// cache clear varnish
	r = await run({ resource: 'cache', operation: 'clear', boxId: box, cacheType: 'varnish' });
	assert.strictEqual(short(r.calls[0]), 'DELETE /v1/boxes/42/cache/varnish');

	// cache settings with rules list
	r = await run({ resource: 'cache', operation: 'updateSettings', boxId: box, settings: { cache: true, cache_rules: '/cart\n/checkout' } });
	assert.deepStrictEqual(r.calls[0].body, { box_id: '42', cache: true, cache_rules: ['/cart', '/checkout'] });

	// metrics split
	r = await run({ resource: 'box', operation: 'getMetrics', boxId: box, metric: 'cpu', splitMetrics: true });
	assert.deepStrictEqual(r.out, [{ timestamp: 't1', value: 1.5 }, { timestamp: 't2', value: 2 }]);

	// settings for many boxes
	r = await run({ resource: 'setting', operation: 'getMany', manyArea: 'php', boxIds: '1, 2' });
	assert.strictEqual(short(r.calls[0]), 'GET /v1/boxes/php/settings');
	assert.deepStrictEqual(r.calls[0].qs, { ids: ['1', '2'] });
	assert.strictEqual(r.calls[0].arrayFormat, 'brackets');

	// php update
	r = await run({ resource: 'setting', operation: 'updatePhp', boxId: box, phpSettings: { version: '8.3', memory_limit: 512 } });
	assert.deepStrictEqual(r.calls[0].body, { box_id: '42', settings: { version: '8.3', memory_limit: 512 } });

	// wordpress versions
	r = await run({ resource: 'wordPress', operation: 'getVersions' });
	assert.deepStrictEqual(r.out, [{ version: '6.8.1' }, { version: '6.7.2' }]);

	// subscription item cancel revoke
	r = await run({ resource: 'subscription', operation: 'revokeItemsCancellation', subscriptionId: 's1', items: 'a,b' });
	assert.strictEqual(short(r.calls[0]), 'DELETE /v1/subscriptions/s1/items/cancel');
	assert.deepStrictEqual(r.calls[0].qs, { subscription_id: 's1', items: ['a', 'b'] });

	// box create with subscription
	r = await run({
		resource: 'box', operation: 'create', title: 'Neue Seite', planSource: 'subscription', subscriptionId: '7',
		wordpressVersion: '6.8.1', adminUsername: 'admin_x', adminPassword: 'pw', additionalFields: { callback_url: '' }, waitForCompletion: false,
	});
	assert.deepStrictEqual(r.calls[0].body, {
		title: 'Neue Seite', wordpress: { version: '6.8.1', admin_username: 'admin_x', admin_password: 'pw' }, subscription_id: '7',
	});

	// list search for box picker
	const searchCtx = makeContext({}, []);
	const list = await new Raidboxes().methods.listSearch.searchBoxes.call(searchCtx, 'site');
	assert.strictEqual(list.results[0].name, 'Box 1 (site1.de)');

	// credentials: token from response header
	const cred = new RaidboxesApi();
	const token = await cred.preAuthentication.call(
		{ helpers: { httpRequest: async (o) => { assert.strictEqual(o.url, 'https://api.raidboxes.io/v1/login'); assert.strictEqual(o.returnFullResponse, true); return { headers: { access_token: 'Bearer abc.def' }, body: {} }; } } },
		{ email: 'a@b.de', password: 'x' },
	);
	assert.deepStrictEqual(token, { sessionToken: 'abc.def' });

	// box create: process stays "accepted", node detects the new box instead
	fakeApi.boxCreateTest = true;
	r = await run({
		resource: 'box', operation: 'create', title: 'Neu', planSource: 'performanceLevel', performanceLevel: '1',
		wordpressVersion: '6.8.1', adminUsername: 'a', adminPassword: 'b', additionalFields: {}, waitForCompletion: true, pollingOptions: { pollInterval: 0.01 },
	});
	assert.strictEqual(r.out[0].id, 'NEWBOX');
	assert.strictEqual(r.out[0].process_status, 'accepted');
	fakeApi.boxCreateTest = false;

	// box filters
	r = await run({ resource: 'box', operation: 'getAll', returnAll: false, limit: 1, filters: { ownership: true, staging: false } });
	assert.strictEqual(r.calls[0].qs['filter[ownership]'], 1);
	assert.strictEqual(r.calls[0].qs['filter[staging]'], 0);

	// 429 is retried
	r = await run({ resource: 'sshKey', operation: 'getAll', returnAll: true });
	assert.strictEqual(r.calls.length, 2);
	assert.strictEqual(rateLimitDelay({}, 1), 30000);

	// TOTP: RFC 6238 test vector (SHA-1, T=59s -> 94287082, last 6 digits)
	assert.strictEqual(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082');
	assert.strictEqual(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1111111109_000), '081804');

	// login sends code when a 2FA secret is set
	let sentBody;
	await cred.preAuthentication.call(
		{ helpers: { httpRequest: async (o) => { sentBody = o.body; return { headers: { access_token: 't' } }; } } },
		{ email: 'a@b.de', password: 'x', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' },
	);
	assert.match(sentBody.code, /^\d{6}$/);

	// error text from the real 422 response
	const real422 = { timestamp: 'x', path: '/v1/boxes/IP1Q6HQC/backups', message: 'Unprocessable Entity (422) Response: {"message":"product_management.box.box_id.in_progress|default:Currently your BOX is being backed up or restored. Please wait for this process to finish","errors":{"box_id":[{"i18n":"x","message":"Currently your BOX is being backed up or restored. Please wait for this process to finish"}]}}' };
	assert.strictEqual(raidboxesErrorMessage(real422), 'Currently your BOX is being backed up or restored. Please wait for this process to finish');
	assert.strictEqual(raidboxesErrorMessage({ message: 'a.b|default:Nope' }), 'Nope');
	assert.strictEqual(raidboxesErrorMessage({ message: 'Unauthenticated.' }), 'Unauthenticated.');
	assert.strictEqual(raidboxesErrorMessage(real422.message), 'Currently your BOX is being backed up or restored. Please wait for this process to finish');

	// a NodeApiError thrown by n8n gets the readable message
	const { NodeApiError } = require('n8n-workflow');
	const ctxNode = { name: 'Raidboxes', type: 'raidboxes', typeVersion: 1, parameters: {} };
	const failing = makeContext({ resource: 'box', operation: 'get', boxId: box }, []);
	failing.helpers.httpRequestWithAuthentication = async () => {
		const e = new NodeApiError(ctxNode, { message: 'Request failed with status code 422', response: { status: 422, data: real422 } });
		throw e;
	};
	await assert.rejects(new Raidboxes().execute.call(failing), /Raidboxes: Currently your BOX is being backed up/);

	console.log('All mock tests passed');
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
