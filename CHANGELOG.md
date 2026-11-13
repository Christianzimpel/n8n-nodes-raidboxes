# Changelog

## 0.2.3
- Fix release workflow (version check). No code changes.

## 0.2.2
- Passes the official n8n community node linter (@n8n/eslint-plugin-community-nodes): themed icons, documentation URL, error handling.

## 0.2.1
- Readable Raidboxes error messages (e.g. "Currently your BOX is being backed up or restored").

## 0.2.0
- Backup create/delete/restore: wait by watching the backup list (API returns 202 without a process id).
- Box create: wait for the new Box to appear (process status can stay `accepted`).
- Default polling: every 30 s, timeout 120 min.

## 0.1.x
- List endpoints: support `boxes` instead of `data` and camelCase pagination (`lastPage`).
- 2FA via TOTP secret, retry on HTTP 429, Box filters (ownership, staging).
- Initial release covering all endpoints of the Raidboxes API v1.
