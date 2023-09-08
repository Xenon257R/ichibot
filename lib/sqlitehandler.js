const sqlite3 = require('sqlite3').verbose();

// Create universal database
const db = new sqlite3.Database('./database.db', (err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log('Connected to SQLite database.');
});

const sqlquery = `SELECT name FROM album WHERE type = 1`;

db.all(sqlquery, [], (err, rows) => {
	if (err) {
		throw err;
	}
	// rows.forEach((row) => {
	// 	console.log(row.name);
	// });
});

db.close((err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log('Closed the connection.');
});

function catalogMedia(track, curator, type) {
    db.run(`INSERT INTO album (name, curator, type) VALUES (?, ?, ?)`, [track, curator, type], (err) => {
        if (err) {
            return console.log(err.message);
        }
        console.log(`New media indexed.`);
    });
}

function addTrack(user, server, track) {
    db.run(`INSERT INTO playlist (user_id, server_id, track_id) VALUES (?, ?, ?)`, [user, server, track], (err) => {
        if (err) {
            return console.log(err.message);
        }
    });
    db.get(`SELECT name FROM album WHERE track_id = ?`, [track], (err, row) => {
        if (err) {
            throw err;
        }
        return row.name;
    });
}

function removeTrack(user, server, track) {
    db.run(`DELETE FROM playlist WHERE (user_id = ? AND server_id = ? and track_id = ?)`, [user, server, track], (err) => {
        if (err) {
            return console.log(err.message);
        }
    });
    console.log('Entry deleted.');
}

function retrieveList(user, server, type) {
    db.all(`SELECT name, track_id FROM album INNER JOIN playlist ON playlist.track_id = album.track_id WHERE (playlist.user_id = ? AND playlist.server_id = ? AND album.type = ?)`, [user, server, type], (err, rows) => {
        if (err) {
            return console.log(err.message);
        }
        rows.forEach((row) => {
        	console.log(row.name);
        });
    });
}