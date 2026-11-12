# Security Policy

## Supported Versions

| Version | Security support |
| --- | --- |
| Latest stable GitHub release (currently `v2.2.0`) | Security fixes target the latest stable release; upgrade when a fix is released. |
| Current integration branch (`v2.3`) | Pre-release development and triage only; not a supported production release. |
| Older releases | No maintained security backports; upgrade to the latest stable release. |

The published [GitHub releases](https://github.com/SecureToolsProject/Secure_Tools/releases) identify the stable version. Update this policy when promoting a new release.

## Reporting a Vulnerability

Use [GitHub Private Vulnerability Reporting](https://github.com/SecureToolsProject/Secure_Tools/security/advisories/new), or open this repository's **Security → Advisories → Report a vulnerability** flow. A GitHub account is required. Reports go privately to repository maintainers.

**Do not open public issues or pull requests for undisclosed vulnerabilities.** Do not include sensitive user files, real personal/confidential documents, credentials, or private keys, even in a private report. Treat input bytes as potentially malicious; use a minimal, synthetic, non-sensitive reproduction and explain any risk before attaching a sample.

Include:

- The affected release, commit, tool and deployment URL, when known.
- Expected and observed behavior, impact, and minimal reproduction steps.
- Relevant browser/version details and redacted diagnostics.

If the private reporting form is unavailable, do not guess an email address or publish exploit details. Repository owners must restore and verify the private route; wait for it before sharing the report.

## Scope

Security-relevant reports include privacy-invariant bypasses; unexpected network requests or file uploads; XSS/CSP bypasses; malicious-file handling, parser or resource-exhaustion bugs; dependency/supply-chain issues; and deployment/provenance failures.

Local processing does not eliminate browser, dependency or hosting trust boundaries. Successful parsing does not prove that a file is safe or fully sanitized. See the [privacy model](docs/privacy-model.md) for bounded guarantees.

## Non-goals and Limits

The project does not claim formal security certification. Reporting a vulnerability does not imply a bounty or other payment. General feature requests and unsupported-format bugs without a security impact belong in normal issues; uncertain security reports should use the private route first.

## Disclosure Process

Maintainers aim to acknowledge receipt, reproduce and triage the issue, coordinate a fix and verification with the reporter, and publish an advisory or release notes when appropriate. Please coordinate public disclosure so users can receive a fix or mitigation first.

No fixed response or remediation timeline is promised. Keep discussion and reproduction details private until disclosure is coordinated.
