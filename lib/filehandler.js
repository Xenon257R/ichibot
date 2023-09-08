const fs = require('fs');
const https = require('https');
const sqlitehandler = require('./sqlitehandler.js');

const limit = 20;

function downloadFile(id, type, file) {
	const f = fs.createWriteStream(`./music/${type}/${id}/${file.name}`);
	return new Promise((resolve) => {
		https.get(file.url, function(response) {
			response.pipe(f);
			f.on('finish', function() {
				f.close();
				resolve(`Accepted - ${file.name}\n`);
			}).on('error', function() {
				fs.unlink(f);
				resolve(`Failed   - ${file.name}\n`);
			});
		});
	});
}

module.exports = {
	download: async function(id, type, files) {
		let status = '';
		for (const file of files.values()) {
			console.log(file.name);
			if (!file.name.endsWith('.mp3')) {
				status = status.concat('Rejected - ', file.name, '\n');
				continue;
			}
			else if (fs.readdirSync(`./music/${type === 'h' ? 'hanchan' : 'riichi'}/${id}/`).filter(file => file.endsWith('.mp3')).length >= limit) {
				status = status.concat('Exceeded - ', file.name, '\n');
				continue;
			}

			status = status.concat(await downloadFile(id, type === 'h' ? 'hanchan' : 'riichi', file));
			sqlitehandler.catalogMedia(file.name.substring(0, file.name.lastIndexOf(".")), id, type === 'h' ? 0 : 1);
		}

		return `\`\`\`${status}\`\`\``;
	}
}