/** Join class names, skipping falsy values: cx('a', cond && 'b'). */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
