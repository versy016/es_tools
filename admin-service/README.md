# ES Tools — Admin service (Cognito user management)

AWS Lambda that powers the **Users** screen: list users, activate/deactivate, set role
(via Cognito groups), invite, and an audit log. One `POST` endpoint, `body.action`:

| action | payload | does |
|---|---|---|
| `list` | – | returns `{ users:[{username,name,email,role,active,tools}], audit:[{who,what,when}] }` |
| `setActive` | `{ username, active }` | enable / disable the Cognito user |
| `setRole` | `{ username, role }` | move user to the role's Cognito group |
| `invite` | `{ email, role }` | `AdminCreateUser` + add to group |

`actor` (optional) is recorded in the audit log.

## Environment
| Var | Example | Notes |
|---|---|---|
| `USER_POOL_ID` | `ap-southeast-2_xxxxxxx` | Cognito user pool (from `amplifyconfiguration.json`) |
| `ROLE_GROUPS` | `Admin,Manager,Surveyor` | Cognito groups treated as roles (create these in the pool) |
| `AUDIT_TABLE` | `estools-audit` | optional DynamoDB table (`id` string PK) for the audit log |

## Deploy (Lambda + API Gateway)
```bash
cd admin-service
npm install
zip -r function.zip index.js node_modules package.json
```
1. Create a Node.js 18+ Lambda, upload `function.zip`, handler `index.handler`, set env vars.
2. Attach an IAM policy allowing on the user pool:
   `cognito-idp:ListUsers, AdminEnableUser, AdminDisableUser, AdminListGroupsForUser,
   AdminAddUserToGroup, AdminRemoveUserFromGroup, AdminCreateUser` — and if using audit,
   `dynamodb:PutItem, dynamodb:Scan` on the table.
3. Create the role groups in Cognito (Admin / Manager / Surveyor).
4. Add an API Gateway (HTTP API, `POST /admin`), enable CORS, **protect it** (Cognito
   authorizer recommended — only admins should call it).
5. Point the web app at it:
   ```
   # es_tools/.env
   REACT_APP_ADMIN_ENDPOINT=https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/admin
   ```
Until this is set, the Users screen shows a "not connected" empty state (no mock data).

## Security
Restrict the endpoint to admins (e.g. Cognito authorizer + check the caller's group), since
these actions manage accounts. The Lambda itself does not currently enforce caller identity.
