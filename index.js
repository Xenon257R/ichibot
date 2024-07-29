// Require the necessary discord.js classes
const fs = require('node:fs');
const fhandler = require('./lib/filehandler.js');
const sqlitehandler = require('./lib/sqlitehandler.js');
const voicehandler = require('./lib/musicplayer.js');
const helpdoc = require('./lib/helpdoc.js');

const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Options, Collection, Events, GatewayIntentBits, MessageMentions: { USERS_PATTERN } } = require('discord.js');
const { prefix, clientId, devId, token } = require('./config.json');
const { latest } = require('./updates.json');
const musicplayer = require('./lib/musicplayer.js');

// Create a new client instance
const client = new Client({
	sweepers: {
		...Options.DefaultSweeperSettings,
		messages: {
			interval: 3600,
			lifetime: 1800
		}
	},
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		ReactionManager: 0
	}),
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates
	]
});

// String literal for when IchiBot is not set yet
const setup = "I have not been properly set up in this server. Use `-i`|`-init` so I can set up!\n" +
	"NOTE: It is recommended to configure IchiBot using `-s`|`-set`|`-settings` for additional options. You can re-run `i`|`init` to reset these server settings.\n\n" +
	"For a list of all IchiBot commands and how to use them, type `-h`|`-help`.";

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	client.user.setActivity({
		type: ActivityType.Listening,
		name: "-help ~nya!"
	});
});

// Log in to Discord with your client's token
client.login(token);

// IchiBot monitors all voice channel connections, and determines if it needs to disconnect because it is in an empty channel
let autoDisconnect = null;
client.on('voiceStateUpdate', async (oldstate, newstate) => {
	// console.log('Voice channel update identified: ' + `${oldstate.channel?.id} -> ${newstate.channel?.id}`);
	if (oldstate.channel && oldstate.channel.members.size <= 1 && oldstate.channel.members.get(clientId)) {
		console.log("IchiBot is now alone. IchiBot will disconnect itself in 60 seconds.");
		autoDisconnect = setTimeout(() => {
			voicehandler.disconnectVoice(newstate.guild.id, true);
		}, 60000);
	}
	if (newstate.channel && newstate.channel.members.size > 1 && newstate.channel.members.get(clientId)) {
		// console.log("Someone dropped by!");
		if (autoDisconnect) {
			clearTimeout(autoDisconnect);
			autoDisconnect = null;
		}
	}
});

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
		if (!args || args.length <= 0) return;
		const command = args.shift().toLowerCase();

		// CITATION: https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
		for (let i = 0; i < args.length; i++) {
			args[i] = args[i].replace(/^"(.+)"$/,'$1');
		}

		// !! DEV ONLY COMMAND !!
		// Sends an announcement embed (after confirmation) to all servers that has IchiBot initialized
		if (command === 'announcement' && message.author.id === devId) {
			latest.color = Number(latest.color);
			if (args.length <= 0) {
				return message.reply({ embeds: [latest] });
			}
			if (args[0] != "CONFIRM") {
				return message.reply("Are you sure? Double check!");
			}
			const serverList = await sqlitehandler.getAllServerChannels();
			for (const server of serverList) {
				const postChannel = await client.channels.fetch(server.command_channel); 
				if (postChannel) postChannel.send({ embeds: [latest] });
				else console.log(`Post failure in server ${server.command_channel}`);
			}
			return true;
		}

		// Notifies user that server has not been initialized yet
		if (!server_info.server_id) {
			if (command != 'i' && command != 'init') return message.reply(setup);
		
			return message.reply(await sqlitehandler.addServer(message.guild.id));
		};

		// Runs server-wide commands as provided
		switch (command) {
			case 'h':
			case 'help':
				// Lists a help grid
				return message.reply(helpdoc.specificHelp(args[0]));
			case 'q':
			case 'faq':
				// Lists frequently asked questions
				return message.reply(helpdoc.specificHelp('faq'));
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
		}

		// Ignores messages if its #text_channel does not match server setting constraints
		if (server_info.command_channel && message.channel.id != server_info.command_channel) return;

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

				const resolveType = {
					"SUCCESS"       : ` has been verified and successfully added.`,
					"DROPBOXSUCCESS": ` has been added. This is a *Dropbox* link so IchiBot cannot validate it. Refer to \`-q|faq\` for further details.`,
					"LONG"          : ` is too long of a name. Please keep the track name to 30 characters or less.`,
					"RESERVED"      : ` is a reserved name for default tracks. Please use a different name.`,
					"NOTAUDIO"      : ` is not a valid audio resource. Make sure the URL points to raw audio and not a website/GUI.`,
					"BADURL"        : ` was not linked a valid URL. A correct URL should open in a browser.`,
					"BADNAME"       : ` is a bad name. The track name cannot use any of the following 8 characters: \`(\`, \`)\`, \`[\`, \`]\`, \`{\`, \`}\`, \`"\`, \`'\``,
					"INUSE"         : ` is a track name already in use in this server. Please use a different name.`,
					"TIMEOUT"       : ` timed out before the URL resource could be validated. Please try again later. You may have to wait anywhere between a minute to an hour.`,
					"UNHANDLEDERR"  : ` encountered an unhandled error. Please report this bug.`
				}

				switch(args[0]) {
					case 'h':
					case 'hanchan':
					case 'a':
					case 'ambient':
					case '0':
					case 0:
						const hResult = await sqlitehandler.addTrack(message.guild.id, message.author.id, args[1], args[2], 0);
						message.reply(`\`${args[1]}\` ${resolveType[hResult]}`);
						break;
					case 'r':
					case 'riichi':
					case 'b':
					case 'battle':
					case '1':
					case 1:
						const rResult = await sqlitehandler.addTrack(message.guild.id, message.author.id, args[1], args[2], 1);
						message.reply(`\`${args[1]}\` ${resolveType[rResult]}`);
						break;
					case 'j':
					case 'jukebox':
					case '2':
					case 2:
						const jResult = await sqlitehandler.addTrack(message.guild.id, message.author.id, args[1], args[2], 2);
						message.reply(`\`${args[1]}\` ${resolveType[jResult]}`);
						break;
					default:
						message.reply("Invalid track type provided. Valid types are as follows:\n" +
							"```md\n" +
							"* h | hanchan | a | ambient | 0\n" +
							"* r | riichi  | b | battle  | 1\n" +
							"* j | jukebox |   |         | 2```");
						break;
				}
				break;
			case 'd':
			case 'delete':
				// Deletes specified track from server
				if (args.length < 1) {
					message.reply("You did not provide enough arguments: `-d|delete [track_name]`");
					break;
				}
				message.reply(await sqlitehandler.removeTrack(message.guild.id, message.author.id, args[0], message.guild.ownerId));
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
				message.reply("Here is a list of all the tracks you put in this server!");
				let chunk = '```\n';
				if (allUploads.length <= 0) chunk = chunk + "[Empty]";
				for(let i = 0; i < allUploads.length; i++) {
					if (chunk.length > 1750) {
						client.channels.cache.get(server_info.command_channel).send(chunk + '```');
						chunk = '```asciidoc\n';
					}
					chunk = chunk + (allUploads[i].type === 0 ? term.h : term.r) + ' - ' + allUploads[i].track_name + '\n';
				}
				client.channels.cache.get(server_info.command_channel).send(chunk + '```');
				break;
			case 'x':
			case 'export':
				message.reply(`You can export tracks you put in this server into another one I'm in by using the ID: \`${message.guild.id}\``);
				break;
			case 'm':
			case 'import':
				if (!args[0]) {
					message.reply("You need to provide the server ID from which you will be importing your list from: `-m|import [server_id]`");
					break;
				}
				const importList = await sqlitehandler.listUploads(args[0], message.author.id);
				if (importList.length < 0) {
					message.reply("The provided server ID is invalid, or you do not have any tracks uploaded there.");
				}
				const confirmationRequest = await message.reply({
					content: `Ready to import ${importList.length} tracks from the **${client.guilds.cache.get(args[0])?.name}** server.`,
					components: [new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('proceed').setLabel('Proceed').setStyle(ButtonStyle.Success),
						new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger))
					]
				});

				try {
					const confirmation = await confirmationRequest.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 10000 });

					switch (confirmation.customId) {
						case 'proceed':
							await confirmation.update({
								content: 'Importing tracks. URLs will not be validated. This should not take longer than a minute.',
								components: []
							});

							// Inline sleep to pad 2 seconds minimum
							await new Promise(r => setTimeout(r, 2000));

							const results = await sqlitehandler.importData(message.guild.id, message.author.id, importList);
							const disType = await sqlitehandler.isMahjong(message.guild.id);
							const term = {
								h: disType ? 'Hanchan' : 'Ambient',
								r: disType ? 'Riichi ' : 'Battle '
							}
							resultString = '';
							results.forEach(element => {
								if (resultString.length >= 1750) {
									message.channel.send('```' + resultString + '```');
									resultString = '';
								}
								const resolveType = {
									"SUCCESS"       : 'O - Success! ------',
									"DROPBOXSUCCESS": 'O - Success! ------',
									"LONG"          : 'X - Name too long -',
									"RESERVED"      : 'X - Unusable name -',
									"NOTAUDIO"      : 'X - Is not audio --',
									"BADURL"        : 'X - Not a valid URL',
									"BADNAME"       : 'X - Bad name ------',
									"INUSE"         : 'X - Name in use ---',
									"TIMEOUT"       : 'X - Check timed out',
									"UNHANDLEDERR"  : 'X - Unhandled Error'
								}
								resultString = resultString + `${resolveType[element.code]} : ${element.type === 1 ? term.r : term.h} | ${element.name}\n`
							});
							message.channel.send('```' + resultString + '```');
							break;
						case 'cancel':
							await confirmation.update({
								content: 'Import aborted.',
								components: []
							});
							break;
						default:
							console.log("Bad entry - should not have arrived here");
					}
				} catch (err) {
					await confirmationRequest.edit({
						content: 'Confirmation not received in time, cancelling import.',
						components: []
					});
				}
				break;
			default:
				// Invalid command was provided
				message.reply("Invalid command. Type -help to get a list of commands that IchiBot can use.");
		}
	}

	// Handles @IchiBot mention
	else if (message.mentions.has(client.user) && !message.mentions.everyone && message.content.match(USERS_PATTERN)) {
		if (!server_info.server_id) {
			message.reply(setup);
			return;
		}

		// Sets #player_channel to message's #channel if no #player_channel is set on server
		if (!server_info.player_channel) server_info.player_channel = message.channel.id;

		// Ignores mentions if command_channel is set
		if (!server_info.command_channel) server_info.command_channel = message.channel.id;
		if (server_info.command_channel != message.channel.id) return;

		// Prompts IchiBot to join voice channel of user and handles failures accordingly
		const channel = message.member.voice ? message.member.voice.channel : null;
		if (channel) {
			try {
				const result = await voicehandler.createVoice(client.voice.adapters, client.guilds.cache.get(message.guild.id), channel, client.channels.cache.get(server_info.player_channel), server_info.jukebox_mode);
				switch(result) {
					case 'occupied':
						message.reply("I am already participating in a voice channel in this server.");
						break;
					case 'missing':
						message.reply("The listed channel for the embed to be placed in is missing or inaccessible. Please modify/reset the bot server settings or adjust my permissions.");
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
			await message.reply("Join a voice channel so I know where to go!");
		}
	}
});