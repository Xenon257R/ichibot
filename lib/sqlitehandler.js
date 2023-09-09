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

function generateList(server, type, user) {
    return new Promise((resolve, reject) => {
        if (user == undefined) {
            db.all(`SELECT name, album.track_id, curator FROM album INNER JOIN playlist ON playlist.track_id = album.track_id WHERE (playlist.server_id = ? AND album.type = ?)`, [server, type], (err, rows) => {
                if (err) {
                    reject(err);
                }
                resolve(rows);
            });
        }
        db.all(`SELECT name, album.track_id, curator FROM album INNER JOIN playlist ON playlist.track_id = album.track_id WHERE (playlist.user_id = ? AND playlist.server_id = ? AND album.type = ?)`, [user, server, type], (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
}

function listItem(track, curator, type) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO album (name, curator, type) VALUES (?, ?, ?)`, [track, curator, type], (err) => {
            if (err) {
                reject(err);
            }
            resolve(console.log(`New media indexed.`));
        });
    });
}

function checkUserImage(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT custom_image FROM user WHERE user_id = (?)`, [id], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    })
}
function checkServer(server) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT command_channel, upload_channel, player_channel FROM server WHERE server_id = (?)`, [server], (err, row) => {
            if (err) reject(err);
            resolve(row);
        })
    })
}

module.exports = {
    serverComplete : async function(server) {
        const data = await checkServer(server);
        if (!data) return false;
        if (!data.command_channel || !data.upload_channel || !data.player_channel) return false;
        return true;
    },
    addServer : function(server, c, u, p) {
        db.run(`REPLACE INTO server (server_id, command_channel, upload_channel, player_channel) VALUES (?, ?, ?, ?)`, [server, c, u, p], (err) => {
            if (err) {
                return console.log(err.message);
            }
            console.log(`Updated server info ${server}.`);
        });
    },
    getServerDetails : async function(server) {
        const data = await checkServer(server);
        if (!data) return { command_channel: undefined, upload_channel: undefined, player_channel: undefined };
        return data;
    },
    addUser : function(user) {
        db.run(`INSERT INTO user (user_id) VALUES (?)`, [user], (err) => {
            if (err) {
                return console.log(err.message);
            }
            console.log(`Added new user ${user}.`);
        });
    },
    catalogMedia : async function(track, curator, type) {
        try {
            return await listItem(track, curator, type);
        } catch (err) {
            console.log(`Entry rejected: ${err}`);
        }
    },
    addTrack : function(user, server, track) {
        db.run(`INSERT INTO playlist (user_id, server_id, track_id) VALUES (?, ?, ?)`, [user, server, track], (err) => {
            if (err) {
                return console.log(err.message);
            }
        });
    },
    removeTrack : function(user, server, track) {
        db.run(`DELETE FROM playlist WHERE (user_id = ? AND server_id = ? and track_id = ?)`, [user, server, track], (err) => {
            if (err) {
                return console.log(err.message);
            }
        });
        console.log('Entry deleted.');
    },
    retrieveList : async function(server, type, user) {
        return await generateList(server, type, user);
    },
    checkProfile : async function(user) {
        return await checkUserImage(user);
    },
    assignProfile: function (server, user, image) {
        db.run(`REPLACE INTO user (server_id, user_id, custom_image) VALUES (?, ?, ?)`, [server, user, image], (err) => {
            if (err) {
                return console.log(err.message);
            }
            console.log('Entry success!');
        });
    },
    dismountProfile: function (server, user) {
        db.run(`DELETE FROM user WHERE (user_id = ? AND server_id = ?)`, [user, server], (err) => {
            if (err) {
                return console.log(err.message);
            }
        });
        console.log('Profile deleted on server.');
    }
}