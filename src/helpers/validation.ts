// Keep in sync with public/javascript/constants/validation.mjs
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;
export const ROOM_NAME_MAX_LENGTH = 30;

export const isValidUsername = (value: unknown): value is string =>
	typeof value === 'string' && USERNAME_PATTERN.test(value);

export const normalizeRoomName = (value: unknown): string | null => {
	if (typeof value !== 'string') {
		return null;
	}
	const name = value.trim();
	return name.length > 0 && name.length <= ROOM_NAME_MAX_LENGTH ? name : null;
};
