# Contributing to SatSentry

SatSentry is MIT-licensed free and open-source software built as public security infrastructure for Bitcoin and Lightning node operators.

## Adding or Updating a Security Advisory

All advisories live in `src/lib/advisories.ts` (and the zero-dependency CLI mirror in `bin/satsentry.mjs`).

Every advisory PR must include:

1. **Primary-source URL**: Direct link to `bitcoincore.org/en/security-advisories/`, an upstream GitHub Security Advisory (`GHSA-*`), or an official upstream release note.
2. **Exact version range clauses**: Machine-evaluable `affectedClauses` (`minInclusive`, `minExclusive`, `maxInclusive`, `maxExclusive`) verified against upstream release notes.
3. **Unit tests**: Add regression tests in `tests/audit-engine.test.ts` verifying both a vulnerable version and the patched release.

## Responsible Disclosure Rule

**Never** submit unpatched zero-day vulnerability details, exploit code, or reproduction steps via public GitHub issues or pull requests. Report upstream flaws privately via each project's `SECURITY.md` first; add entries to SatSentry only after official public disclosure or patched release publication.

## Local Verification

```bash
npm run typecheck
npm test
npm run build
```
