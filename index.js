// Require the necessary discord.js classes
const fs = require('node:fs');
const fhandler = require('./lib/filehandler.js');
const sqlitehandler = require('./lib/sqlitehandler.js');
const voicehandler = require('./lib/musicplayer.js');

const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { prefix, clientId, token } = require('./config.json');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates
	]
});

async function getUserById(id, server) {
	if (id === 0 || id === '0') return 'IchiBot';
	const member = client.guilds.cache.get(server).members.cache.get(id);
	if (!member || (member.user && !member.user.username)) return 'Unregistered user';
	if (!member.nickname) return member.user.username;
	return member.nickname;
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);

client.on('messageCreate', async message => {
	if (message.author.bot) return;

	const server_info = await sqlitehandler.getServerDetails(message.guild.id);

	if (message.content.startsWith(prefix)) {
		// CITATION: https://stackoverflow.com/questions/16261635/javascript-split-string-by-space-but-ignore-space-in-quotes-notice-not-to-spli
		const args = message.content.slice(prefix.length).trim().match(/(?:[^\s"]+|"[^"]*")+/g);
		const command = args.shift().toLowerCase();

		// CITATION: https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
		for (let i = 0; i < args.length; i++) {
			args[i] = args[i].replace(/^"(.+)"$/,'$1');
		}

		if (!server_info.command_channel || !server_info.player_channel) {
			switch (command) {
				case 'i':
				case 'init':
					if (message.mentions.channels.size < 2) {
						message.reply('You did not provide enough text channels for all necessary parameters!');
						break;
					}
					sqlitehandler.addServer(message.guild.id, message.mentions.channels.at(0).id, message.mentions.channels.at(1).id);
					message.reply("Successfully updated channels!");
					break;
				default:
					message.reply('I have not been properly set up in this server. Use `-i` or `-init` with text channels so I know where to put and expect things!\n\n' + 
						'Command: `-i(nit) [#command_channel] [#player_channel]`\n\n' +
						'* `command_channel`: The text channel where I will listen to commands.\n' +
						'* `player_channel`: The text channel where I will display my music player.\n\n' +
						'Note: You can reuse the same channel multiple times.');
			}
			return;
		}

		if (message.channel.id != server_info.command_channel) return;

		switch (command) {
			case 'i':
			case 'init':
				if (message.mentions.channels.size < 2) {
					message.reply('You did not provide enough text channels for all necessary parameters!');
					break;
				}
				sqlitehandler.addServer(message.guild.id, message.mentions.channels.at(0).id, message.mentions.channels.at(1).id);
				message.reply("Successfully updated channels!");
				break;
			case 'p':
			case 'profile':
				if (args.length < 1) {
					message.reply("You did not provide enough arguments: `-p|profile [image_url|d|delete]`");
					break;
				}
				if (args[0] != 'd' && args[0] != 'delete') message.reply(await sqlitehandler.assignProfile(message.guild.id, message.author.id, args[0]));
				else message.reply(await sqlitehandler.dismountProfile(message.guild.id, message.author.id));
				break;
			case 'a':
			case 'add':
				if (args.length < 3) {
					message.reply("You did not provide enough arguments: `-a|add [type] [track_name] [track_url]`");
					break;
				}
				let pType = false;
				switch(args[0]) {
					case 'h':
					case 'hanchan':
					case '0':
					case 0:
						pType = 0;
					case 'r':
					case 'riichi':
					case '1':
					case 1:
						pType = 1;
				}
				if (!pType) {
					message.reply("Invalid track type provided. Valid types are `h`/`hanchan`/`0` or `r`/`riichi`/`1`.");
					break;
				}
				message.reply(await sqlitehandler.addTrack(message.author.id, message.guild.id, args[1], args[2], args[0]));
				break;
			case 'd':
			case 'delete':
				if (args. length < 1) {
					message.reply("You did not provide enough arguments: `-d|delete [track_name]");
					break;
				}
				console.log(`Deleting track named ${args[0]}.`);
				message.reply(await sqlitehandler.removeTrack(message.author.id, message.guild.id, args[0]));
				break;
			default:
				console.log("Invalid command. Type -help to get a list of commands that IchiBot can use.");
		}
	}
	else if (message.mentions.has(client.user) && !message.mentions.everyone && message.channelId === server_info.command_channel) {
		if (!server_info.player_channel) {
			message.reply('I have not been properly set up in this server. Use `-i` or `-init` with text channels so I know where to put and expect things!\n\n' + 
				'Command: `-i(nit) [#command_channel] [#player_channel]`\n\n' +
				'* `command_channel`: The text channel where I will listen to commands.\n' +
				'* `player_channel`: The text channel where I will display my music player.\n\n' +
				'Note: You can reuse the same channel multiple times.');
			console.log("Bot has not been initialized.");
			return;
		}
		const channel = message.member?.voice.channel;
		if (channel) {
			try {
				console.log(`${message.guild.id}, ${channel}, ${server_info.player_channel}`);
				const result = await voicehandler.createVoice(client.guilds.cache.get(message.guild.id), channel, client.channels.cache.get(server_info.player_channel));
				if (!result) message.reply('I am already participating in a voice channel in this server.');
			}
			catch (error) {
				console.error(error);
			}
		}
		else {
			await message.reply('Join a voice channel so I know where to go!');
		}
	}
});