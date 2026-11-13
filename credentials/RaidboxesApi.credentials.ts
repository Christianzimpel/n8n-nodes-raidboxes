import { createHmac } from 'crypto';
import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

export class RaidboxesApi implements ICredentialType {
	name = 'raidboxesApi';

	displayName = 'Raidboxes API';

	documentationUrl = 'https://github.com/Christianzimpel/n8n-nodes-raidboxes#credentials';

	icon = {
		light: 'file:../nodes/Raidboxes/raidboxes.svg',
		dark: 'file:../nodes/Raidboxes/raidboxes.dark.svg',
	} as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@example.com',
			default: '',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: '2FA Secret',
			name: 'totpSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Only needed if two-factor authentication is enabled. The Base32 secret shown when setting up 2FA (the text behind the QR code). n8n then generates the 6-digit code for each login itself.',
		},
		{
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
	];

	// Raidboxes returns the JWT in the "access_token" response header of POST /v1/login.
	// n8n calls this again automatically whenever a request answers with 401.
	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://api.raidboxes.io/v1/login',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: {
				email: credentials.email,
				password: credentials.password,
				...(credentials.totpSecret ? { code: totp(credentials.totpSecret as string) } : {}),
			},
			json: true,
			returnFullResponse: true,
		})) as { headers: Record<string, string | string[] | undefined> };

		const header = response.headers['access_token'] ?? response.headers['access-token'];
		const token = Array.isArray(header) ? header[0] : header;
		if (!token) {
			throw new Error('Raidboxes login succeeded but no access_token header was returned');
		}
		return { sessionToken: token.replace(/^Bearer\s+/i, '') };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.raidboxes.io',
			url: '/v1/ssh-keys',
			method: 'GET',
		},
	};
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a Base32 secret. */
export function totp(secret: string, timestamp = Date.now()): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	const clean = secret.replace(/[\s=-]/g, '').toUpperCase();
	let bits = '';
	for (const char of clean) {
		const val = alphabet.indexOf(char);
		if (val === -1) throw new Error('2FA secret is not valid Base32');
		bits += val.toString(2).padStart(5, '0');
	}
	const bytes: number[] = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));

	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 1000 / 30)));
	const hmac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return code.toString().padStart(6, '0');
}
