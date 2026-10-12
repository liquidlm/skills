# Contributing

Edit `conventions.md` and regenerate artifacts with `node
scripts/emit-adapters.mjs`; drift checks and tests must pass. Adapters contain
only client syntax and installation metadata — behavior lives in the canonical
document.

Do not add client adapters without testing the exact client format; mark
untested formats as candidates in `manifest.json` rather than advertising them.
Never commit tokens, real user endpoints or screenshots containing private
content.

Draft contribution policy: Developer Certificate of Origin (DCO) sign-off,
maintainer review and passing required checks, subject to maintainer acceptance
before first publication.
