// Send a message to a Slack Incoming Webhook. Slack blocks browser CORS, so the
// request goes through the dev/preview server's `/slack` proxy (same-origin).
// The webhook URL is a secret the user pastes in the app (stored locally only).
const WEBHOOK_KEY = 'weather-slack-webhook'

export const readSlackWebhook = () => {
  try {
    return localStorage.getItem(WEBHOOK_KEY) || ''
  } catch {
    return ''
  }
}

export const writeSlackWebhook = (url) => {
  try {
    localStorage.setItem(WEBHOOK_KEY, (url || '').trim())
  } catch {
    /* ignore */
  }
}

// Turn a full hooks.slack.com webhook URL into the same-origin proxied path.
export function slackProxyPath(webhookUrl) {
  try {
    const u = new URL(webhookUrl)
    if (u.hostname !== 'hooks.slack.com') return null
    return '/slack' + u.pathname + u.search
  } catch {
    return null
  }
}

export async function sendSlack(webhookUrl, text) {
  const path = slackProxyPath(webhookUrl)
  if (!path) return false
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return true
  } catch {
    return false
  }
}
