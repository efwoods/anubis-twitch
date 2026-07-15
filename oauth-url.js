// oauth-url.js
// Shared Twitch implicit-grant authorize URL (no client secret).

export const TWITCH_CHAT_SCOPES = [
	'user:bot',
	'user:read:chat',
	'user:write:chat'
];

export function buildAuthorizeURL(clientId, redirectUri) {
	return (
		'https://id.twitch.tv/oauth2/authorize' +
		'?response_type=token' +
		'&client_id=' + clientId +
		'&redirect_uri=' + encodeURIComponent(redirectUri) +
		'&scope=' + encodeURIComponent(TWITCH_CHAT_SCOPES.join(' '))
	);
}
