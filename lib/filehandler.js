const fs = require('fs');
const https = require('https');

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
		let completed = 0;
		for (const file of files.values()) {
			console.log(file.name);
			if (!file.name.endsWith('.mp3')) {
				status = status.concat('Rejected - ', file.name, '\n');
				return;
			}

			status = status.concat(await downloadFile(id, type === 'h' ? 'hanchan' : 'riichi', file));
		}

		return `\`\`\`${status}\`\`\``;
	}
}