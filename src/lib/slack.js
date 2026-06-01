// Send messages via the Slack Web API (chat.postMessage). Slack blocks browser
// CORS, so the request goes through the dev/preview server's `/slack` proxy.
// The token and channel ID are stored in localStorage only — never in the code.
const TOKEN_KEY = 'weather-slack-token'
const CHANNEL_KEY = 'weather-slack-channel'

export const readSlackConfig = () => {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY) || '',
      channel: localStorage.getItem(CHANNEL_KEY) || '',
    }
  } catch {
    return { token: '', channel: '' }
  }
}

export const writeSlackConfig = ({ token, channel }) => {
  try {
    localStorage.setItem(TOKEN_KEY, (token || '').trim())
    localStorage.setItem(CHANNEL_KEY, (channel || '').trim())
  } catch { /* ignore */ }
}

export async function sendSlack(token, channel, text) {
  if (!token || !channel) return false
  try {
    const res = await fetch('/slack/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text,
        username: 'Weather Channel',
        icon_emoji: ':partly_sunny:',
      }),
    })
    const json = await res.json()
    return json.ok === true
  } catch {
    return false
  }
}
