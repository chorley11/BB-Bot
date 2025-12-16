# Railway Deployment Troubleshooting

If you're seeing errors about `@fireflyprotocol/bluefin-v2-client-ts` not found, Railway might be using a cached build.

## Solution Steps

1. **Verify Latest Commit is Deployed:**
   - In Railway dashboard, check the "Deployments" tab
   - Ensure the latest commit (with correct package.json) is being deployed
   - If not, trigger a new deployment manually

2. **Clear Railway Build Cache:**
   - Go to your Railway project settings
   - Look for "Clear Build Cache" or similar option
   - Clear the cache and redeploy

3. **Force Redeploy:**
   - In Railway dashboard, go to your service
   - Click "Redeploy" or "Deploy Latest Commit"
   - This will force Railway to pull the latest code from GitHub

4. **Verify Environment:**
   - Ensure Railway is connected to the correct GitHub branch (usually `main`)
   - Check that Railway is pulling from the latest commit

## Current Package Dependencies (Correct)

The repository now uses:
- `@bluefin-exchange/bluefin-v2-client` (not `@fireflyprotocol/bluefin-v2-client-ts`)
- `@mysten/sui` (not `@mysten/sui.js`)

## Manual Verification

You can verify the correct packages are in GitHub:
```bash
curl https://raw.githubusercontent.com/chorley11/BB-Bot/main/package.json | grep -A 5 dependencies
```

Should show:
```json
"dependencies": {
  "@bluefin-exchange/bluefin-v2-client": "^6.5.1",
  "@mysten/sui": "^1.45.2",
  ...
}
```

## npm Warning About Production Config

If you see this warning:
```
npm warn config production Use `--omit=dev` instead.
```

**This is harmless** - it's just npm warning about deprecated configuration. The build will still succeed. Railway may set this internally, but it doesn't affect the installation since we need devDependencies (TypeScript) for the build anyway.

## If Issue Persists

1. Disconnect and reconnect the GitHub repository in Railway
2. Create a new Railway project and connect fresh
3. Check Railway build logs for the exact commit hash being built

