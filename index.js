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

const setup = 'I have not been properly set up in this server. Use `-i` or `-init` so I am properly intialized!\nNOTE: You can re-run this command again in the future to reset server settings saved by this bot.';

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

		if (!server_info.server_id) {
			if (command != 'i' && command != 'init') return setup;
		
			return message.reply(await sqlitehandler.addServer(message.guild.id));
		};

		if (server_info.command_channel && message.channel.id != server_info.command_channel) return;

		switch (command) {
			case 'i':
			case 'init':
				message.reply(await sqlitehandler.addServer(message.guild.id));
				return;
			case 's':
			case 'set':
			case 'settings':
				switch (args[0]) {
					case 'c':
					case 'command':
						if (!message.mentions.channels.at(0)) message.reply("You did not provide a channel to restrict commands.");
						else message.reply(await sqlitehandler.modifyServer(message.guild.id, 'command_channel', message.mentions.channels.at(0).id));
						return;
					case 'p':
					case 'player':
						if (!message.mentions.channels.at(0)) message.reply("You did not provide a text channel to create the embed.");
						else message.reply(await sqlitehandler.modifyServer(message.guild.id, 'player_channel', message.mentions.channels.at(0).id));
						return;
					case 'd':
					case 'default':
						if (!args[1]) {
							message.reply("You did not provide any parameters for toggling default music sesttings.");
							break;
						}
						switch(args[1]) {
							case 0:
							case '0':
							case 'false':
							case 'disable':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'enable_default', false));
								break;
							case 1:
							case '1':
							case 'true':
							case 'enable':
								message.reply(await sqlitehandler.modifyServer(message.guild.id, 'enable_default', true));
								break;
							default:
								message.reply("You did not provide a valid parameter for toggling default music settings.");
						}
						return;
					default:
						if (args.length <= 0) message.reply("You did not provide any arguments for changing bot settings.");
						else message.reply("You did not provide a valid argument for changing bot settings.");
				}
				return;
			case 'h':
			case 'help':
				message.reply(helpdoc.specificHelp(args[0]));
				return;
		}

		if (!server_info.command_channel) server_info.command_channel = message.channel.id;

		switch (command) {
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
				switch(args[0]) {
					case 'h':
					case 'hanchan':
					case '0':
					case 0:
						message.reply(await sqlitehandler.addTrack(message.author.id, message.guild.id, args[1], args[2], 0));
						break;
					case 'r':
					case 'riichi':
					case '1':
					case 1:
						message.reply(await sqlitehandler.addTrack(message.author.id, message.guild.id, args[1], args[2], 1));
						break;
					default:
						message.reply("Invalid track type provided. Valid types are `h`/`hanchan`/`0` or `r`/`riichi`/`1`.");
						break;
				}
				break;
			case 'd':
			case 'delete':
				if (args. length < 1) {
					message.reply("You did not provide enough arguments: `-d|delete [track_name]");
					break;
				}
				message.reply(await sqlitehandler.removeTrack(message.author.id, message.guild.id, args[0]));
				break;
			default:
				message.reply("Invalid command. Type -help to get a list of commands that IchiBot can use.");
		}
	}
	else if (message.mentions.has(client.user) && !message.mentions.everyone) {
		if (!server_info.server_id) {
			message.reply(setup);
			return;
		}
		if (!server_info.player_channel) server_info.player_channel = message.channel.id;

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