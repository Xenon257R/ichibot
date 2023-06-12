// Require the necessary discord.js classes
const fs = require('node:fs');
const fhandler = require('./lib/filehandler.js');
const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const {
	NoSubscriberBehavior,
	StreamType,
	createAudioPlayer,
	createAudioResource,
	entersState,
	VoiceConnectionStatus,
	joinVoiceChannel,
	getVoiceConnection,
} = require('@discordjs/voice');
const { prefix, clientId, commandId, guildId, token, musicPlayerId, uploadId } = require('./config.json');
const { imageUrl } = require('./emotes.json');

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

// Create a universal playback device
const player = createAudioPlayer({
	behaviors: {
		noSubscriber: NoSubscriberBehavior.Pause,
	},
});

// Create a playback action row for use
const hanchanButton = new ButtonBuilder()
	.setCustomId('hanchan')
	.setLabel('Hanchan')
	.setStyle(ButtonStyle.Primary);

const riichiButton = new ButtonBuilder()
	.setCustomId('riichi')
	.setLabel('Riichi')
	.setStyle(ButtonStyle.Success);

const standbyButton = new ButtonBuilder()
	.setCustomId('standby')
	.setLabel('Standby')
	.setStyle(ButtonStyle.Secondary);

const dismissButton = new ButtonBuilder()
	.setCustomId('dismiss')
	.setLabel('Dismiss')
	.setStyle(ButtonStyle.Danger);

const playbackRow = new ActionRowBuilder().addComponents(hanchanButton, riichiButton, standbyButton, dismissButton);

const hPlaylist = new ButtonBuilder()
	.setCustomId('h')
	.setLabel('Hanchan Playlist')
	.setStyle(ButtonStyle.Primary);

const rPlaylist = new ButtonBuilder()
	.setCustomId('r')
	.setLabel('Riichi Playlist')
	.setStyle(ButtonStyle.Primary);

const uploadRow = new ActionRowBuilder().addComponents(hPlaylist, rPlaylist);

// An embedded player to use for playback
const playerEmbed = {
	color: 0xffbb9d,
	title: 'Status:',
	author: {
		name: 'IchiBot',
		icon_url: imageUrl[18]
	},
	description: 'Starting...',
	thumbnail: {
		url: imageUrl[10],
	},
	fields: [],
	timestamp: '0',
	footer: {
		text: 'Session started:'
	},
};

let busy = false;
let masterPlayer;

async function getUserById(id) {
	if (id === 0 || id === '0') return 'IchiBot';
	const member = await client.guilds.cache.get(guildId).members.fetch(id);
	if (!member || !member.nickname) return 'Unregistered user';
	return member.nickname;
}

function resetEmbed(timeFlag = true) {
	playerEmbed.thumbnail.url = imageUrl[10];
	playerEmbed.description = 'On standby.'
	playerEmbed.fields = [
		{
			name: 'Currently Playing:',
			value: `\`[Nothing]\``
		},
		{
			name: 'Curator:',
			value: 'N/A'
		},
		{
			name: 'Players in Riichi',
			value: '0',
			inline: true
		},
		{
			name: 'Last Riichi Declaration',
			value: 'N/A',
			inline: true
		}
	];
	if (timeFlag) playerEmbed.timestamp = new Date().toISOString();
	playerEmbed.footer.text = 'Session started:'
}

function finishEmbed() {
	playerEmbed.thumbnail.url = imageUrl[Math.floor(Math.random()*18)];
	playerEmbed.description = 'Completed session.'
	playerEmbed.fields = [];
	playerEmbed.timestamp = new Date().toISOString();
	playerEmbed.footer.text = 'Session ended:'
}

function updateEmbedTrack(trackName, curator, riichi = 0, lastRiichi = 'N/A') {
	if (trackName.length > 32) trackName = trackName.substring(0, 31).trim() + '…';
	playerEmbed.fields[0].value = `\`${trackName.replace(new RegExp('_', 'g'), ' ')}\``;
	playerEmbed.fields[1].value = curator;
	playerEmbed.fields[2].value = riichi;
	if (lastRiichi) playerEmbed.fields[3].value = lastRiichi;
}


// Compiles an array of [.ogg] files with categories
function compile(variant, author) {
	return fs.readdirSync(`./music/${variant}/${author}/`).filter(file => file.endsWith('.mp3'));
}

// Compiles all users' [.mp3] files
function compileAll(variant) {
	const directories = fs.readdirSync(`./music/${variant}/`).filter(dirent => fs.lstatSync(`./music/${variant}/${dirent}`).isDirectory());
	const mediaFiles = [];
	directories.forEach(dir => {
		const medialist = fs.readdirSync(`./music/${variant}/${dir}/`).filter(file => file.endsWith('.mp3'));
		medialist.forEach(media => {
			mediaFiles.push(dir + '/' + media);
		});
	});
	return mediaFiles;
}

let hanchanMedia = null;
let currentPlayback = 0;
let riichiTable = [];

function changeTrack(parent, type, user = 0, track) {
	switch (type) {
		case 'hanchan':
			let custom = track ? compile('hanchan', user)[track - 1] : null;
			track ? player.play(createAudioResource(`./music/hanchan/${user}/${custom}`)) : player.play(createAudioResource(`./music/hanchan/${hanchanMedia[currentPlayback]}`));
			const info = track ? [ user, custom.substring(0, custom.length - 4) ] : hanchanMedia[currentPlayback].substring(0, hanchanMedia[currentPlayback].length - 4).split('/');
			getUserById(info[0]).then(user => {
				updateEmbedTrack(info[1], user);
				if (playerEmbed.thumbnail.url != imageUrl[3]) {
					playerEmbed.thumbnail.url = imageUrl[3];
					playerEmbed.description = 'Playing Mahjong.';
					parent.edit({ embeds: [playerEmbed] });
				}
				else {
					parent.edit({ embeds: [playerEmbed] });
				}
			});

			if (!track) {
				currentPlayback = (currentPlayback + 1) % hanchanMedia.length;
				if (currentPlayback === 0) hanchanMedia = shuffle(hanchanMedia);
			}

			player.removeAllListeners('idle');
			player.on('idle', function () {
				player.play(createAudioResource(`./music/hanchan/${hanchanMedia[currentPlayback]}`));
				const info = hanchanMedia[currentPlayback].substring(0, hanchanMedia[currentPlayback].length - 4).split('/');
				getUserById(info[0]).then(user => {
					updateEmbedTrack(info[1], user);
					parent.edit({ embeds: [playerEmbed] });
				});
				currentPlayback = (currentPlayback + 1) % hanchanMedia.length;
				if (currentPlayback === 0) hanchanMedia = shuffle(hanchanMedia);
			});
			break;
		case 'riichi':
			var personalPlaylist = fs.existsSync(`./music/riichi/${user}`) ? fs.readdirSync(`./music/riichi/${user}/`).filter(file => file.endsWith('.mp3')) : [];
			const isPersonal = personalPlaylist.length > 0;
			if (personalPlaylist.length === 0) personalPlaylist = fs.readdirSync(`./music/riichi/0/`).filter(file => file.endsWith('.mp3'));
			const roll = track ? personalPlaylist[track - 1] : personalPlaylist[Math.floor(Math.random() * personalPlaylist.length)];
			isPersonal ? player.play(createAudioResource(`./music/riichi/${user}/${roll}`)) : player.play(createAudioResource(`./music/riichi/0/${roll}`));
			getUserById(user).then(u => {
				var newRiichi = false;
				if (!riichiTable.includes(user)) {
					riichiTable.push(user);
					newRiichi = true;
				}
				playerEmbed.description = 'In Riichi!';
				updateEmbedTrack(roll.substring(0, roll.length - 4), isPersonal ? u : 'IchiBot', riichiTable.length + (riichiTable.length >= 4 ? '...?' : ''), newRiichi ? u : false);
				switch (riichiTable.length) {
					case 1:
						playerEmbed.thumbnail.url = imageUrl[6];
						parent.edit({ embeds: [playerEmbed] });
						break;
					case 2:
						playerEmbed.thumbnail.url = imageUrl[7];
						parent.edit({ embeds: [playerEmbed] });
						break;
					case 3:
						playerEmbed.thumbnail.url = imageUrl[8];
						parent.edit({ embeds: [playerEmbed] });
						break;
					default:
						playerEmbed.thumbnail.url = imageUrl[2];
						parent.edit({ embeds: [playerEmbed] });
				}
			});

			player.removeAllListeners('idle');
			player.on('idle', function () {
				isPersonal ? player.play(createAudioResource(`./music/riichi/${user}/${roll}`)) : player.play(createAudioResource(`./music/riichi/0/${roll}`));
			});
			break;
		default:
			console.log(`Invalid Change Track type: ${type}`);
	}
}

// Connects to specified channel asynchronously
async function connectToChannel(channel) {
	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
		return connection;
	}
	catch (error) {
		connection.destroy();
		throw error;
	}
}

// CITATION: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
	let currentIndex = array.length, randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex != 0) {
		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
	}

	return array;
}

function initSession(connection, parent, voiceChannel) {
	const playerChannel = client.channels.cache.get(musicPlayerId);
	const collector = playerChannel.createMessageComponentCollector();
	hanchanMedia = shuffle(compileAll('hanchan'));
	currentPlayback = 0;

	collector.on('collect', async i => {
		if (!client.channels.cache.get(voiceChannel).members.get(i.user.id)) {
			i.reply({ content: "You cannot interact with IchiBot because you're not in the same voice channel.", ephemeral: true });
			return;
		}
		i.deferUpdate();

		switch (i.customId) {
			case 'hanchan':
				busy = true;
				console.log("Hanchan called.");
				changeTrack(parent, 'hanchan', i.user.id);
				riichiTable = [];
				break;
			case 'riichi':
				busy = true;
				console.log("Riichi called.");
				changeTrack(parent, 'riichi', i.user.id);
				break;
			case 'standby':
				busy = false;
				console.log("On standby.");
				player.removeAllListeners('idle');
				player.stop();
				riichiTable = [];
				resetEmbed(false);
				parent.edit({ embeds: [playerEmbed] });
				break;
			case 'dismiss':
				busy = false;
				console.log("Dismissed.");
				player.removeAllListeners('idle');
				player.stop();
				finishEmbed();
				parent.edit({ embeds: [playerEmbed], components: [] });
				collector.stop();
				connection.destroy();
				hanchanMedia = null;
				currentPlayback = 0;
				riichiTable = [];
				client.user.setPresence({
					status: 'idle'
				});
				break;
			default:
				console.log("Invalid input.");
		}
	});
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	client.user.setStatus('idle');
});

// Log in to Discord with your client's token
client.login(token);

client.on('messageCreate', async message => {
	if (message.author.bot) return;

	if (message.content.startsWith(prefix) && message.channelId === commandId) {
		// Trims the message into components delimited by spaces
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const command = args.shift().toLowerCase();

		switch (command) {
			case 'l':
			case 'list':
			case 'playlist':
				let type = 'hanchan';
				if (args[0] && args.shift().toLowerCase() === 'r') type = 'riichi';

				let idList = [];
				for (const m of message.mentions.users.values()) {
					if (m.id === clientId) idList.push(0);
					else idList.push(m.id);
				}
				if (idList.length <= 0) idList.push(message.author.id);
				
				for (const id of idList) {
					let stringifiedList = ''
					const list = compile(type, id);
					for (let i = 0; i < list.length; i++) {
						stringifiedList = stringifiedList.concat((i + 1).toString().padStart(2, '0'), ' | ', list[i].substring(0, list[i].length - 4).replace(new RegExp('_', 'g'), ' '), '\n');
					}
					message.channel.send(`\`\`\`ini\n[${(await getUserById(id)).replace(new RegExp('\\[', 'g'), '(').replace(new RegExp('\\]', 'g'), ')')} - ${type}]\n${stringifiedList}\`\`\``);
				}
				break;
			case 'd':
			case 'delete':
				if (busy) {
					message.reply("I'm currenty busy playing Riichi! Please wait until I'm idle to delete files.");
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
				if (client.voice.adapters.size <= 0 || !client.channels.cache.get(message.member?.voice.channelId).members.get(clientId)) {
					message.reply('I am not currently in the same voice channel as you to force playback.');
					return;
				}
				let listtype = 'hanchan';
				let identifier = args.shift().toLowerCase()
				if (!identifier) {
					message.reply('You did not provide a playlist type. `h` and `r` are accepted.');
					return;
				}
				else if (identifier === 'h') listtype = 'hanchan';
				else if (identifier === 'r') listtype = 'riichi';
				else {
					message.reply('You did not provide a valid playlist type. Only `h` and `r` are accepted.');
					return;
				}
				const list = compile(listtype, message.author.id).length > 0 ? compile(listtype, message.author.id) : compile(listtype, 0);

				const index = Math.floor(parseInt(args.shift()));
				if (isNaN(index) || index > list.length || index <= 0) {
					message.reply('You did not provide a valid track number. Use `-l`, `-l r` or `-l h` to view your playlist to identify the correct number.');
					return;
				}
				changeTrack(masterPlayer, listtype, message.author.id, index);
				break;
			default:
				message.reply('This is an invalid command. Refer to #documentation for details on how to use the bot.');
		}
	}
	else if (message.mentions.has(client.user) && !message.mentions.everyone && message.channelId === commandId) {
		if (client.voice.adapters.size > 0) return message.reply('I am already participating in a voice channel.');

		const channel = message.member?.voice.channel;
		if (channel) {
			try {
				const connection = await connectToChannel(channel);
				client.user.setPresence({
					status: 'dnd'
				});
				resetEmbed();
				const playerChannel = client.channels.cache.get(musicPlayerId);
				masterPlayer = await playerChannel.send({ embeds: [playerEmbed], components: [playbackRow] });
				initSession(connection, masterPlayer, message.member?.voice.channelId);
				connection.subscribe(player);
			}
			catch (error) {
				console.error(error);
			}
		}
		else {
			await message.reply('Join a voice channel so I know where to go!');
		}
	}
	else if (message.attachments.size > 0 && message.channelId === uploadId) {
		// Creates directories if they don't exist yet
		if (!fs.existsSync(`./music/hanchan/${message.author.id}`) || !fs.existsSync(`./music/riichi/${message.author.id}`)){
			fs.mkdirSync(`./music/hanchan/${message.author.id}`);
			fs.mkdirSync(`./music/riichi/${message.author.id}`);
		}

		// Waiting for type response
		const response = await message.reply({ content: `Which playlist should the above track(s) be assigned to?`, components: [uploadRow] });

		const collectorFilter = i => i.user.id === message.author.id;

		try {
			const selection = await response.awaitMessageComponent({ filter: collectorFilter, time: 60000 });
			await response.edit( { content: `Uploading to your ${selection.customId === 'h' ? 'Hanchan' : 'Riichi' } playlist...`, components: [] });
			message.reply({ content: `Uploads parsed. Results:\n${await fhandler.download(message.author.id, selection.customId, message.attachments)}`, ephemeral: true });
			if (busy) message.reply({ content: `I'm currently in a match - your newly added track will not be used until my next session!`, ephemeral: true });
		} catch (e) {
			await response.edit({ content: 'Selection was not made in 1 minute. Abort download.', components: [] });
		}
	}
});