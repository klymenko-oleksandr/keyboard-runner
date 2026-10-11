// Usernames of everyone who currently has an open socket connection.
const activeUsernames = new Set<string>();

export const userRegistry = {
	has: (username: string) => activeUsernames.has(username),
	add: (username: string) => activeUsernames.add(username),
	remove: (username: string) => activeUsernames.delete(username),
};
