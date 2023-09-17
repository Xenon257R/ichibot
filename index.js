// Require the necessary discord.js classes
const fs = require('node:fs');
const fhandler = require('./lib/filehandler.js');
const sqlitehandler = require('./lib/sqlitehandler.js');
const voicehandler = require('./lib/musicplayer.js');
const helpdoc = require('./lib/helpdoc.js');

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

// String literal for when IchiBot is not set yet
const setup = 'I have not been properly set up in this server. Use `-i`|`-init` so I can set up!\n' +
	'NOTE: It is recommended to configure IchiBot using `-s`|`-set`|`-settings` for additional options. You can re-run `i`|`init` to reset these server settings.\n\n' +
	'For a list of all IchiBot commands and how to use them, type `-h`|`-help`.';

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);

// IchiBot listens to every message creation on server, and sees whether it shoulds respond to the message
client.on('messageCreate', async message => {
	// Returns if author is a bot
	if (message.author.bot) return;

	// Requests server details, or if they are not yet set
	const server_info = await sqlitehandler.getServerDetails(message.guild.id);

	// Exeption to server constraints to make sure IchiBot settings can always be configured
	if (message.content.startsWith(prefix)) {
		// CITATION: https://stackoverflow.com/questions/16261635/javascript-split-string-by-space-but-ignore-space-in-quotes-notice-not-to-spli
		const args = message.content.slice(prefix.length).trim().match(/(?:[^\s"]+|"[^"]*")+/g);
		const command = args.shift().toLowerCase();

		// CITATION: https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
		for (let i = 0; i < args.length; i++) {
			args[i] = args[i].replace(/^"(.+)"$/,'$1');
		}

		// Notifies user that server has not been initialized yet
		if (!server_info.server_id) {
			if (command != 'i' && command != 'init') return setup;
		
			return message.reply(await sqlitehandler.addServer(message.guild.id));
		};

		// Ignores messages if its #text_channel does not match server setting constraints
		if (server_info.command_channel && message.channel.id != server_info.command_channel) return;

		// Runs server-wide commands as provided
		switch (command) {
			case 'i':
			case 'init':
				// Initializes IchiBot
				message.reply(await sqlitehandler.addServer(message.guild.id));
				return;
			case 's':
			case 'set':
			case 'settings':
				// Change the settings of IchiBot on the server
				switch (args[0]) {
					case 'c':
					case 'command':
						// Change the #text_channel constraint for IchiBot Commands
						if (!message.mentions.channels.at(0)) message.reply("You did not provide a channel to restrict commands.");
						else message.reply(await sqlitehandler.modifyServer(message.guild.id, 'command_channel', message.mentions.channels.at(0).id));
						break;
					case 'p':
					case 'player':
						// Change the #player_channel constraint for IchiBot's embedded player
						if (!message.mentions.channels.at(0)) message.reply("You did not provide a text channel to create the embed.");
						else message.reply(await sqlitehandler.modifyServer(message.guild.id, 'player_channel', message.mentions.channels.at(0).id));
						return;
					case 'd':
					case 'default':
						// Change the option to use default music tracks of IchiBot in the server
						if (!args[1]) {
							message.reply("You did not provide any parameters for toggling default music sesttings.");
							break;
						}
						switch(args[1]) {
							case 'false':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'enable_default', false));
								break;
							case 'true':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'enable_default', true));
								break;
							default:
								message.reply("You did not provide `true` or `false` for default music settings.");
						}
						break;
					case 'm':
					case 'mahjong':
						// Change the option to use mahjong terms or not
						if (!args[1]) {
							message.reply("You did not provide a parameter to toggle mahjong term settings.");
							break;
						}
						switch (args[1]) {
							case 'false':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'mahjong', false));
								break;
							case 'true':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'mahjong', true));
								break;
							default:
								message.reply("You did not provide `true` or `false` for mahjong term settings.");
						}
						break;
					default:
						// An incorrect command was provided, or lack thereof
						if (args.length <= 0) message.reply("You did not provide any arguments for changing bot settings.");
						else message.reply("You did not provide a valid argument for changing bot settings.");
				}
				return;
			case 'h':
			case 'help':
				// Requests help from IchiBot on how to use it

				message.reply(helpdoc.specificHelp(args[0]));
				return;
		}

		// Sets #command_channel to message's #channel if no #command_channel is set on server
		if (!server_info.command_channel) server_info.command_channel = message.channel.id;

		// Runs commands as provided
		switch (command) {
			case 'p':
			case 'profile':
				// Edits user profile on server
				if (args.length < 1) {
					message.reply("You did not provide enough arguments: `-p|profile [image_url|d|delete]`");
					break;
				}
				if (args[0] != 'd' && args[0] != 'delete') message.reply(await sqlitehandler.assignProfile(message.guild.id, message.author.id, args[0]));
				else message.reply(await sqlitehandler.dismountProfile(message.guild.id, message.author.id));
				break;
			case 'a':
			case 'add':
				// Adds specified track to server
				if (args.length < 3) {
					message.reply("You did not provide enough arguments: `-a|add [type] [track_name] [track_url]`");
					break;
				}
				switch(args[0]) {
					case 'h':
					case 'hanchan':
					case 'a':
					case 'ambient':
					case '0':
					case 0:
						message.reply(await sqlitehandler.addTrack(message.guild.id, message.author.id, args[1], args[2], 0));
						break;
					case 'r':
					case 'riichi':
					case 'b':
					case 'battle':
					case '1':
					case 1:
						message.reply(await sqlitehandler.addTrack(message.guild.id, message.author.id, args[1], args[2], 1));
						break;
					default:
						message.reply("Invalid track type provided. Valid types are `h`/`hanchan`/`a`/`ambient`/`0` or `r`/`riichi`/`b`/`battle`/`1`.");
						break;
				}
				break;
			case 'd':
			case 'delete':
				// Deletes specified track from server
				if (args. length < 1) {
					message.reply("You did not provide enough arguments: `-d|delete [track_name]");
					break;
				}
				message.reply(await sqlitehandler.removeTrack(message.guild.id, message.author.id, args[0]));
				break;
			case 'f':
			case 'force':
				// Force playback from music player when its active
				message.reply(await voicehandler.forcePlay(message.guild.id, message.mentions.users.at(0), args[0]));
				break;
			case 'l':
			case 'list':
				// Lists user's album on the server
				const allUploads = await sqlitehandler.listUploads(message.guild.id, message.author.id);
				const disType = await sqlitehandler.isMahjong(message.guild.id);
				const term = {
					h: disType ? 'Hanchan' : 'Ambient',
					r: disType ? 'Riichi ' : 'Battle '
				}
				message.reply('Here is a list of all the tracks you put in this server!');
				let chunk = '```asciidoc\n';
				if (allUploads.length <= 0) chunk = chunk + '[Empty]';
				for(let i = 0; i < allUploads.length; i++) {
					if (chunk.length > 1750) {
						client.channels.cache.get(server_info.command_channel).send(chunk + '```');
						chunk = '```asciidoc\n';
					}
					chunk = chunk + (allUploads[i].type === 0 ? term.h : term.r) + ' :: ' + allUploads[i].track_name + '\n';
				}
				client.channels.cache.get(server_info.command_channel).send(chunk + '```');
				break;
			default:
				// Invalid command was provided
				message.reply("Invalid command. Type -help to get a list of commands that IchiBot can use.");
		}
	}

	// Handles @IchiBot mention
	else if (message.mentions.has(client.user) && !message.mentions.everyone) {
		if (!server_info.server_id) {
			message.reply(setup);
			return;
		}

		// Sets #player_channel to message's #channel if no #player_channel is set on server
		if (!server_info.player_channel) server_info.player_channel = message.channel.id;

		// Prompts IchiBot to join voice channel of user and handles failures accordingly
		const channel = message.member?.voice.channel;
		if (channel) {
			try {
				const result = await voicehandler.createVoice(client.guilds.cache.get(message.guild.id), channel, client.channels.cache.get(server_info.player_channel));
				switch(result) {
					case 'occupied':
						message.reply('I am already participating in a voice channel in this server.');
						break;
					case 'missing':
						message.reply(`The listed channel for the embed to be placed in is missing or inaccessible. Please modify/reset the bot server settings or adjust my permissions.`);
						break;
					default:
						console.log(`Set up successfully in server ${message.guild.id} in voice channel ${channel}. Embed placed in [${server_info.player_channel}].`);
				}
			}
			catch (error) {
				message.reply("There was an error responding to your ping.");
				console.error(error);
			}
		}
		else {
			await message.reply('Join a voice channel so I know where to go!');
		}
	}
});