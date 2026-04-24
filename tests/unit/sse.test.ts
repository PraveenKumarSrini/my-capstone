import { subscribe, unsubscribe, broadcast } from '@/lib/sse'
import type { SSEEvent } from '@/types'

function makeController(enqueue?: jest.Mock) {
  return {
    enqueue: enqueue ?? jest.fn(),
    close: jest.fn(),
    error: jest.fn(),
  } as unknown as ReadableStreamDefaultController<Uint8Array>
}

describe('SSE module', () => {
  const ACC = 'acc-test'

  afterEach(() => {
    // clean up any subscriptions added during tests
    const c1 = makeController()
    unsubscribe(ACC, c1)
  })

  it('subscribe + broadcast delivers encoded event payload', () => {
    const enqueue = jest.fn()
    const ctrl = makeController(enqueue)

    subscribe(ACC, ctrl)

    const event: SSEEvent = { type: 'metrics_updated', repoId: 'r1', accountId: ACC }
    broadcast(ACC, event)

    expect(enqueue).toHaveBeenCalledTimes(1)
    const encoded = new TextDecoder().decode(enqueue.mock.calls[0][0] as Uint8Array)
    expect(encoded).toContain('event: metrics_updated')
    expect(encoded).toContain('"repoId":"r1"')
  })

  it('unsubscribe stops delivery', () => {
    const enqueue = jest.fn()
    const ctrl = makeController(enqueue)

    subscribe(ACC, ctrl)
    unsubscribe(ACC, ctrl)
    broadcast(ACC, { type: 'metrics_updated', repoId: 'r1', accountId: ACC })

    expect(enqueue).not.toHaveBeenCalled()
  })

  it('broadcast to account with no subscribers is a noop', () => {
    // should not throw
    expect(() => {
      broadcast('no-such-account', { type: 'metrics_updated', repoId: 'r', accountId: 'no-such-account' })
    }).not.toThrow()
  })

  it('delivers to multiple subscribers for the same account', () => {
    const e1 = jest.fn()
    const e2 = jest.fn()
    subscribe(ACC, makeController(e1))
    subscribe(ACC, makeController(e2))

    broadcast(ACC, { type: 'metrics_updated', repoId: 'r', accountId: ACC })

    expect(e1).toHaveBeenCalledTimes(1)
    expect(e2).toHaveBeenCalledTimes(1)

    // cleanup
    unsubscribe(ACC, makeController(e1))
    unsubscribe(ACC, makeController(e2))
  })

  it('removes a broken controller on enqueue error and continues', () => {
    const broken = jest.fn().mockImplementation(() => { throw new Error('stream closed') })
    const good = jest.fn()
    const brokenCtrl = makeController(broken)
    const goodCtrl = makeController(good)

    subscribe(ACC, brokenCtrl)
    subscribe(ACC, goodCtrl)

    broadcast(ACC, { type: 'metrics_updated', repoId: 'r', accountId: ACC })

    expect(good).toHaveBeenCalledTimes(1)

    // cleanup
    unsubscribe(ACC, goodCtrl)
  })

  it('unsubscribing a non-existent account is a noop', () => {
    expect(() => {
      unsubscribe('ghost-account', makeController())
    }).not.toThrow()
  })
})
