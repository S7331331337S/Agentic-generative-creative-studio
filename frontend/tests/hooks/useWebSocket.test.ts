import { act, renderHook } from '@testing-library/react';
import { WsEvent } from '@agcs/shared';
import { useWebSocket } from '../../src/hooks/useWebSocket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  /** Simulate the server accepting the connection. */
  accept(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Simulate the connection dropping from the far end. */
  drop(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

const RECONNECT_INTERVAL = 3000;

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens a single connection on mount', () => {
    const { result } = renderHook(() => useWebSocket(() => undefined));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(result.current.connectionStatus).toBe('connecting');
  });

  it('reports connected once the socket opens', () => {
    const { result } = renderHook(() => useWebSocket(() => undefined));

    act(() => MockWebSocket.latest().accept());

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('forwards parsed events to the handler', () => {
    const onEvent = jest.fn();
    renderHook(() => useWebSocket(onEvent));

    const event: WsEvent = { type: 'system:metrics', payload: { a: 1 }, timestamp: 123 };
    act(() => {
      MockWebSocket.latest().accept();
      MockWebSocket.latest().onmessage?.({ data: JSON.stringify(event) });
    });

    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('ignores malformed frames without tearing down the connection', () => {
    const onEvent = jest.fn();
    const { result } = renderHook(() => useWebSocket(onEvent));

    act(() => {
      MockWebSocket.latest().accept();
      MockWebSocket.latest().onmessage?.({ data: 'not json{' });
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('routes to the latest handler without reopening the socket', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ cb }) => useWebSocket(cb), {
      initialProps: { cb: first as (e: WsEvent) => void },
    });

    act(() => MockWebSocket.latest().accept());
    rerender({ cb: second as (e: WsEvent) => void });

    const event: WsEvent = { type: 'task:completed', payload: {}, timestamp: 1 };
    act(() => {
      MockWebSocket.latest().onmessage?.({ data: JSON.stringify(event) });
    });

    // A new handler must not cost a reconnect.
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(event);
  });

  it('reconnects after the socket drops while mounted', () => {
    renderHook(() => useWebSocket(() => undefined));

    act(() => MockWebSocket.latest().drop());
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(RECONNECT_INTERVAL);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  // Regression: unmount used to leave a reconnect scheduled, so the hook would
  // reopen a socket for a component that no longer existed.
  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => useWebSocket(() => undefined));

    act(() => MockWebSocket.latest().accept());
    unmount();

    act(() => {
      jest.advanceTimersByTime(RECONNECT_INTERVAL * 3);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('closes the socket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket(() => undefined));
    const socket = MockWebSocket.latest();

    act(() => socket.accept());
    unmount();

    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });
});
