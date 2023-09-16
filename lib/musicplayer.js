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
const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits, ActionRow } = require('discord.js');
const { imageUrl } = require('../emotes.json');
const sqlitehandler = require('./sqlitehandler');

const activePlayers = {};

class serverPlayer {
	constructor(aPlayer, vChannel, embed, connection, collector, buttons) {
		this.player = aPlayer;
		this.channel = vChannel;
		this.embed = embed;
		this.connection = connection;
		this.collector = collector;
		this.buttons = buttons;
	}
}

function generateButtonRows() {
	const actionRows = {};
	actionRows.mahjong = [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('hanchan').setLabel('Hanchan').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('riichi').setLabel('Riichi').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('standby').setLabel('Standby').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('dismiss').setLabel('Dismiss').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('jukebox').setLabel('Jukebox').setStyle(ButtonStyle.Success)
		)
	];
	actionRows.jukebox = [
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
			new ButtonBuilder().setCustomId('stop').setLabel('⏹').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('game').setLabel('🀄').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('exit').setLabel('✖').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('next').setLabel('>>').setStyle(ButtonStyle.Secondary)
		)
	];

	return actionRows;
}

function getUserById(id, server) {
	if (id === 0 || id === '0') return 'IchiBot';
	const member = server.members.cache.get(id);
	if (!member || (member.user && !member.user.username)) return 'Unregistered user';
	if (!member.nickname) return member.user.username;
	return member.nickname;
}

function updateEmbedTrack(embed, trackName, curator, riichi = 0, player = 'N/A') {
	if (trackName.length > 32) trackName = trackName.substring(0, 31).trim() + '…';
	embed.fields[0].value = `\`${trackName.replace(new RegExp('_', 'g'), ' ')}\``;
	embed.fields[1].value = curator;
	embed.fields[2].value = riichi;
	if (player) embed.fields[3].value = player;

	return embed;
}

function initEmbed() {
	return {
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
	}
}

function resetEmbed(embed, timeFlag = true) {
	embed.thumbnail.url = imageUrl[10];
	embed.title = 'Status:';
	embed.description = 'On standby.';
	embed.fields = [
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
	if (timeFlag) embed.timestamp = new Date().toISOString();
	embed.footer.text = 'Session started:'
}

function closeEmbed(embed) {
	embed.thumbnail.url = imageUrl[Math.floor(Math.random()*18)];
	embed.description = 'Completed session.'
	embed.fields = [];
	embed.timestamp = new Date().toISOString();
	embed.footer.text = 'Session ended:'
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

function generateJukeboxPage(album, page, track = -1) {
	let tenTracks = '';
	let pageHeader = `md\nPage ${page + 1} of ${Math.ceil(album.length / 10)}\n--------------------------------------\n`;
	for (let i = 0; i < 10; i++) {
		let j = i + (page * 10);
		tenTracks = tenTracks + `[${i < 9 ? '0' : ''}${i + 1}]`;
		if (album[j]) {
			let trackName = album[j].track_name;
			if (trackName.length > 30) trackName = trackName.substring(0, 31).trim() + '…';
			else {
				trackName = trackName + ' ';
				while (trackName.length < 30) trackName = trackName + (track === j ? '-' : ' ');
			}
			tenTracks = tenTracks + (track === j ? `[ ${trackName} ]` : `( ${trackName} )`);
		}
		else tenTracks = tenTracks + ` # --- `
		if (i != 9) tenTracks = tenTracks + '\n';
	}

	return `\`\`\`${pageHeader}${tenTracks}\`\`\``;
}

function editJukeboxButtons(buttons, fullAlbum, page) {
	for (let i = 0; i < 5; i++) {
		if (i + (page * 10) < fullAlbum.length) buttons[0].components[i].setDisabled(false);
		else buttons[0].components[i].setDisabled(true);
		if (i + 5 + (page * 10) < fullAlbum.length) buttons[1].components[i].setDisabled(false);
		else buttons[1].components[i].setDisabled(true);
	}
	if (page <= 0) buttons[2].components[0].setDisabled(true);
	else buttons[2].components[0].setDisabled(false);
	if (page >= (Math.ceil(fullAlbum.length / 10) - 1)) buttons[2].components[4].setDisabled(true);
	else buttons[2].components[4].setDisabled(false);
}

function changeToJukebox(embed, fullAlbum) {
	embed.thumbnail.url = imageUrl[11];
	embed.description = 'In Jukebox mode.';
	embed.fields = [
		{
			name: 'Currently Playing:',
			value: `\`[Nothing]\``,
			inline: true
		},
		{
			name: 'Curator:',
			value: 'N/A',
			inline: true
		},
		{
			name: 'Tracks:',
			value: generateJukeboxPage(fullAlbum, 0)
		}
	];
}

function updateJukebox(masterPlayer, embed, buttons, jukebox, server) {
	embed.fields = [
		{
			name: 'Currently Playing:',
			value: `\`${jukebox.album[jukebox.select] ? jukebox.album[jukebox.select].track_name : '[Nothing]'}\``,
			inline: true
		},
		{
			name: 'Curator:',
			value: `${jukebox.album[jukebox.select] ? getUserById(jukebox.album[jukebox.select].user_id, server) : 'N/A'}`,
			inline: true
		},
		{
			name: 'Tracks:',
			value: generateJukeboxPage(jukebox.album, jukebox.page, jukebox.select)
		}
	];
	editJukeboxButtons(buttons, jukebox.album, jukebox.page);
	masterPlayer.edit({ embeds: [embed], components: buttons });
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
    createVoice : async function(server, channel_id, player_channel) {
		if (!player_channel) return 'missing';
		const server_id = server.id;
		if (activePlayers[server_id]) {
			console.log("Connection already exists on server.");
			return 'occupied';
		}
		const aPlayer = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Pause,
			},
		});
		const connection = await connectToChannel(channel_id);
		connection.subscribe(aPlayer);

		const collector = player_channel.createMessageComponentCollector();

		const playerEmbed = initEmbed();
		const buttons = generateButtonRows();
		resetEmbed(playerEmbed);
		const masterPlayer = await player_channel.send({ embeds: [playerEmbed], components: buttons.mahjong });

		let jukebox = { album: undefined, page: 0, select: -1 };

		collector.on('collect', async i => {
			if (server.members.cache.get(i.user.id).voice.channel.id != channel_id) {
				i.reply({ content: "You cannot interact with IchiBot because you're not in the same voice channel.", ephemeral: true });
				return;
			}
			let hList = shuffle(await sqlitehandler.retrieveList(server_id, 0));
			let hSlct = 0;
	
			switch (i.customId) {
				case 'hanchan':
					if (hList.length <= 0) {
						i.reply({ content: "There are no tracks listed in the hanchan playlist in this server. Add some to use this playlist, or enable default in the bot settings.", ephemeral: true });
						return;
					}
					aPlayer.play(createAudioResource(hList[hSlct].track_url));
					aPlayer.removeAllListeners('idle');
					aPlayer.on('idle', function () {
						hSlct = (hSlct + 1) % hList.length;
						if (hSlct === 0) hList = shuffle(hList);
						aPlayer.play(createAudioResource(hList[hSlct].track_url));

						updateEmbedTrack(playerEmbed, hList[hSlct].track_name, getUserById(hList[hSlct].user_id, server));
						masterPlayer.edit({ embeds: [playerEmbed] });
					});

					if (playerEmbed.thumbnail.url != imageUrl[3]) {
						playerEmbed.thumbnail.url = imageUrl[3];
						playerEmbed.description = 'Playing Mahjong.';
					}
					updateEmbedTrack(playerEmbed, hList[hSlct].track_name, getUserById(hList[hSlct].user_id, server));
					masterPlayer.edit({ embeds: [playerEmbed] });
					break;
				case 'riichi':
					let rList = await sqlitehandler.retrieveList(server_id, 1, i.user.id);
					if (rList.length <= 0) {
						i.reply({ content: "There are no tracks listed in your riichi playlist in this server. Add some to your playlist, or enable default in the bot settings.", ephemeral: true });
						return;
					}
					const rSlct = rList[Math.floor(Math.random() * rList.length)];

					aPlayer.play(createAudioResource(rSlct.track_url));
					aPlayer.removeAllListeners('idle');
					aPlayer.on('idle', function () {
						aPlayer.play(createAudioResource(rSlct.track_url));
					});

					const customImage = await sqlitehandler.checkProfile(server_id, i.user.id);
					if (customImage) playerEmbed.thumbnail.url = customImage.custom_image;
					else playerEmbed.thumbnail.url = imageUrl[6];
					playerEmbed.description = 'In Riichi!';
					updateEmbedTrack(playerEmbed, rSlct.track_name, getUserById(rSlct.user_id, server), 1, getUserById(i.user.id, server));
					masterPlayer.edit({ embeds: [playerEmbed] });
					break;
				case 'standby':
				case 'game':
					console.log("On standby.");
					aPlayer.removeAllListeners('idle');
					aPlayer.stop();
					resetEmbed(playerEmbed, false);
					masterPlayer.edit({ embeds: [playerEmbed], components: buttons.mahjong });
					break;
				case 'dismiss':
				case 'exit':
					await this.disconnectVoice(server_id);
					closeEmbed(playerEmbed);
					jukebox.album = undefined;
					jukebox.page = 0;
					masterPlayer.edit({ embeds: [playerEmbed], components: [] });
					console.log(`Disconnected from voice chat in server [${server_id}].`);
					break;
				case 'jukebox':
					console.log('Switching to JUKEBOX mode.');
					aPlayer.removeAllListeners('idle');
					aPlayer.stop();
					jukebox.album = shuffle(await sqlitehandler.retrieveList(server_id));
					jukebox.page = 0;
					jukebox.select = -1;
					changeToJukebox(playerEmbed, jukebox.album);
					updateJukebox(masterPlayer, playerEmbed, buttons.jukebox, jukebox, server);
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
					aPlayer.removeAllListeners('idle');
					aPlayer.stop();
					jukebox.select = ((parseInt(i.customId) - 1) + (jukebox.page * 10));
					let jSlct = jukebox.album[jukebox.select];
					if (jSlct) {
						aPlayer.play(createAudioResource(jSlct.track_url));
						updateJukebox(masterPlayer, playerEmbed, buttons.jukebox, jukebox, server);
						aPlayer.on('idle', function () {
							jukebox.select = (jukebox.select + 1) % jukebox.album.length;
							jSlct = jukebox.album[jukebox.select];
							aPlayer.play(createAudioResource(jSlct.track_url));
							updateJukebox(masterPlayer, playerEmbed, buttons.jukebox, jukebox, server);
						});
					}
					break;
				case 'prev':
				case 'next':
					jukebox.page = jukebox.page + (i.customId === 'prev' ? -1 : 1);
					updateJukebox(masterPlayer, playerEmbed, buttons.jukebox, jukebox, server);
					break;
				case 'stop':
					aPlayer.removeAllListeners('idle');
					aPlayer.stop();
					jukebox.select = -1;
					updateJukebox(masterPlayer, playerEmbed, buttons.jukebox, jukebox, server);
					break;
				default:
					console.log("Invalid input.");
			}

			// delays user input (?)
			i.deferUpdate();
		});

		activePlayers[server_id] = new serverPlayer(aPlayer, channel_id, playerEmbed, connection, collector, buttons);

		return true;
    },
    disconnectVoice : async function(server_id) {
        const sPlayer = activePlayers[server_id]
        if (!sPlayer) return;

        sPlayer.player.removeAllListeners('idle');
        sPlayer.player.stop();
		sPlayer.collector.stop();
		sPlayer.connection.destroy();
        delete activePlayers[server_id];

		return true;
    }
}