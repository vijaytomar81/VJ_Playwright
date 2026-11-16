import { ConfidentialClientApplication, PublicClientApplication } from '@azure/msal-node';

const graph = 'https://graph.microsoft.com/v1.0';

type OutlookCredentials = { username: string; password: string };

type MessagePage = {
    value: { id: string; from?: { emailAddress?: { address?: string } } }[];
    '@odata.nextLink'?: string;
};

/** Returns the newest matching Inbox message as plain text, or null if no message matches. */
export async function readMicrosoftEmail(
    senderEmail: string,
    credentials?: OutlookCredentials,
): Promise<string | null> {
    const sender = senderEmail.trim().toLowerCase();
    if (!sender) throw new Error('A sender email address is required');

    const { token, mailboxPath } = await signIn(credentials);
    const deadline = Date.now() + 30_000;
    const inbox = new URL(`${graph}${mailboxPath}/mailFolders/inbox/messages`);
    inbox.searchParams.set('$select', 'id,from,receivedDateTime');
    inbox.searchParams.set('$orderby', 'receivedDateTime desc');
    inbox.searchParams.set('$top', '100');

    let nextPage: string | undefined = inbox.href;
    while (nextPage) {
        const page = await graphGet<MessagePage>(nextPage, token, deadline);
        const match = page.value.find(
            (message) => message.from?.emailAddress?.address?.toLowerCase() === sender,
        );

        if (match) {
            const url = `${graph}${mailboxPath}/messages/${encodeURIComponent(match.id)}?$select=body`;
            const message = await graphGet<{ body?: { content: string } }>(
                url,
                token,
                deadline,
                'outlook.body-content-type="text"',
            );
            return message.body?.content ?? '';
        }

        nextPage = page['@odata.nextLink'];
    }

    return null;
}

async function signIn(credentials?: OutlookCredentials) {
    const clientId = requiredEnv('GRAPH_CLIENT_ID');
    const tenantId = requiredEnv('GRAPH_TENANT_ID');
    const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}`;

    if (credentials) {
        if (!credentials.username || !credentials.password) {
            throw new Error('Outlook username and password are required');
        }

        const client = new PublicClientApplication({ auth: { clientId, authority } });
        const result = await client.acquireTokenByUsernamePassword({
            username: credentials.username,
            password: credentials.password,
            scopes: ['Mail.Read'],
        });
        if (!result?.accessToken) throw new Error('Microsoft sign-in returned no Graph access token');
        return { token: result.accessToken, mailboxPath: '/me' };
    }

    const mailbox = requiredEnv('GRAPH_MAILBOX');
    const clientSecret = requiredEnv('GRAPH_CLIENT_SECRET');
    const client = new ConfidentialClientApplication({ auth: { clientId, authority, clientSecret } });
    const result = await client.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!result?.accessToken) throw new Error('Microsoft sign-in returned no Graph access token');
    return { token: result.accessToken, mailboxPath: `/users/${encodeURIComponent(mailbox)}` };
}

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable ${name}`);
    return value;
}

async function graphGet<T>(url: string, token: string, deadline: number, prefer?: string): Promise<T> {
    if (new URL(url).origin !== 'https://graph.microsoft.com') {
        throw new Error('Unexpected Microsoft Graph response URL');
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Timed out waiting for Microsoft Graph');
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(url, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(remaining),
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        const code = payload?.error?.code ?? 'UnknownError';
        const requestId = response.headers.get('request-id') ?? 'unavailable';
        throw new Error(`Microsoft Graph HTTP ${response.status} ${code} (request ID ${requestId})`);
    }
    return (await response.json()) as T;
}
