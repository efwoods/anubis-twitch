import { config as loadDotenv } from 'dotenv';
import WebSocket from 'ws';

loadDotenv({ path: process.env.ENV_PATH || '.env', quiet: true });

const BOT_USER_ID = process.env.BOT_USER_ID;
const CHAT_CHANNEL_USER_ID = process.env.CHAT_CHANNEL_USER_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const OAUTH_TOKEN = process.env.OAUTH_TOKEN;

const EVENTSUB_WEBSOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';

var websocketSessionID;

// Start executing the bot from here
(async () => {
	// Verify that the authentication is valid
	await getAuth();

	// Start WebSocket client and register handlers
	const websocketClient = startWebSocketClient();
})();

// WebSocket will persist the application loop until you exit the program forcefully

async function getAuth() {
	// https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
	let response = await fetch('https://id.twitch.tv/oauth2/validate', {
		method: 'GET',
		headers: {
			'Authorization': 'OAuth ' + OAUTH_TOKEN
		}
	});

	if (response.status != 200) {
		let data = await response.json();
		console.error("Token is not valid. /oauth2/validate returned status code " + response.status);
		console.error(data);
		process.exit(1);
	}

	const data = await response.json();
	console.log(`Validated token for ${data.login} (${data.user_id}).`);

	if (String(data.user_id) !== String(BOT_USER_ID)) {
		console.error(
			`OAUTH_TOKEN user_id (${data.user_id} / ${data.login}) does not match BOT_USER_ID (${BOT_USER_ID}).`
		);
		console.error(
			'Authorize while signed in as the BOT account, then paste that token into .env.'
		);
		process.exit(1);
	}

	const requiredScopes = ['user:bot', 'user:read:chat', 'user:write:chat'];
	const missing = requiredScopes.filter((scope) => !(data.scopes || []).includes(scope));
	if (missing.length) {
		console.error(`OAUTH_TOKEN is missing required scopes: ${missing.join(', ')}`);
		process.exit(1);
	}
}

function startWebSocketClient() {
	let websocketClient = new WebSocket(EVENTSUB_WEBSOCKET_URL);

	websocketClient.on('error', console.error);

	websocketClient.on('open', () => {
		console.log('WebSocket connection opened to ' + EVENTSUB_WEBSOCKET_URL);
	});

	websocketClient.on('message', (data) => {
		handleWebSocketMessage(JSON.parse(data.toString()));
	});

	return websocketClient;
}

function handleWebSocketMessage(data) {
	switch (data.metadata.message_type) {
		case 'session_welcome': // First message you get from the WebSocket server when connecting
			websocketSessionID = data.payload.session.id; // Register the Session ID it gives us

			// Listen to EventSub, which joins the chatroom from your bot's account
			registerEventSubListeners();
			break;
		case 'notification': // An EventSub notification has occurred, such as channel.chat.message
			switch (data.metadata.subscription_type) {
				case 'channel.chat.message':
					// First, print the message to the program's console.
					console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);

					// Then check to see if that message was "HeyGuys"
					if (data.payload.event.message.text.trim() == "HeyGuys") {
						// If so, send back "VoHiYo" to the chatroom
						sendChatMessage("VoHiYo")
					}

					break;
			}
			break;
	}
}

async function sendChatMessage(chatMessage, attempt = 1) {
	let response = await fetch('https://api.twitch.tv/helix/chat/messages', {
		method: 'POST',
		headers: {
			'Authorization': 'Bearer ' + OAUTH_TOKEN,
			'Client-Id': CLIENT_ID,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			broadcaster_id: CHAT_CHANNEL_USER_ID,
			sender_id: BOT_USER_ID,
			message: chatMessage
		})
	});

	if (response.status == 429 && attempt <= 2) {
		// Non-mod accounts are throttled to ~1 chat message per second per
		// channel. Wait out the window and retry instead of dropping the reply.
		console.log(`Chat throttled (429), retrying in 1.5s (attempt ${attempt})...`);
		await new Promise((resolve) => setTimeout(resolve, 1500));
		return sendChatMessage(chatMessage, attempt + 1);
	}

	if (response.status != 200) {
		let data = await response.json();
		console.error("Failed to send chat message");
		console.error(data);
	} else {
		console.log("Sent chat message: " + chatMessage);
	}
}

async function registerEventSubListeners() {
	// Register channel.chat.message
	let response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
		method: 'POST',
		headers: {
			'Authorization': 'Bearer ' + OAUTH_TOKEN,
			'Client-Id': CLIENT_ID,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			type: 'channel.chat.message',
			version: '1',
			condition: {
				broadcaster_user_id: CHAT_CHANNEL_USER_ID,
				user_id: BOT_USER_ID
			},
			transport: {
				method: 'websocket',
				session_id: websocketSessionID
			}
		})
	});

	if (response.status != 202) {
		let data = await response.json();
		console.error("Failed to subscribe to channel.chat.message. API call returned status code " + response.status);
		console.error(data);
		process.exit(1);
	} else {
		const data = await response.json();
		console.log(`Subscribed to channel.chat.message [${data.data[0].id}]`);
	}
}
