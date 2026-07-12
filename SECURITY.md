# Security Policy

CAP Trellis handles sensitive personal information about low-income households —
income, household composition, disability and health-insurance status, housing
status, and uploaded eligibility documents. We treat every report seriously.

## Reporting a vulnerability

Please email **dchevalier@caclv.org** with the details (steps to reproduce,
affected routes/files, impact). Do **not** open a public GitHub issue for
security reports.

You can expect an acknowledgment within 5 business days. Please give us a
reasonable window to ship a fix before public disclosure.

## Scope notes for deployers

- Always deploy behind HTTPS. The provided Docker compose file terminates TLS
  with Caddy (automatic Let's Encrypt). `CSBG_ALLOW_HTTP=1` exists for isolated
  LAN staging only and must never be set on an internet-facing deployment.
- The client portal link is a capability URL — anyone with the link can view that
  application's status page and upload documents. Tokens are 256-bit random;
  treat portal links like passwords when sharing them with clients.
- Database credentials and session secrets come from environment variables; no
  secrets are stored in the repository or the database.
- Sign-in attempts are rate-limited per account and per address; sessions are
  httpOnly, SameSite=Lax, Secure in production.
- Uploaded files are extension- and magic-byte-checked, size-capped, stored
  outside the web root, and served with `Cache-Control: private, no-store`.

## Supported versions

Pre-1.0: only the latest release receives security fixes.
