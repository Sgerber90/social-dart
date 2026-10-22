import { describe, expect, it } from 'vitest'
import { demoHistory } from './demo'

describe('demo data', () => {
  it('produces finished sample games', () => {
    const h = demoHistory()
    expect(h.length).toBeGreaterThanOrEqual(12)
  })
})
