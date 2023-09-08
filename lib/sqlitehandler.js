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

module.exports = {
    addServer : function(server) {
        db.run(`INSERT INTO server (server_id) VALUES (?)`, [server], (err) => {
            if (err) {
                return console.log(err.message);
            }
            console.log(`Added new server ${server}.`);
        });
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
    }
}