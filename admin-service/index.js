// AWS Lambda for ES Tools user management (Cognito admin) + audit log.
// One POST endpoint; body = { action, ...payload }. Actions: list | setActive | setRole | invite.
// Config via env: USER_POOL_ID (required), AUDIT_TABLE (optional DynamoDB table),
// ROLE_GROUPS (csv, default "Admin,Manager,Surveyor").

const {
    CognitoIdentityProviderClient, ListUsersCommand, AdminEnableUserCommand,
    AdminDisableUserCommand, AdminListGroupsForUserCommand, AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand, AdminCreateUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
};

const POOL = process.env.USER_POOL_ID;
const AUDIT_TABLE = process.env.AUDIT_TABLE || '';
const ROLE_GROUPS = (process.env.ROLE_GROUPS || 'Admin,Manager,Surveyor').split(',').map((s) => s.trim());

const cognito = new CognitoIdentityProviderClient({});
const ddb = AUDIT_TABLE ? new DynamoDBClient({}) : null;

const attr = (user, name) => (user.Attributes || user.UserAttributes || []).find((a) => a.Name === name)?.Value || '';
const methodOf = (e) => e.httpMethod || (e.requestContext && e.requestContext.http && e.requestContext.http.method);
const reply = (code, body) => ({ statusCode: code, headers: CORS, body: JSON.stringify(body) });

const writeAudit = async (who, what) => {
    if (!ddb) return;
    try {
        await ddb.send(new PutItemCommand({
            TableName: AUDIT_TABLE,
            Item: { id: { S: `${Date.now()}_${Math.random().toString(36).slice(2)}` }, who: { S: who || 'Admin' }, what: { S: what }, ts: { N: String(Date.now()) } },
        }));
    } catch (e) { console.warn('audit write failed', e); }
};

const readAudit = async () => {
    if (!ddb) return [];
    try {
        const res = await ddb.send(new ScanCommand({ TableName: AUDIT_TABLE, Limit: 50 }));
        return (res.Items || [])
            .map((i) => ({ who: i.who?.S, what: i.what?.S, ts: Number(i.ts?.N || 0) }))
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 20)
            .map((a) => ({ who: a.who, what: a.what, when: new Date(a.ts).toLocaleString('en-AU') }));
    } catch (e) { console.warn('audit read failed', e); return []; }
};

const roleOfGroups = (groups) => ROLE_GROUPS.find((g) => groups.includes(g)) || 'Surveyor';

const listUsers = async () => {
    const out = [];
    let token;
    do {
        const res = await cognito.send(new ListUsersCommand({ UserPoolId: POOL, Limit: 60, PaginationToken: token }));
        for (const u of res.Users || []) {
            let groups = [];
            try {
                const g = await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: POOL, Username: u.Username }));
                groups = (g.Groups || []).map((x) => x.GroupName);
            } catch { /* ignore */ }
            out.push({
                username: u.Username,
                name: attr(u, 'name') || attr(u, 'email') || u.Username,
                email: attr(u, 'email'),
                role: roleOfGroups(groups),
                tools: [],
                active: u.Enabled !== false,
            });
        }
        token = res.PaginationToken;
    } while (token);
    return out;
};

exports.handler = async (event) => {
    if (methodOf(event) === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
    if (!POOL) return reply(500, { error: 'USER_POOL_ID not configured' });

    let body;
    try { body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {}); }
    catch { return reply(400, { error: 'Invalid JSON' }); }

    const { action, username, active, role, email, actor } = body;
    try {
        switch (action) {
            case 'list':
                return reply(200, { users: await listUsers(), audit: await readAudit() });

            case 'setActive':
                await cognito.send(active
                    ? new AdminEnableUserCommand({ UserPoolId: POOL, Username: username })
                    : new AdminDisableUserCommand({ UserPoolId: POOL, Username: username }));
                await writeAudit(actor, `${active ? 'activated' : 'deactivated'} ${username}`);
                return reply(200, { ok: true });

            case 'setRole': {
                const g = await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: POOL, Username: username }));
                for (const grp of (g.Groups || [])) {
                    if (ROLE_GROUPS.includes(grp.GroupName) && grp.GroupName !== role) {
                        await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL, Username: username, GroupName: grp.GroupName }));
                    }
                }
                await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL, Username: username, GroupName: role }));
                await writeAudit(actor, `set ${username} role to ${role}`);
                return reply(200, { ok: true });
            }

            case 'invite':
                await cognito.send(new AdminCreateUserCommand({
                    UserPoolId: POOL, Username: email,
                    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
                    DesiredDeliveryMediums: ['EMAIL'],
                }));
                if (role) await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL, Username: email, GroupName: role }));
                await writeAudit(actor, `invited ${email}${role ? ' as ' + role : ''}`);
                return reply(200, { ok: true });

            default:
                return reply(400, { error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('admin action failed', err);
        return reply(500, { error: err.message });
    }
};
