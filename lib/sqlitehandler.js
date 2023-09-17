const sqlite3 = require('sqlite3').verbose();

// Create universal database
const db = new sqlite3.Database('./database.db', (err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log('Connected to SQLite database.');
});

const notice = `You may need to dismiss and re-mention IchiBot for changes to take effect.`;

// Enable constraints for foreign keys
db.get("PRAGMA foreign_keys = ON");

// Handles known common URL types to link to the raw URL under the hood
function knownSchemas(url) {
    console.log(`Checking schemas with ${url}...`);
    const gdrive = url.match(/^https:\/\/drive.google.com\/file\/d\/(.*)\/.*$/);
    const dbox = url.match(/^(https:\/\/www.dropbox.com\/scl\/fi\/.*)&dl=0$/);

    // CITATION : https://webapps.stackexchange.com/questions/65763/how-can-i-hotlink-an-mp3-in-google-drive-with-a-url-ending-in-mp3
    if (gdrive) return `http://docs.google.com/uc?export=open&id=${gdrive[1]}`;

    // CITATION : https://www.dropboxforum.com/t5/Create-upload-and-share/mp3-URL-ending-with-mp3/td-p/57214
    // NOTE : Instead of [?raw=1], [&raw=1] is used as the original URL uses the latter.
    if (dbox) return `${dbox[1]}&raw=1`;

    return url;
}

module.exports = {
    addServer : async function(serverId) {
        // Adds server to database. Used for initialization
        // NOTE: Calling this function will override existing configuration done on this server, if any

        return new Promise((resolve, reject) => {
            db.run(`REPLACE INTO server (server_id) VALUES (?)`, [serverId], (err) => {
                if (err) reject(`There was an issue initializing this server. (${err.message})`);
                resolve("Initialized server with basic settings.");
            });
        });
    },
    getServerDetails : async function(serverId) {
        // Returns server configurations
        return new Promise((resolve, reject) => {
            db.get(`SELECT server_id, command_channel, player_channel, enable_default FROM server WHERE (server_id = ?)`, [serverId], (err, row) => {
                if (err) reject(err);
                resolve(row ? row : {});
            });
        });
    },
    modifyServer : async function(serverId, param, value) {
        // Modifies server configuration at specific column
        // NOTE: Can only modify one data at a time

        return new Promise((resolve, reject) => {
            db.run(`UPDATE server SET ${param} = ${value} WHERE (server_id = ?)`, [serverId], (err) => {
                if (err) reject ('There was an unhandled issue from your command.');
                resolve(`Updated server info successfully. ${notice}`);
            });
        });
    },
    isMahjong : async function(serverId) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT mahjong FROM server WHERE (server_id = ?)`, [serverId], (err, row) => {
                if (err) reject(false);
                resolve(row ? (row.mahjong === 1) : false);
            });
        });
    },
    addTrack : async function(serverId, userId, name, url, type) {
        // Adds track [name] in [serverId] in database

        // Checks if used [name] is a reserved name, and whether it may be too long
        const reserved = await new Promise((resolve) => {
            db.get(`SELECT track_id FROM default_album WHERE (track_name = ?)`, [name], (err, row) => {
                if (err) {
                    resolve(false);
                }
                resolve(row);
            });
        });
        if (reserved) return(`Track name \`${name}\` is reserved for the default playlist. You cannot use it, even if default tracks are disabled for this server.`);
        if (name.length > 30) return (`Track name \`${name}\` is far too long. Please shorten it to be less than or equal to 30 characters.`);

        // Attempts to add track into database - rejected if track name is found to already exist
        return new Promise((resolve, reject) => {
            url = knownSchemas(url);
            db.run(`INSERT INTO playlist (server_id, user_id, track_name, track_url, type) VALUES (?, ?, ?, ?, ?)`, [serverId, userId, name, url, type], (err) => {
                if (err) {
                    switch(err.errno) {
                        case 19:
                            resolve(`The provided track name \`${name}\` is already being used in this server.`);
                        default:
                            reject(`Unhandled database error.`);
                    }
                }

                resolve(`\`${name}\` successfully added to the server. ${notice}`);
            });
        });
    },
    removeTrack : async function(serverId, userId, track) {
        // Removes track [name] from database from [serverId]
        // Will fail if [name] is not found, or is found but not uploaded by [userId]

        return new Promise((resolve, reject) => {
            db.get(`SELECT track_name, user_id FROM playlist WHERE (server_id = ? and track_name = ?)`, [serverId, track], (err, row) => {
                if (err || !row) reject(`\`${track}\` does not exist in this server, or is an immutable default track.`);
                if (row && (!row.user_id || row.user_id != userId)) reject(`You are not the curator of \`${track}\`, therefore you cannot delete it.`);
                resolve();
            });
        }).then(() => {
            console.log('Deleting from playlist');
            return new Promise ((resolve, reject) => {
                db.run(`DELETE FROM playlist WHERE (server_id = ? AND user_id = ? and track_name = ?)`, [ serverId, userId, track], (err) => {
                    if (err) reject(err);
        
                    resolve(`\`${track}\` has been successfully deleted. ${notice}`);
                });
            });
        }).catch((error) => {
            return error;
        });
    },
    retrieveList : async function(serverId, type, userId) {
        // Retrieves playlist filtered by parameters

        // Converts type to num value
        let numType = -1;
        switch (type) {
            case 'h':
                numType = 0;
                break;
            case 'r':
                numType = 1;
                break;
            default:
                break;
        }

        // Checks if server has default playlists enabled
        let defaultList = '';
        const defaultEnabled = await new Promise((resolve, reject) => {
            db.get(`SELECT enable_default FROM server WHERE (server_id = ?)`, [serverId], (err, row) => {
                if (err) reject(false);
                resolve(row.enable_default === 1);
            });
        });
        if (defaultEnabled && type != 'r') {
            let param = type ? ` WHERE (type = ${numType})` : '';
            defaultList = ` UNION SELECT track_name, track_url, user_id, type FROM default_album${param}`;
        }

        // Filters database by parameters, then return results
        return new Promise((resolve, reject) => {
            if (!userId) {
                let t = '';
                if (numType != -1) t = ` AND type = ${numType}`;
                db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (server_id = ?${t})${defaultList}`, [serverId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }
            db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (user_id = ? AND server_id = ? AND type = ?)${defaultList}`, [userId, serverId, numType], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        }).then((rows) => {
            if (rows.length <= 0 && defaultEnabled && numType != 0) {
                return new Promise((resolve, reject) => {
                    if (numType === -1) {
                        db.all(`SELECT track_name, track_url, user_id, type FROM default_album`, [], (err, rows) => {
                            if (err) reject([]);
                            resolve(rows);
                        });
                    }
                    else {
                        db.all(`SELECT track_name, track_url, user_id, type FROM default_album WHERE (type = ?)`, [numType], (err, rows) => {
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
    listUploads : async function(serverId, userId) {
        // Return list of tracks [userId] has uploaded to the server

        return new Promise((resolve, reject) => {
            db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, rows) => {
                if (err) reject([]);
                resolve(rows);
            });
        });
    },
    checkProfile : async function(serverId, userId) {
        // Checks if [userId] has a profile on [serverId]

        return new Promise((resolve, reject) => {
            db.get(`SELECT custom_image FROM user WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, row) => {
                if (err) reject(false);
                resolve(row);
            });
        });
    },
    assignProfile: async function(serverId, userId, image) {
        // Assigns [image] to [userId] in [serverId]

        return new Promise ((resolve, reject) => {
            db.run(`REPLACE INTO user (server_id, user_id, custom_image) VALUES (?, ?, ?)`, [serverId, userId, image], (err) => {
                if (err) reject(`There was an error assigning your image to your profile in this server.`);
                resolve('Your profile has been successfully updated.');
            });
        });
    },
    dismountProfile: async function(serverId, userId) {
        // Removes [userId] profile from [serverId]

        return new Promise ((resolve, reject) => {
            db.run(`DELETE FROM user WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err) => {
                if (err) reject (err.message);
                resolve('Your profile has been removed from the server (or did not exist in the first place).');
            });
        });
    }
}