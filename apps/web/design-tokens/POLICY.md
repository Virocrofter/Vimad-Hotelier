# Token contract policy (DS-03)

- `tokens.json` is the only source of truth. The generated files are build artifacts — never hand-edit; change the JSON and `npm run tokens:build`.
- **Semver on the contract.** PATCH = value tweak with no visual intent change (contrast fix). MINOR = additive tokens (new names). MAJOR = rename, removal, type/unit change, or selector-structure change. Record every change in CHANGELOG.md with the bump.
- **Deprecations get a window.** A token slated for removal stays one full MINOR release with its name listed under a `deprecated` note in the changelog before deletion. No same-release delete.
- Breaking bumps require regenerating + a visual spot-check (login page + dashboard, both themes) before commit.
- New raw hex belongs ONLY in `tokens.json`. Hand-written CSS must consume `var(--*)`.
