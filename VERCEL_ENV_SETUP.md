# Setting Up Environment Variables in Vercel

## Option 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project: `tepui-ventures-field-production-app`
3. Click on **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Name**: `NEXT_PUBLIC_INSTANT_APP_ID`
   - **Value**: `f9eab271-a9fe-45dc-a367-a42eeee71b91`
   - **Environments**: Check all (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** your application:
   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Click **Redeploy**

## Option 2: Vercel CLI (Alternative)

If you prefer using the CLI, you can set it interactively:

```bash
vercel env add NEXT_PUBLIC_INSTANT_APP_ID
```

When prompted:
- Enter the value: `f9eab271-a9fe-45dc-a367-a42eeee71b91`
- Select environments: Production, Preview, Development

Then redeploy:
```bash
vercel --prod
```

## Option 3: Using .env file (for local development only)

Create a `.env.local` file in your project root:

```
NEXT_PUBLIC_INSTANT_APP_ID=f9eab271-a9fe-45dc-a367-a42eeee71b91
```

**Note**: This only works locally. For Vercel, you must use Option 1 or 2 above.

## After Adding the Environment Variable

1. **Redeploy** your application (important - environment variables are only loaded during build)
2. Test the login functionality again

The magic code authentication should work once the environment variable is set and the app is redeployed.

