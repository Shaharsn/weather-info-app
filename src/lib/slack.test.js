import { describe, it, expect } from 'vitest'
import { slackProxyPath } from './slack.js'

describe('slackProxyPath', () => {
  it('maps a hooks.slack.com webhook to the same-origin proxy path', () => {
    expect(slackProxyPath('https://hooks.slack.com/services/T1/B2/abc123')).toBe(
      '/slack/services/T1/B2/abc123',
    )
  })
  it('rejects non-Slack or malformed URLs', () => {
    expect(slackProxyPath('https://evil.example.com/services/x')).toBeNull()
    expect(slackProxyPath('not a url')).toBeNull()
    expect(slackProxyPath('')).toBeNull()
  })
})
