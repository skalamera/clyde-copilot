# Clyde release checklist

Use this before tagging a public or beta Windows release.

## Required checks

Run from the repo root:

```powershell
npm run release:check
```

This runs:

- `npm test`
- `npm run renderer:build`
- `npm run audio-engine:build`
- `npm run pack`

The unpacked app should be created at `dist/win-unpacked`.

## Manual QA

Test the packaged app from `dist/win-unpacked/Clyde.exe`.

- First launch opens without setup errors.
- Sign up and sign in work.
- Pro entitlement refresh works.
- Audio device refresh, microphone capture, and system audio capture work.
- Interview capture starts, stops, saves, and grades.
- Meeting capture starts, stops, saves notes, and extracts action items.
- Mock interview manual stop saves the transcript and scorecard.
- Mock interview unexpected disconnect saves the transcript and scorecard.
- Gmail and Google Calendar connect, scan, approve, dismiss, and audit actions.
- Calendar event creation, editing, and deletion work.
- Capture Protection behavior matches the user guide on the target OS.

## Production configuration

Confirm these are set in the release environment:

- Supabase URL and anon key
- Stripe secret key, webhook secret, price ID, and customer portal settings
- `APP_URL` for billing redirects
- Google OAuth client ID and optional client secret
- LiveAvatar API key
- GitHub token for release publishing
- `CLYDE_ENABLE_AUTO_UPDATE=1` only after the GitHub release feed is public or authenticated for users

## Website and legal

- Website download link points to the intended installer.
- Privacy Policy and Terms pages are published.
- Support email works.
- Data deletion instructions are present in the Privacy Policy.

## Version and tag

1. Update `package.json` version.
2. Commit the release changes.
3. Tag with `vX.Y.Z`.
4. Push the tag to trigger `.github/workflows/build.yml`.
