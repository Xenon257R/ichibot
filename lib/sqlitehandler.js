const sqlite3 = require('sqlite3').verbose();

// Create universal database
const db = new sqlite3.Database('./database.db', (err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log('Connected to SQLite database.');
});

// Enable constraints for foreign keys
db.get("PRAGMA foreign_keys = ON");

function knownSchemas(url) {
    console.log(`Checking schemas with ${url}...`);
    const gdrive = url.match(/^https:\/\/drive.google.com\/file\/d\/(.*)\/.*$/);
    const dbox = url.match(/^(https:\/\/www.dropbox.com\/scl\/fi\/.*)&dl=0$/);

    // CITATION : https://webapps.stackexchange.com/questions/65763/how-can-i-hotlink-an-mp3-in-google-drive-with-a-url-ending-in-mp3
    if (gdrive) return `http://docs.google.com/uc?export=open&id=${gdrive[1]}`;

    // CITATION : https://www.dropboxforum.com/t5/Create-upload-and-share/mp3-URL-ending-with-mp3/td-p/57214
    // NOTE : Instead of [?], [&] is used as the original URL uses the latter.
    if (dbox) return `${dbox[1]}&raw=1`;

    return url;
}

module.exports = {
    addServer : async function(server) {
        return new Promise((resolve, reject) => {
            db.run(`REPLACE INTO server (server_id) VALUES (?)`, [server], (err) => {
                if (err) reject(`There was an issue initializing this server. (${err.message})`);
                resolve("Initialized server with basic settings.");
            })
        })
    },
    getServerDetails : async function(server) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT server_id, command_channel, player_channel, enable_default FROM server WHERE server_id = (?)`, [server], (err, row) => {
                if (err) reject(err);
                resolve(row ? row : {});
            });
        });
    },
    modifyServer : async function(server, param, value) {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE server SET ${param} = ${value} WHERE server_id = (?)`, [server], (err) => {
                if (err) reject ('There was an unhandled issue handling your request.');
                resolve(`Updated server info successfully.`);
            });
        });
    },
    addTrack : async function(user, server, name, url, type) {
        return new Promise((resolve, reject) => {
            url = knownSchemas(url);
            db.run(`INSERT INTO playlist (user_id, server_id, track_name, track_url, type) VALUES (?, ?, ?, ?, ?)`, [user, server, name, url, type], (err) => {
                if (err) {
                    switch(err.errno) {
                        case 19:
                            resolve(`The provided track name \`${name}\` is already being used in this server.`);
                        default:
                            reject(`Unhandled database error.`);
                    }
                }

                resolve(`${name} successfully added into ${type === 0 ? 'global hanchan' : 'personal riichi'} playlist.`);
            });
        });
    },
    removeTrack : async function(user, server, track) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT track_name, user_id FROM playlist WHERE (server_id = ? and track_name = ?)`, [server, track], (err, row) => {
                if (err || !row) reject(`\`${track}\` does not exist in this server.`);
                if (row && (!row.user_id || row.user_id != user)) reject(`You are not the curator of \`${track}\`, therefore you cannot delete it.`);
                resolve();
            });
        }).then(() => {
            console.log('Deleting from playlist');
            return new Promise ((resolve, reject) => {
                db.run(`DELETE FROM playlist WHERE (user_id = ? AND server_id = ? and track_name = ?)`, [user, server, track], (err) => {
                    if (err) reject(err);
        
                    resolve(`\`${track}\` has been successfully deleted.`);
                });
            });
        }).catch((error) => {
            return error;
        });
    },
    retrieveList : async function(server, type, user) {
        let defaultList = '';
        const defaultEnabled = await new Promise((resolve, reject) => {
            db.get(`SELECT enable_default FROM server WHERE (server_id = ?)`, [server], (err, row) => {
                if (err) reject(false);
                resolve(row.enable_default === 1);
            });
        });
        if (defaultEnabled) {
            let param = type ? ` WHERE (type = ${type})` : '';
            defaultList = ` UNION SELECT track_name, track_url, user_id, type FROM default_album${param}`;
        }
        return new Promise((resolve, reject) => {
            if (!user) {
                db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (server_id = ?)${defaultList}`, [server], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }
            db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (user_id = ? AND server_id = ? AND type = ?)${defaultList}`, [user, server, type], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        }).then((rows) => {
            if (rows.length <= 0 && defaultEnabled) {
                return new Promise((resolve, reject) => {
                    if (!type) {
                        db.all(`SELECT track_name, track_url, user_id, type FROM default_album`, [], (err, rows) => {
                            if (err) reject([]);
                            resolve(rows);
                        });
                    }
                    else {
                        db.all(`SELECT track_name, track_url, user_id, type FROM default_album WHERE (type = ?)`, [type], (err, rows) => {
                            if (err) reject([]);
                            resolve(rows);
                        });
                    }
                });
            }
            else return rows;
        }).catch((error) => {
            return error;
        });
    },
    checkProfile : async function(server, user) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT custom_image FROM user WHERE (server_id = ? AND user_id = ?)`, [server, user], (err, row) => {
                if (err) reject(false);
                resolve(row);
            });
        });
    },
    assignProfile: async function (server, user, image) {
        return new Promise ((resolve, reject) => {
            db.run(`REPLACE INTO user (server_id, user_id, custom_image) VALUES (?, ?, ?)`, [server, user, image], (err) => {
                if (err) reject(`There was an error assigning your image to your profile in this server.`);
                resolve('Your profile has been successfully updated.');
            });
        });
    },
    dismountProfile: async function (server, user) {
        return new Promise ((resolve, reject) => {
            db.run(`DELETE FROM user WHERE (user_id = ? AND server_id = ?)`, [user, server], (err) => {
                if (err) reject (err.message);
                resolve('Your profile has been removed from the server (or did not exist in the first place).');
            });
        });
    }
}