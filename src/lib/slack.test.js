import { describe, it, expect } from 'vitest'
import { sendSlack } from './slack.js'

describe('sendSlack', () => {
  it('returns false when token or channel is missing', async () => {
    expect(await sendSlack('', 'D123', 'hi')).toBe(false)
    expect(await sendSlack('xoxb-x', '', 'hi')).toBe(false)
  })
})
