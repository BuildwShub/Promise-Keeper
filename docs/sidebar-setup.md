# Gmail sidebar served from Vercel (alternate-runtime add-on)

The sidebar calls three endpoints on the web app: `/api/addon/homepage`, `/api/addon/message` and `/api/addon/action`.
Every request is verified: the Authorization bearer must be a Google-signed system ID token whose audience is one of these
endpoints and whose email is the add-on's service account; the `userIdToken` must be Google-signed for the add-on's OAuth client.
Without `ADDON_SERVICE_ACCOUNT_EMAIL` and `ADDON_OAUTH_CLIENT_ID` set, every request is rejected.

## One-time setup (Google Cloud Shell, nothing to install)
1. Google Auth Platform > Data access: add `gmail.addons.execute`, `gmail.addons.current.message.metadata` and `userinfo.email`.
2. Open https://shell.cloud.google.com and select the project that holds the OAuth client.
3. Enable the APIs and read the add-on identity:
   ```bash
   gcloud services enable gsuiteaddons.googleapis.com appsmarket-component.googleapis.com
   gcloud workspace-add-ons get-authorization
   ```
   Copy `serviceAccountEmail` and `oauthClientId`.
4. In Vercel > Environment Variables add `ADDON_SERVICE_ACCOUNT_EMAIL` and `ADDON_OAUTH_CLIENT_ID`, then redeploy.
5. Create `deployment.json` in Cloud Shell (contents: [`docs/deployment.json`](deployment.json)), then:
   ```bash
   gcloud workspace-add-ons deployments create promise-keeper --deployment-file=deployment.json
   gcloud workspace-add-ons deployments install promise-keeper
   ```
6. Reload Gmail. Open any email: the Promise Keeper icon appears in the right-hand side panel.

To change the endpoints later: `gcloud workspace-add-ons deployments replace promise-keeper --deployment-file=deployment.json`.
