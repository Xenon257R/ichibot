const {
	NoSubscriberBehavior,
	AudioPlayerStatus,
	StreamType,
	createAudioPlayer,
	createAudioResource,
	entersState,
	VoiceConnectionStatus,
	joinVoiceChannel,
	getVoiceConnection,
} = require('@discordjs/voice');
const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits, ActionRow } = require('discord.js');
const { imageUrl, happyImage, sadImage } = require('../emotes.json');
const { clientId, extender } = require('../config.json');
const sqlitehandler = require('./sqlitehandler');

const activePlayers = {};

const term = {
    mahjong: {
        h: 'Hanchan',
        r: 'Riichi',
        p: 'Last Riichi Declaration:',
		icon: '🀄',
		idle: 'Playing Mahjong.'
    },
    generic: {
        h: 'Ambient',
        r: 'Battle',
        p: 'Current Player:',
		icon: '⚔️',
		idle: 'Idling around.'
    }
}

const jModes = [
	{
		name: 'Once',
		icon: '1️⃣'
	},
	{
		name: 'Repeat',
		icon: '🔁'
	},
	{
		name: 'In-Order',
		icon: '➡️'
	},
	{
		name: 'Shuffle',
		icon: '🔀'
	}
 ]

// A server Music Player class to handle an instance of IchiBot on a per-server basis
class serverPlayer {
	constructor(server, voiceChannel, embedChannel, connection, selectedTerm, selectedJukeboxMode) {
		this.lock = false;

		this.master = undefined;
		this.embedChannel = embedChannel;
		this.server = server;

		this.player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Pause,
			},
		});
		this.player.on('error', error => {
			console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
			this.player.stop();
		});

		this.term = selectedTerm;
		this.channel = voiceChannel;
		this.embed = {
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
			timestamp: new Date().toISOString(),
			footer: {
				text: 'Session started:'
			}
		};
		this.connection = connection;
		this.collector = embedChannel.createMessageComponentCollector();
		this.jukebox = { album: undefined, page: 0, select: -1, mode: selectedJukeboxMode };

		this.buttons = {
			mahjong : [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('hanchan').setLabel(selectedTerm.h).setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('riichi').setLabel(selectedTerm.r).setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('standby').setLabel('Standby').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('dismiss').setLabel('Dismiss').setStyle(ButtonStyle.Danger),
					new ButtonBuilder().setCustomId('jukebox').setLabel('Jukebox').setStyle(ButtonStyle.Success)
				)
			],
			jukebox : [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('1').setLabel('01').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('2').setLabel('02').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('3').setLabel('03').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('4').setLabel('04').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('5').setLabel('05').setStyle(ButtonStyle.Primary)
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('6').setLabel('06').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('7').setLabel('07').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('8').setLabel('08').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('9').setLabel('09').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('10').setLabel('10').setStyle(ButtonStyle.Primary)
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('prev').setLabel('<<').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('stop').setLabel('⏹').setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('game').setLabel(selectedTerm.icon).setStyle(ButtonStyle.Danger),
					new ButtonBuilder().setCustomId('mode').setLabel(jModes[this.jukebox.mode].icon).setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('next').setLabel('>>').setStyle(ButtonStyle.Secondary)
				)
			]
		}
		this.mode = 'mahjong';
	}

	// Render embed (if it hasn't been deleted)
	async renderEmbed(contents) {
		try {
			await this.embedChannel.messages.fetch(this.master.id);
			this.master.edit(contents);
		} catch (err) {
			console.log("Message no longer exists. Further attempts for rendering embed will fail.");
		}
	}

	// Resets the embed to its initial state
	resetEmbed() {
		this.embed.thumbnail.url = Math.random() < 0.5 ? imageUrl[9] : imageUrl[12];
		this.embed.title = 'Status:';
		this.embed.description = 'On standby.';
		this.embed.fields = [
			{
				name: '__Currently Playing:__',
				value: '`[Nothing]`',
				inline: true
			},
			{
				name: '__Curator:__',
				value: '`N/A`',
				inline: true
			},
			{
				name: this.term.p,
				value: 'N/A'
			}
		];
		this.embed.image = { url: extender };
		this.embed.footer.text = 'Session started:';
		this.mode = 'mahjong';
	}

	// Closes the embed with final timestamps and cleaned fields
	closeEmbed(timeout) {
		if (timeout) this.embed.thumbnail.url = imageUrl[sadImage[Math.floor(Math.random() * sadImage.length)]];
		else this.embed.thumbnail.url = imageUrl[happyImage[Math.floor(Math.random() * happyImage.length)]];
		this.embed.description = 'Completed session.';
		this.embed.fields = [];
		if (this.embed.image) delete this.embed.image;
		this.embed.timestamp = new Date().toISOString();
		this.embed.footer.text = 'Session ended:'
	}

	// Updates the embed with the currently playing track
	updateEmbedTrack(trackName, curator, player = 'N/A') {
		if (trackName.length > 25) trackName = trackName.substring(0, 24).trim() + '…';
		this.embed.fields[0].value = `\`${trackName}\``;
		if (curator.length > 12) {
			curator = curator.substring(0, 11).trim() + '…';
		}
		this.embed.fields[1].value = `\`${curator}\``;
		this.embed.fields[2].value = player;
		this.embed.image.url = extender;
	}

	// Generates a code block of the server's tracks for Jukebox mode
	generateJukeboxPage() {
		let tenTracks = '';
		let pageHeader = `md\nPage ${this.jukebox.page + 1} of ${Math.ceil(this.jukebox.album.length / 10)}\n----------------------------------------\n`;
		for (let i = 0; i < 10; i++) {
			let j = i + (this.jukebox.page * 10);
			tenTracks = tenTracks + `[${i < 9 ? '0' : ''}${i + 1}]`;
			if (this.jukebox.album[j]) {
				let trackName = this.jukebox.album[j].track_name;
				if (trackName.length > 32) trackName = trackName.substring(0, 31).trim() + '…';
				else {
					if (trackName.length < 32) trackName = trackName + ' ';
					while (trackName.length < 32) trackName = trackName + (this.jukebox.select === j ? '-' : ' ');
				}
				tenTracks = tenTracks + (this.jukebox.select === j ? `[ ${trackName} ]` : `( ${trackName} )`);
			}
			else tenTracks = tenTracks + ` # --- `
			if (i != 9) tenTracks = tenTracks + '\n';
		}

		return `\`\`\`${pageHeader}${tenTracks}\`\`\``;
	}

	// Modifies Jukebox buttons by enabling/disabling them accordingly
	editJukeboxButtons() {
		let buttons = this.buttons.jukebox;
		for (let i = 0; i < 5; i++) {
			if (i + (this.jukebox.page * 10) < this.jukebox.album.length) buttons[0].components[i].setDisabled(false);
			else buttons[0].components[i].setDisabled(true);
			if (i + 5 + (this.jukebox.page * 10) < this.jukebox.album.length) buttons[1].components[i].setDisabled(false);
			else buttons[1].components[i].setDisabled(true);
		}
		if (this.jukebox.page <= 0) buttons[2].components[0].setDisabled(true);
		else buttons[2].components[0].setDisabled(false);
		if (this.jukebox.page >= (Math.ceil(this.jukebox.album.length / 10) - 1)) buttons[2].components[4].setDisabled(true);
		else buttons[2].components[4].setDisabled(false);

		// Modifies Jukebox mode button
		buttons[2].components[3].setLabel(jModes[this.jukebox.mode].icon);
	}

	// Changes the embed to Jukebox mode
	changeToJukebox(newAlbum) {
		this.jukebox.album = newAlbum;
		this.jukebox.page = 0;
		this.jukebox.select = -1;
		switch(Math.floor(Math.random() * 3)) {
			case 0:
				this.embed.thumbnail.url = imageUrl[10];
				break;
			case 1:
				this.embed.thumbnail.url = imageUrl[14];
				break;
			default:
				this.embed.thumbnail.url = imageUrl[16];
		}
		this.embed.title = 'Mode:';
		this.embed.description = jModes[this.jukebox.mode].name;
		this.embed.fields = [
			{
				name: '__Currently Playing:__',
				value: '`[Nothing]`',
				inline: true
			},
			{
				name: '__Curator:__',
				value: '`N/A`',
				inline: true
			},
			{
				name: 'Tracks:',
				value: this.generateJukeboxPage()
			}
		];
		delete this.embed.image;
		this.mode = 'jukebox';
	}

	// Updates the Jukebox embed details
	async updateJukebox() {
		this.embed.description = jModes[this.jukebox.mode].name;

		if (!this.jukebox.album[this.jukebox.select]) {
			this.embed.fields[0].value = '`[Nothing]`';
			this.embed.fields[1].value = '`N/A`';
		}
		else {
			this.embed.fields[0].value = `\`${this.jukebox.album[this.jukebox.select].track_name}\``;
			let player = await getUserById(this.jukebox.album[this.jukebox.select].user_id, this.server);
			if (player.length > 15) {
				player = player.substring(0, 14).trim() + '…';
			}
			this.embed.fields[1].value = `\`${player}\``;
		}
		this.embed.fields[2].value = this.generateJukeboxPage();
		this.editJukeboxButtons();
		await this.renderEmbed({ embeds: [this.embed], components: this.buttons.jukebox });
	}
}

// Returns username of [id] on [server], giving priority to their nickname
async function getUserById(id, server) {
	if (id === 0 || id === '0') id = clientId;
	const member = await server.members.fetch(id);
	if (!member || (member.user && !member.user.username)) return 'Unknown';
	if (!member.nickname) return member.user.username;
	return member.nickname;
}

// Creates audio resource and optimizes stream creation
// CITATION: https://discordjs.guide/voice/audio-resources.html#playing-opus-streams
function makeAudioStream(url) {
	return createAudioResource(url);
}

// Sorts by ascending alphabetical order
// CITATION: https://stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value
function compareAsc(a, b) {
	if ( a.track_name < b.track_name ){
	  return -1;
	}
	if ( a.track_name > b.track_name ){
	  return 1;
	}
	return 0;
}

// Shuffles a given array's contents
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

const jargonChars = "bBfFgGhHjJkKlLpPqQvuUVwWxXyYzZ1234567890!!!!????$$$&&&";
// Generates a jargon string of (min+extend) length
function jargon(min = 1, extend = 1) {
	let resultString = '';
	for (let i = 0; i < (min + (Math.floor(Math.random() * extend))); i++) {
		resultString = resultString + jargonChars.charAt(Math.floor(Math.random() * jargonChars.length));
	}

	return resultString;
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

module.exports = {
    createVoice : async function(adapters, server, channelId, playerChannel, lastJukeboxMode) {
		console.log(`Last Jukebox Mode: ${lastJukeboxMode}`);
		// Creates all necessary components for when IchiBot joins a voice channel
		if (!playerChannel) return 'missing';
		const server_id = server.id;
		if (adapters[server_id]) {
			console.log("Connection already exists on server.");
			return 'occupied';
		}
		if (activePlayers[server_id]) {
			console.log("Remnants of old player detected. Cleaning up...");
			this.disconnectVoice(server_id);
			console.log("Cleanup finished.");
		}

		// create Player
		const connection = await connectToChannel(channelId);
		const selectedTerm = await sqlitehandler.isMahjong(server_id) ? term.mahjong : term.generic;
	
		const instance = new serverPlayer(server, channelId, playerChannel, connection, selectedTerm, lastJukeboxMode);
		instance.resetEmbed();

		instance.master = await playerChannel.send({ embeds: [instance.embed], components: instance.buttons.mahjong });
		let hList = shuffle(await sqlitehandler.retrieveList(server_id, 'h'));
		let hSlct = 0;

		instance.collector.on('collect', async i => {
			if (instance.lock) {
				i.deferUpdate();
				return false;
			}
			instance.lock = true;

			if (server.members.cache.get(i.user.id).voice.channel.id != channelId) {
				instance.lock = false;
				i.reply({ content: `You cannot interact with IchiBot because you're not in the same voice channel.`, ephemeral: true });
				return;
			}
	
			switch (i.customId) {
				case 'hanchan':
					if (hList.length <= 0) {
						instance.lock = false;
						i.reply({ content: `There are no tracks listed in the ${instance.term.h.toLowerCase()} playlist in this server. Add some to use this playlist, or enable default in the bot settings.`, ephemeral: true });
						return;
					}					
					hSlct = (hSlct + 1) % hList.length;

					if (instance.embed.thumbnail.url != imageUrl[3]) {
						instance.embed.thumbnail.url = imageUrl[3];
						instance.embed.description = instance.term.idle;
					}
					instance.updateEmbedTrack(hList[hSlct].track_name, await getUserById(hList[hSlct].user_id, server));
					instance.renderEmbed({ embeds: [instance.embed] });

					instance.player.stop();
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.play(makeAudioStream(hList[hSlct].track_url));
					instance.player.on(AudioPlayerStatus.Idle, async function() {
						hSlct = (hSlct + 1) % hList.length;
						if (hSlct === 0) hList = shuffle(hList);
						instance.updateEmbedTrack(hList[hSlct].track_name, await getUserById(hList[hSlct].user_id, server));
						instance.renderEmbed({ embeds: [instance.embed] });

						instance.player.stop();
						instance.player.play(makeAudioStream(hList[hSlct].track_url));
					});
					break;
				case 'riichi':
					let rList = await sqlitehandler.retrieveList(server_id, 'r', i.user.id);
					if (rList.length <= 0) {
						instance.lock = false;
						i.reply({ content: `There are no tracks listed in your ${instance.term.r.toLowerCase()} playlist in this server. Add some to your playlist, or enable default in the bot settings.`, ephemeral: true });
						return;
					}
					const rSlct = rList[Math.floor(Math.random() * rList.length)];

					const customImage = await sqlitehandler.checkProfile(server_id, i.user.id);
					if (customImage) instance.embed.thumbnail.url = customImage.custom_image;
					else instance.embed.thumbnail.url = Math.random() < 0.5 ? imageUrl[6] : imageUrl[7];
					instance.embed.description = `In ${instance.term.r}!`;
					instance.updateEmbedTrack(rSlct.track_name, await getUserById(rSlct.user_id, server), await getUserById(i.user.id, server));
					instance.renderEmbed({ embeds: [instance.embed] });

					instance.player.stop();
					instance.player.play(makeAudioStream(rSlct.track_url));
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.on(AudioPlayerStatus.Idle, function() {
						instance.player.play(makeAudioStream(rSlct.track_url));
					});
					break;
				case 'standby':
				case 'game':
					console.log("On standby.");
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.stop();
					instance.resetEmbed();
					instance.renderEmbed({ embeds: [instance.embed], components: instance.buttons.mahjong });
					break;
				case 'dismiss':
				case 'exit':
					sqlitehandler.modifyServer(server_id, 'jukebox_mode', instance.jukebox.mode).then(console.log(`Last jukebox mode used [${jModes[instance.jukebox.mode].name}] remembered.`));
					await this.disconnectVoice(server_id);
					break;
				case 'mode':
					instance.jukebox.mode = (instance.jukebox.mode + 1) % jModes.length;
					await instance.updateJukebox();
					break;
				case 'jukebox':
					console.log("Switching to JUKEBOX mode.");
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.stop();
					instance.changeToJukebox((await sqlitehandler.retrieveList(server_id)).sort(compareAsc));
					await instance.updateJukebox();
					break;
				case '1':
				case '2':
				case '3':
				case '4':
				case '5':
				case '6':
				case '7':
				case '8':
				case '9':
				case '10':
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.stop();
					instance.jukebox.select = ((parseInt(i.customId) - 1) + (instance.jukebox.page * 10));
					let jSlct = instance.jukebox.album[instance.jukebox.select];
					if (jSlct) {
						await instance.updateJukebox();
						instance.player.play(makeAudioStream(jSlct.track_url));
						instance.player.on(AudioPlayerStatus.Idle, async function() {
							switch (instance.jukebox.mode) {
								case 0:
									// [In Order] mode
									instance.jukebox.select = (instance.jukebox.select + 1) % instance.jukebox.album.length;
									break;
								case 1:
									// [Repeat] mode
									break;
								case 2:
									// [Shuffle] mode
									if (instance.jukebox.album.length > 1) {
										let newNext = Math.floor(Math.random() * (instance.jukebox.album.length - 1));
										if (newNext >= instance.jukebox.select) newNext = newNext + 1;
										instance.jukebox.select = newNext;
									}
									break;
								default:
									// [Once] mode
									instance.jukebox.select = -1;
							}
							jSlct = instance.jukebox.album[instance.jukebox.select];
							await instance.updateJukebox();
							if (instance.jukebox.select >= 0) instance.player.play(makeAudioStream(jSlct.track_url));
						});
					}
					break;
				case 'prev':
				case 'next':
					instance.jukebox.page = instance.jukebox.page + (i.customId === 'prev' ? -1 : 1);
					await instance.updateJukebox();
					break;
				case 'stop':
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.stop();
					instance.jukebox.select = -1;
					await instance.updateJukebox();
					break;
				default:
					console.log("Invalid input.");
			}

			instance.lock = false;
			// Returns completion response
			i.deferUpdate();
		});

		// Subscribes IchiBot to voice channel
		connection.subscribe(instance.player);

		// Logs server connection as complete
		activePlayers[server_id] = instance;

		return true;
    },
    disconnectVoice : async function(serverId, timeout = false) {
		// Handles destruction of components when IchiBot leaves a voice channel
        const sPlayer = activePlayers[serverId];
        if (!sPlayer) return;
		
		sPlayer.closeEmbed(timeout);
		sPlayer.jukebox.album = undefined;
		sPlayer.jukebox.page = 0;
		sPlayer.renderEmbed({ embeds: [sPlayer.embed], components: [] });

        sPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
        sPlayer.player.stop();
		sPlayer.collector.stop();
		sPlayer.connection.destroy();
        delete activePlayers[serverId];
		
		console.log(`Disconnected from voice chat in server [${serverId}].`);

		return true;
    },
	forcePlay : async function(serverId, mention, specifiedTrack) {
		// Forces playback on the music player according to its mode
		const instance = activePlayers[serverId];
		if (!instance) return "IchiBot is not currently in any voice channel to play anything.";

		switch (instance.mode) {
			case 'jukebox':
				// Forces playback in Jukebox mode, where it only accepts track names
				if (!specifiedTrack) return "You did not provide a track name to play. Make sure it also exists on the server!";

				// Searches for specified track
				let jumpIndex = -1;
				for (let i = 0; i < instance.jukebox.album.length; i++) {
					if (instance.jukebox.album[i].track_name === specifiedTrack) {
						jumpIndex = i;
						break;
					}
				}
				if (jumpIndex < 0) return `The specified track [${specifiedTrack}] was not found on this server or may be disabled. The name is case sensitive and must be an exact match.`;

				// Forces playback of specified track
				instance.jukebox.select = jumpIndex;
				instance.jukebox.page = Math.floor(jumpIndex / 10);
	
				instance.player.removeAllListeners(AudioPlayerStatus.Idle);
				instance.player.stop();
				let jSlct = instance.jukebox.album[instance.jukebox.select];
				if (jSlct) {
					instance.player.stop();
					await instance.updateJukebox();
					instance.player.play(makeAudioStream(jSlct.track_url));
					instance.player.on(AudioPlayerStatus.Idle, async function() {
						instance.jukebox.select = (instance.jukebox.select + 1) % instance.jukebox.album.length;
						jSlct = instance.jukebox.album[instance.jukebox.select];
						await instance.updateJukebox();
						instance.player.play(makeAudioStream(jSlct.track_url));
					});
				}
				return(`Now playing: [${specifiedTrack}].`);
			case 'mahjong':
				// Forces playback in Mahjong mode, where it only accepts user mentions
				if (!mention) return "You did not provide a user mention whose riichi playlist will be played.";

				let rList = mention.id === clientId ? await sqlitehandler.secretList() : await sqlitehandler.retrieveList(serverId, 'r', mention.id);
				
				// Easter egg case: clientId is forced
				if (mention.id === clientId) {
					let secretNum = Math.floor(Math.random() * rList.length)
					const secretSelect = rList[secretNum];
					instance.updateEmbedTrack(jargon(12, 13), jargon(6, 6), jargon(25, 15));
					instance.embed.thumbnail.url = secretSelect.track_image;
					instance.embed.description = "ᕕ(⌐■_■)ᕗ ♪♬";
					instance.embed.image.url = secretSelect.track_banner;
					instance.renderEmbed({ embeds: [instance.embed ]});

					instance.player.stop();
					instance.player.play(makeAudioStream(secretSelect.track_url));
					instance.player.removeAllListeners(AudioPlayerStatus.Idle);
					instance.player.on(AudioPlayerStatus.Idle, function() {
						instance.player.play(makeAudioStream(secretSelect.track_url));
					});

					return(`\`ERROR (-${secretNum + 1}) : ${jargon(5, 0)}-${secretSelect.track_name}-${jargon(5, 0)}\``);
				}

				if (rList.length <= 0) return "This user does not have a riichi playlist, and the server has default tracks disabled. " +
					"Either enable default tracks, or request the user to add tracks to their personal playlist to use this command for them."
				const rSlct = rList[Math.floor(Math.random() * rList.length)];
		
				const customImage = await sqlitehandler.checkProfile(serverId, mention.id);
				if (customImage) instance.embed.thumbnail.url = customImage.custom_image;
				else instance.embed.thumbnail.url = Math.random() < 0.5 ? imageUrl[6] : imageUrl[7];
				instance.embed.description = `In ${instance.term.r}!`;
				instance.embed.image.url = extender;
				instance.updateEmbedTrack(rSlct.track_name, await getUserById(rSlct.user_id, instance.server), await getUserById(mention.id, instance.server));
				instance.renderEmbed({ embeds: [instance.embed] });
		
				instance.player.stop();
				instance.player.play(makeAudioStream(rSlct.track_url));
				instance.player.removeAllListeners(AudioPlayerStatus.Idle);
				instance.player.on(AudioPlayerStatus.Idle, function() {
					instance.player.play(makeAudioStream(rSlct.track_url));
				});
		
				return "Successfully manually forced user's riichi playlist!";
			default:
				return "This command only works when IchiBot is in a voice channel on the server.";
		}
	}
}