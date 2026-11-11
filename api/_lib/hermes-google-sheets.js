import { GoogleAuth } from 'google-auth-library';

let auth;

export async function readHermesRows(range) {
  const spreadsheetId = process.env.HERMES_GOOGLE_SHEETS_ID?.trim();
  const credentialsJson = process.env.HERMES_GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!spreadsheetId || !credentialsJson) throw new Error('sheets_not_configured');

  auth ??= new GoogleAuth({
    credentials: JSON.parse(credentialsJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  url.searchParams.set('dateTimeRenderOption', 'FORMATTED_STRING');
  const { data } = await auth.request({ url: url.toString(), timeout: 8000, retry: false });
  return Array.isArray(data.values) ? data.values : [];
}
