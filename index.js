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

let busy = false;

function generateTypePromptRow() {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('h').setLabel('Hanchan Playlist').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('r').setLabel('Riichi Playlist').setStyle(ButtonStyle.Primary)
		)
	];
}

async function getUserById(id, server) {
	if (id === 0 || id === '0') return 'IchiBot';
	const member = client.guilds.cache.get(server).members.cache.get(id);
	if (!member || (member.user && !member.user.username)) return 'Unregistered user';
	if (!member.nickname) return member.user.username;
	return member.nickname;
}


// Compiles an array of [.ogg] files with categories
function compile(variant, author) {
	return fs.readdirSync(`./music/${variant}/${author}/`).filter(file => file.endsWith('.mp3'));
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

	if ((message.content.startsWith(prefix)) || (message.mentions.has(client.user) && !message.mentions.everyone)) {
		if (!await sqlitehandler.serverComplete(message.guild.id)) {
			const args = message.content.slice(prefix.length).trim().split(/ +/);
			const command = args.shift().toLowerCase();

			switch (command) {
				case 'i':
				case 'init':
					if (message.mentions.channels.size < 3) {
						message.reply('You did not provide enough text channels for all necessary parameters!');
						break;
					}
					sqlitehandler.addServer(message.guild.id, message.mentions.channels.at(0).id, message.mentions.channels.at(1).id, message.mentions.channels.at(2).id);
					message.reply("Successfully updated channels!");
					break;
				default:
					message.reply('I have not been properly set up in this server. Use `-i` or `-init` with text channels so I know where to put and expect things!\n\n' + 
						'Command: `-i(nit) [#command_channel] [#upload_channel] [#player_channel]`\n\n' +
						'* `command_channel`: The text channel where I will listen to commands.\n' +
						'* `upload_channel`: The text channel where I will archive all `.mp3` file uploads.\n' +
						'* `player_channel`: The text channel where I will display my music player.\n\n' +
						'Note: You can reuse the same channel multiple times.');
			}
			return;
		}
	}
	if (message.content.startsWith(prefix)) {
		// Trims the message into components delimited by spaces
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const command = args.shift().toLowerCase();

		if  (message.channelId != server_info.command_channel && (command != 'i' && command != 'init')) return;

		switch (command) {
			case 'i':
			case 'init':
				if (message.mentions.channels.size < 3) {
					message.reply('You did not provide enough text channels for all necessary parameters!');
					break;
				}
				sqlitehandler.addServer(message.guild.id, message.mentions.channels.at(0).id, message.mentions.channels.at(1).id, message.mentions.channels.at(2).id);
				message.reply("Successfully updated channels!");
				break;
			case 'p':
			case 'profile':
				if (args[0]) {
					if (args[0] === 'reset') sqlitehandler.dismountProfile(message.guild.id, message.author.id);
					else sqlitehandler.assignProfile(message.guild.id, message.author.id, args[0]);
				}
				else {
					message.reply("I need an image URL as a parameter! No spaces allowed!");
				}
				break;
			case 'l':
			case 'list':
			case 'playlist':
				let type = 'hanchan';
				if (args[0] && args.shift().toLowerCase() === 'r') type = 'riichi';

				let id = message.author.id;
				if (message.mentions.users.first()) {
					let m = message.mentions.users.first();
					if (m.id === clientId) id = 0;
					else id = m.id;
				}

				const l = await sqlitehandler.retrieveList(message.guild.id, type == 'hanchan' ? 0 : 1, id);
				let stringifiedList = '';
				l.forEach(entry => {
					stringifiedList = stringifiedList.concat(entry.track_id.toString().padStart(2, '0'), ' | ', entry.name.replace(new RegExp('_', 'g'), ' '), '\n');
				});
				message.channel.send(`\`\`\`ini\n[${(await getUserById(message.author.id, message.guild.id)).replace(new RegExp('\\[', 'g'), '(').replace(new RegExp('\\]', 'g'), ')')} - ${type}]\n${stringifiedList}\`\`\``);
				break;
			case 'a':
			case 'add':
				if (busy) {
					message.reply("I'm currently busy playing Riichi! Please wait until I'm idle to add tracks.");
					return;
				}
				switch (args.length) {
					case 0:
						message.reply('You did not provide any arguments. Refer to #documentation in how to add music tracks.');
						return;
					default:
						args.forEach(arg => {
							sqlitehandler.addTrack(message.author.id, message.guild.id, arg);
						});
						return;
				}
			case 'd':
			case 'delete':
				if (busy) {
					message.reply("I'm currently busy playing Riichi! Please wait until I'm idle to delete files.");
					return;
				}
				switch (args.length) {
					case 0:
						message.reply('You did not provide any arguments. Refer to #documentation in how to delete music tracks.');
						return;
					case 1:
						message.reply('You did not provide enough arguments. Refer to #documentation in how to delete music tracks.');
						return;
					default:
						let type = null;
						switch (args.shift().toLowerCase()) {
							case 'h':
							case 'hanchan':
								type = 'hanchan';
								break;
							case 'r':
							case 'riichi':
								type = 'riichi';
								break;
							default:
								message.reply('You did not provide a valid playlist type. The two accepted types are `h` and `r`.');
								return;
						}
						const list = compile(type, message.author.id);
						if (list.length <= 0) {
							message.reply('Your list is already empty - there is nothing to delete here!');
							return;
						}
						const index = Math.floor(parseInt(args.shift()));
						if (isNaN(index) || index > list.length || index <= 0) {
							message.reply('You did not provide a valid track number. Use `-l`, `-l r` or `-l h` to view your playlist to identify the correct number.');
							return;
						}

						// Deletes the file
						const deletedFile = list[index - 1];
						try {
							fs.unlinkSync(`./music/${type}/${message.author.id}/${list[index - 1]}`);
							return message.reply(`\`${deletedFile}\` successfully removed!`);
						}
						catch (err) {
							console.error(err);
							return message.reply(`There was an error in removing \`${deletedFile}\`.`);
						}
				}
			case 'f':
			case 'force':
				break;
			default:
				message.reply('This is an invalid command. Refer to #documentation for details on how to use the bot.');
		}
	}
	else if (message.mentions.has(client.user) && !message.mentions.everyone && message.channelId === server_info.command_channel) {

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
	else if (message.attachments.size > 0 && message.channelId === server_info.upload_channel) {
		// Creates directories if they don't exist yet
		if (!fs.existsSync(`./music/hanchan/${message.author.id}`) || !fs.existsSync(`./music/riichi/${message.author.id}`)){
			fs.mkdirSync(`./music/hanchan/${message.author.id}`);
			fs.mkdirSync(`./music/riichi/${message.author.id}`);
		}

		// Waiting for type response
		const response = await message.reply({ content: `Which playlist should the above track(s) be assigned to?`, components: generateTypePromptRow() });

		const collectorFilter = i => i.user.id === message.author.id;

		try {
			const selection = await response.awaitMessageComponent({ filter: collectorFilter, time: 60000 });
			await response.edit( { content: `Labeling your new track(s) as ${selection.customId === 'h' ? 'Hanchan' : 'Riichi' }...`, components: [] });
			message.reply({ content: `Uploads parsed. Results:\n${await fhandler.download(message.author.id, selection.customId, message.attachments)}`, ephemeral: true });
			if (busy) message.reply({ content: `I'm currently in a match - your newly added track will not be used until my next session!`, ephemeral: true });
		} catch (e) {
			await response.edit({ content: 'Selection was not made in 1 minute. Abort download.', components: [] });
		}
	}
});