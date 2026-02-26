# Update Distribution

This project uses GitHub Releases as the default update source, with an EdgeOne proxy as fallback for domestic network conditions.

## Sources

- Primary: `https://github.com/wangxu-dev/ksu-app/releases/download`
- Fallback: `https://edgeone.gh-proxy.org/https://github.com/wangxu-dev/ksu-app/releases/download`

Update source constants are defined in `electron/updater/sources.cjs`.

## Client Runtime Dependency

The app-side update client uses `electron-updater`.

- Install command: `npm install electron-updater`
- If this dependency is not installed, app update actions are disabled safely and the app continues to run normally.

## Release Artifacts

The release workflow publishes:

- Installers: `.exe`, `.dmg`, `.AppImage`
- Updater metadata: `.yml`
- Differential update files: `.blockmap`
- macOS updater package: `.zip`

These files are required to support future `electron-updater` integration.
