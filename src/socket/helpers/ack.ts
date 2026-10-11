import type { AckCallback, AckResponse } from '../types';

/**
 * A client may "forget" the callback (or send garbage instead of it) — never trust it.
 * Returns a function that is always safe to call.
 */
export const safeAck = <T>(ack: unknown): AckCallback<T> =>
	typeof ack === 'function' ? (ack as AckCallback<T>) : () => {};

export const ok = <T>(data: T): AckResponse<T> => ({ ok: true, data });
export const fail = (error: string): AckResponse<never> => ({ ok: false, error });
