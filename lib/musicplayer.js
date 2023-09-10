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
const { ActionRowBuilder, ActivityType, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { imageUrl } = require('../emotes.json');
const sqlitehandler = require('./sqlitehandler');

// Create a playback action row for use
const buttonStyle = {
	hanchan : new ButtonBuilder()
		.setCustomId('hanchan')
		.setLabel('Hanchan')
		.setStyle(ButtonStyle.Primary),
	riichi : new ButtonBuilder()
		.setCustomId('riichi')
		.setLabel('Riichi')
		.setStyle(ButtonStyle.Success),
	standby : new ButtonBuilder()
		.setCustomId('standby')
		.setLabel('Standby')
		.setStyle(ButtonStyle.Secondary),
	dismiss : new ButtonBuilder()
		.setCustomId('dismiss')
		.setLabel('Dismiss')
		.setStyle(ButtonStyle.Danger),
	hPlaylist : new ButtonBuilder()
		.setCustomId('h')
		.setLabel('Hanchan Playlist')
		.setStyle(ButtonStyle.Primary),
	rPlaylist : new ButtonBuilder()
		.setCustomId('r')
		.setLabel('Riichi Playlist')
		.setStyle(ButtonStyle.Primary)
}

const mahjongRow = new ActionRowBuilder().addComponents(buttonStyle.hanchan, buttonStyle.riichi, buttonStyle.standby, buttonStyle.dismiss);

const activePlayers = {};

class serverPlayer {
	constructor(aPlayer, vChannel, embed, connection, collector) {
		this.player = aPlayer;
		this.channel = vChannel;
		this.embed = embed;
		this.connection = connection;
		this.collector = collector;
	}
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
	embed.description = 'On standby.'
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
		const server_id = server.id;
        if (!activePlayers[server_id]) {
            const aPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });
			const connection = await connectToChannel(channel_id);
			connection.subscribe(aPlayer);

			const collector = player_channel.createMessageComponentCollector();

			const playerEmbed = initEmbed();
			resetEmbed(playerEmbed);
			masterPlayer = await player_channel.send({ embeds: [playerEmbed], components: [mahjongRow] });

			collector.on('collect', async i => {
				if (server.members.cache.get(i.user.id).voice.channel.id != channel_id) {
					i.reply({ content: "You cannot interact with IchiBot because you're not in the same voice channel.", ephemeral: true });
					return;
				}
				let hList = shuffle(await sqlitehandler.retrieveList(server, 0, i.user.id));
				let hSlct = 0;
		
				switch (i.customId) {
					case 'hanchan':
						aPlayer.play(createAudioResource(`./music/hanchan/${hList[hSlct].curator}/${hList[hSlct].name}.mp3`));
						aPlayer.removeAllListeners('idle');
						aPlayer.on('idle', function () {
							hSlct = (hSlct + 1) % hList.length;
							if (hSlct === 0) hList = shuffle(hList);
							aPlayer.play(createAudioResource(`./music/hanchan/${hList[hSlct].curator}/${hList[hSlct].name}.mp3`));
						});

						if (playerEmbed.thumbnail.url != imageUrl[3]) {
							playerEmbed.thumbnail.url = imageUrl[3];
							playerEmbed.description = 'Playing Mahjong.';
							masterPlayer.edit({ embeds: [playerEmbed] });
						}
						else {
							masterPlayer.edit({ embeds: [playerEmbed] });
						}
						break;
					case 'riichi':
						let rList = await sqlitehandler.retrieveList(server, 1, i.user.id);
						const rSlct = rList[Math.floor(Math.random() * rList.length)];

						aPlayer.play(createAudioResource(`./music/riichi/${rSlct.curator}/${rSlct.name}.mp3`));
						aPlayer.removeAllListeners('idle');
						aPlayer.on('idle', function () {
							aPlayer.play(createAudioResource(`./music/riichi/${rSlct.curator}/${rSlct.name}.mp3`));
						});

						const customImage = await sqlitehandler.checkProfile(server, i.user.id);
						if (customImage) {
							playerEmbed.thumbnail.url = customImage.custom_image;
							masterPlayer.edit({ embeds: [playerEmbed] });
							return;
						}
						playerEmbed.thumbnail.url = imageUrl[6];
						masterPlayer.edit({ embeds: [playerEmbed] });
						break;
					case 'standby':
						console.log("On standby.");
						aPlayer.removeAllListeners('idle');
						aPlayer.stop();
						resetEmbed(playerEmbed, false);
						masterPlayer.edit({ embeds: [playerEmbed] });
						break;
					case 'dismiss':
						await this.disconnectVoice(server_id);
						closeEmbed(playerEmbed);
						masterPlayer.edit({ embeds: [playerEmbed], components: [] });
						console.log(`Disconnected from voice chat in server [${server_id}].`);
						break;
					default:
						console.log("Invalid input.");
				}

				// delays user input (?)
				i.deferUpdate();
			});

            activePlayers[server_id] = new serverPlayer(aPlayer, channel_id, playerEmbed, connection, collector);
        }
    },
    disconnectVoice : async function(server_id) {
        const sPlayer = activePlayers[server_id]
        if (!sPlayer) return;

        sPlayer.player.removeAllListeners('idle');
        sPlayer.player.stop();
		sPlayer.collector.stop();
		sPlayer.connection.destroy();
        delete activePlayers[server_id];
    }
}