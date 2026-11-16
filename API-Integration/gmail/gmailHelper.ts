import { simpleParser, ParsedMail } from 'mailparser';
import { google, gmail_v1 } from 'googleapis';

// Created on first use, not at import: the credentials must be in process.env by then, and
// Jenkins secrets often carry a trailing newline that breaks the OAuth request.
let gmailClient: gmail_v1.Gmail | undefined;

export interface AccountEmailService {
  getVerificationCode(recipient: string, timeout?: number): Promise<string>;
  getAccountActivationLink(recipient: string, timeout?: number): Promise<string>;
}

export interface GmailCredentials {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

function gmailFor(credentials: GmailCredentials): gmail_v1.Gmail {
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();
  const refreshToken = credentials.refreshToken?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN must all be set');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
}

function getGmail(): gmail_v1.Gmail {
  return (gmailClient ??= gmailFor({
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  }));
}

/** Worker-owned client with supplied configuration; legacy exports retain their defaults. */
export function createGmailService(credentials: GmailCredentials): AccountEmailService {
  const configured = { ...credentials };
  let client: gmail_v1.Gmail | undefined;
  const getClient = () => (client ??= gmailFor(configured));
  return {
    getVerificationCode: (recipient, timeout) => getVerificationCode(recipient, timeout, getClient),
    getAccountActivationLink: (recipient, timeout) =>
      getAccountActivationLink(recipient, timeout, getClient),
  };
}

async function getUnreadMessages(recipient: string, subject: string, client: () => gmail_v1.Gmail) {
  const res = await client().users.messages.list({
    userId: 'me',
    q: `to:${recipient} subject:"${subject}" is:unread`,
    maxResults: 10,
  });

  return res.data.messages || [];
}

async function getMessageContent(
  messageId: string,
  client: () => gmail_v1.Gmail
): Promise<ParsedMail> {
  try {
    const res = await client().users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'raw',
    });

    const rawData = res.data.raw;

    if (!rawData) {
      throw new Error(`Message ${messageId} has no raw content`);
    }

    const raw = Buffer.from(rawData, 'base64').toString('utf-8');

    return await simpleParser(raw);
  } catch (err: any) {
    console.error(`Failed to get content for message ID ${messageId}:`, err.message);
    throw err;
  }
}

async function markAsRead(messageId: string, client: () => gmail_v1.Gmail): Promise<void> {
  try {
    await client().users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (err: any) {
    console.error(`Failed to mark message ${messageId} as read:`, err.message);
    throw err;
  }
}

export async function getVerificationCode(
  recipient: string,
  timeout = 60000,
  client: () => gmail_v1.Gmail = getGmail
): Promise<string> {
  const start = Date.now();
  let lastError = '';

  console.log(`Looking for verification email for ${recipient}...`);

  while (Date.now() - start < timeout) {
    try {
      const messages = await getUnreadMessages(recipient, 'Please verify your account', client);

      if (messages.length) {
        const latest = messages[0];

        if (latest?.id) {
          const parsed = await getMessageContent(latest.id, client);

          const html = parsed.html || '';

          const match = html.match(/<h2[^>]*>\s*(\d{6})\s*<\/h2>/i);

          if (match) {
            await markAsRead(latest.id, client);

            console.log(`Verification code found: ${match[1]}`);

            return match[1];
          }
        }
      }
    } catch (err: any) {
      console.error('Error while checking messages:', err.message);
      lastError = err.message;
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(
    `Verification code not received in time${lastError ? ` (last Gmail error: ${lastError})` : ''}`
  );
}

export async function markAllUnreadAsRead(): Promise<void> {
  const gmail = getGmail();
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  // Collect every page before changing labels so pagination does not skip messages.
  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 500,
      pageToken,
    });

    for (const message of response.data.messages ?? []) {
      if (message.id) messageIds.push(message.id);
    }
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  for (let offset = 0; offset < messageIds.length; offset += 1000) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds.slice(offset, offset + 1000),
        removeLabelIds: ['UNREAD'],
      },
    });
  }
}

export async function getAccountActivationLink(
  recipient: string,
  timeout = 60000,
  client: () => gmail_v1.Gmail = getGmail
): Promise<string> {
  const start = Date.now();
  let lastError = '';
  console.log(`Looking for account activation link for ${recipient}...`);

  while (Date.now() - start < timeout) {
    try {
      const messages = await getUnreadMessages(recipient, 'Activate your online account', client);

      if (messages.length) {
        const latest = messages[0];

        if (latest?.id) {
          const parsed = await getMessageContent(latest.id, client);
          const link = extractActivationLink(parsed);

          if (link) {
            await markAsRead(latest.id, client);
            return link;
          }
        }
      }
    } catch (err: any) {
      console.error('Error while checking messages:', err.message);
      lastError = err.message;
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(
    `Account activation email not received in time${lastError ? ` (last Gmail error: ${lastError})` : ''}`
  );
}

function extractActivationLink(parsedEmail: ParsedMail): string | null {
  if (!parsedEmail) {
    return null;
  }

  const html = parsedEmail.html || '';
  const text = parsedEmail.text || '';

  const htmlMatch = html.match(/https:\/\/id[^\s"'<>]+/i) || html.match(/http:\/\/host[^\s"'<>]+/i);

  if (htmlMatch) {
    return htmlMatch[0];
  }

  const textMatch = text.match(/https:\/\/id\S+/i);

  if (textMatch) {
    return textMatch[0].replace(/[)>.,]+$/, '');
  }

  return null;
}
