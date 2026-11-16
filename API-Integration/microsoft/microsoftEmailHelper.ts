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
        const page: MessagePage = await graphGet<MessagePage>(nextPage, token, deadline);
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
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing environment variable ${name}`);
    return value;
}

async function graphGet<T>(url: string, token: string, deadline: number, prefer?: string): Promise<T> {
    const response = await graphRequest(url, token, deadline, {
        headers: prefer ? { Prefer: prefer } : undefined,
    });
    return (await response.json()) as T;
}

async function graphRequest(
    url: string,
    token: string,
    deadline: number,
    options: RequestInit = {},
): Promise<Response> {
    if (new URL(url).origin !== 'https://graph.microsoft.com') {
        throw new Error('Unexpected Microsoft Graph response URL');
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Timed out waiting for Microsoft Graph');
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, {
        ...options,
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
    return response;
}

type AccountMessage = {
    id: string;
    toRecipients?: { emailAddress?: { address?: string } }[];
    body?: { content?: string };
};

type AccountMessagePage = {
    value: AccountMessage[];
    '@odata.nextLink'?: string;
};

/** Waits for an unread account verification email and marks the matched message as read. */
export function getVerificationCode(recipient: string, timeout = 60_000): Promise<string> {
    return waitForAccountEmail(recipient, 'Please verify your account', timeout, (body) =>
        body.match(/<h2\b[^>]*>\s*(\d{6})\s*<\/h2>/i)?.[1],
    );
}

/** Waits for an unread activation email and marks the matched message as read. */
export function getAccountActivationLink(recipient: string, timeout = 60_000): Promise<string> {
    return waitForAccountEmail(recipient, 'Activate your online account', timeout, (body) => {
        const link = body.match(/https:\/\/id[^\s"'<>]+/i)?.[0]
            ?? body.match(/http:\/\/host[^\s"'<>]+/i)?.[0];
        return link?.replace(/[)>.,]+$/, '').replace(/&(?:amp|#38|#x26);/gi, '&');
    });
}

async function waitForAccountEmail(
    recipient: string,
    subject: string,
    timeout: number,
    extract: (body: string) => string | undefined,
): Promise<string> {
    const address = recipient.trim().toLowerCase();
    if (!address) throw new Error('A recipient email address is required');
    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error('The email timeout must be a positive number of milliseconds');
    }

    const { token, mailboxPath } = await signIn();
    const deadline = Date.now() + timeout;
    const messagesUrl = new URL(`${graph}${mailboxPath}/messages`);
    messagesUrl.searchParams.set('$select', 'id,toRecipients,body,receivedDateTime');
    // Graph requires the sort property to appear first in the filter.
    messagesUrl.searchParams.set(
        '$filter',
        `receivedDateTime ge 1970-01-01T00:00:00Z and isRead eq false and subject eq '${subject}'`,
    );
    messagesUrl.searchParams.set('$orderby', 'receivedDateTime desc');
    messagesUrl.searchParams.set('$top', '25');

    while (Date.now() < deadline) {
        let nextPage: string | undefined = messagesUrl.href;
        while (nextPage && Date.now() < deadline) {
            const page: AccountMessagePage = await graphGet<AccountMessagePage>(
                nextPage, token, deadline, 'outlook.body-content-type="html"',
            );

            for (const message of page.value) {
                const matchesRecipient = message.toRecipients?.some(
                    (recipient) => recipient.emailAddress?.address?.toLowerCase() === address,
                );
                if (!matchesRecipient) continue;

                const result = extract(message.body?.content ?? '');
                if (!result) continue;

                await graphRequest(
                    `${graph}${mailboxPath}/messages/${encodeURIComponent(message.id)}`,
                    token,
                    deadline,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isRead: true }),
                    },
                );
                return result;
            }

            nextPage = page['@odata.nextLink'];
        }

        const remaining = deadline - Date.now();
        if (remaining > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, Math.min(3_000, remaining)));
        }
    }

    throw new Error(`No matching unread Microsoft email with subject "${subject}" within ${timeout} ms`);
}
