const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('riichi')
		.setDescription('Standbys for Riichi music.'),
	async execute(interaction) {
		await interaction.reply('Riichi!');
	},
};
