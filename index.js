// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const https = require('https');
const fhandler = require('./lib/filehandler.js');
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
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
const { guildId, token, musicPlayerId } = require('./config.json');

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
	color: 0xffffff,
	title: 'Riichi Player',
	author: {
		name: 'Chuck',
		icon_url: 'https://riichi.wiki/images/thumb/Pin_1.png/48px-Pin_1.png'
	},
	description: 'Starting...',
	thumbnail: {
		url: 'attachment://ichihime-10.png',
	},
	fields: [],
	timestamp: '0',
	footer: {
		text: 'Session started:'
	},
};

async function getUserById(id) {
	if (id === 0 || id === '0') return 'MahjongSoul';
	const member = await client.guilds.cache.get(guildId).members.fetch(id);
	if (!member || !member.nickname) return 'Unregistered user';
	return member.nickname;
}

function resetEmbed(timeFlag = true) {
	playerEmbed.thumbnail.url = 'attachment://ichihime-10.png';
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
	playerEmbed.thumbnail.url = 'attachment://ichihime-11.png';
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

function changeTrack(parent, type, user = 0) {
	switch (type) {
		case 'hanchan':
			player.play(createAudioResource(`./music/hanchan/${hanchanMedia[currentPlayback]}`));
			const info = hanchanMedia[currentPlayback].substring(0, hanchanMedia[currentPlayback].length - 4).split('/');
			getUserById(info[0]).then(user => {
				updateEmbedTrack(info[1], user);
				if (playerEmbed.thumbnail.url != "attachment://ichihime-3.png") {
					playerEmbed.thumbnail.url = "attachment://ichihime-3.png";
					playerEmbed.description = 'Playing Mahjong.';
					parent.edit({ embeds: [playerEmbed], files: ['./assets/ichihime/ichihime-3.png'] });
				}
				else {
					parent.edit({ embeds: [playerEmbed] });
				}
			});
			currentPlayback = (currentPlayback + 1) % hanchanMedia.length;
			if (currentPlayback === 0) hanchanMedia = shuffle(hanchanMedia);

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
			var personalPlaylist = fs.readdirSync(`./music/riichi/${user}/`).filter(file => file.endsWith('.mp3'));
			const isPersonal = personalPlaylist.length > 0;
			if (personalPlaylist.length === 0) personalPlaylist = fs.readdirSync(`./music/riichi/0/`).filter(file => file.endsWith('.mp3'));
			const roll = personalPlaylist[Math.floor(Math.random() * personalPlaylist.length)]
			isPersonal ? player.play(createAudioResource(`./music/riichi/${user}/${roll}`)) : player.play(createAudioResource(`./music/riichi/0/${roll}`));
			getUserById(user).then(u => {
				var newRiichi = false;
				if (!riichiTable.includes(user)) {
					riichiTable.push(user);
					newRiichi = true;
				}
				playerEmbed.description = 'In Riichi!';
				updateEmbedTrack(roll.substring(0, roll.length - 4), isPersonal ? u : 'MahjongSoul', riichiTable.length, newRiichi ? u : false);
				switch (riichiTable.length) {
					case 1:
						playerEmbed.thumbnail.url = "attachment://ichihime-6.png";
						newRiichi ? parent.edit({ embeds: [playerEmbed], files: ['./assets/ichihime/ichihime-6.png'] }) : parent.edit({ embeds: [playerEmbed] });
						break;
					case 2:
						playerEmbed.thumbnail.url = "attachment://ichihime-7.png";
						newRiichi ? parent.edit({ embeds: [playerEmbed], files: ['./assets/ichihime/ichihime-7.png'] }) : parent.edit({ embeds: [playerEmbed] });
						break;
					default:
						playerEmbed.thumbnail.url = "attachment://ichihime-8.png";
						newRiichi ? parent.edit({ embeds: [playerEmbed], files: ['./assets/ichihime/ichihime-8.png'] }) : parent.edit({ embeds: [playerEmbed] });
				}
			});

			player.removeAllListeners('idle');
			player.on('idle', function () {
				player.play(createAudioResource(`./music/riichi/${user}/${roll}`));
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
			i.reply({ content: "You cannot interact with Chuck because you're not in the same voice channel.", ephemeral: true });
			return;
		}
		i.deferUpdate();

		switch (i.customId) {
			case 'hanchan':
				console.log("Hanchan called.");
				changeTrack(parent, 'hanchan', i.user.id);
				riichiTable = [];
				break;
			case 'riichi':
				console.log("Riichi called.");
				changeTrack(parent, 'riichi', i.user.id);
				break;
			case 'standby':
				console.log("On standby.");
				player.removeAllListeners('idle');
				player.stop();
				resetEmbed(false);
				parent.edit({ embeds: [playerEmbed], files: ['./assets/ichihime/ichihime-10.png'] });
				break;
			case 'dismiss':
				console.log("Dismissed.");
				player.removeAllListeners('idle');
				player.stop();
				finishEmbed();
				parent.edit({ embeds: [playerEmbed], components: [], files: ['./assets/ichihime/ichihime-11.png'] });
				collector.stop();
				connection.destroy();
				hanchanMedia = null;
				currentPlayback = 0;
				riichiTable = [];
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
	client.application.commands.set([]);
});

// Log in to Discord with your client's token
client.login(token);

client.on('messageCreate', async message => {
	if (message.mentions.has(client.user)) {
		if (client.voice.adapters.size > 0) return message.reply('I am already participating in a voice channel.');

		const channel = message.member?.voice.channel;
		if (channel) {
			try {
				const connection = await connectToChannel(channel);
				resetEmbed();
				const playerChannel = client.channels.cache.get(musicPlayerId);
				const parent = await playerChannel.send({ embeds: [playerEmbed], components: [playbackRow], files: ['./assets/ichihime/ichihime-10.png'] });
				initSession(connection, parent, message.member?.voice.channelId);
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
	else if (message.attachments.size > 0) {
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
		} catch (e) {
			await response.edit({ content: 'Selection was not made in 1 minute. Abort download.', components: [] });
		}
	}
});