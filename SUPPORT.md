# Support and compatibility

Alpha software with community support and no SLA. Questions and bugs go to
GitHub issues on this repository; `support@liquidlm.com` is the fallback
channel.

Assistant clients change their configuration formats without notice; an adapter
is advertised as supported only after the exact client version has been
exercised and recorded in `manifest.json` (`testedClients`). Adapters without
an entry are format candidates, not supported integrations.

Current state: the installer semantics (install, repeated install, update,
hand-edit detection, uninstall, backup) are covered by dependency-free Node
tests. Adapters are added to `testedClients` as interactive checks complete;
check `manifest.json` for the current verification state.

Obsolete adapters are deprecated explicitly in the changelog, never silently
reformatted. The conventions' semantic version is the `manifest.json` version;
the CLI bundles a pinned copy identified by the same SHA-256.
