const sqlite3 = require('sqlite3').verbose();

// Create universal database
const db = new sqlite3.Database('./database.db', (err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log("Connected to SQLite database.");
});

const notice = "You may need to dismiss and re-mention IchiBot for changes to take effect.";

// Enable constraints for foreign keys
db.get("PRAGMA foreign_keys = ON");

// Handles known common URL types to link to the raw URL under the hood
function knownSchemas(url) {
    console.log(`Checking schemas similar to ${url}...`);
    const gdrive = url.match(/^https:\/\/drive.google.com\/file\/d\/(.*)\/.*$/);
    const gdrive2 = url.match(/^https:\/\/drive.google.com\/open\?id=(.*)&usp=drive_copy$/);
    const dbox = url.match(/^(https:\/\/www.dropbox.com\/scl\/fi\/.*)&dl=0$/);

    // CITATION : https://webapps.stackexchange.com/questions/65763/how-can-i-hotlink-an-mp3-in-google-drive-with-a-url-ending-in-mp3
    if (gdrive) return `http://docs.google.com/uc?export=open&id=${gdrive[1]}`;
    if (gdrive2) return `http://docs.google.com/uc?export=open&id=${gdrive2[1]}`

    // CITATION : https://www.dropboxforum.com/t5/Create-upload-and-share/mp3-URL-ending-with-mp3/td-p/57214
    // NOTE : Instead of [?raw=1], [&raw=1] is used as the original URL uses the latter.
    if (dbox) return `${dbox[1]}&raw=1`;

    return url;
}

// Checks if provided url is of type: datatype
async function isValidUrl(urlToCheck, datatype) {
    console.log("Checking validity...");

    // Check if the string is a URL first
    // CITATION: https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
    try {
        url = new URL(urlToCheck);
    } catch (_) {
        return 'BADURL';  
    }

    // CITATION: https://stackoverflow.com/questions/66982918/check-to-see-if-url-exists-and-is-linked-to-audio-file
    try {
        const response = await fetch(urlToCheck, { method: 'HEAD', signal: AbortSignal.timeout(10000), cache: 'no-store' })
            .then(res => res.ok && res.headers.get('Content-Type').startsWith(datatype))
            .catch(false)
    
        console.log("Resolved URL.");
        return response;
    } catch (err) {
        console.log(`URL check error: ${err}`);
        return 'TIMEOUT';
    }
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
            db.get(`SELECT server_id, command_channel, player_channel, enable_default, jukebox_mode FROM server WHERE (server_id = ?)`, [serverId], (err, row) => {
                if (err) reject(err);
                resolve(row ? row : {});
            });
        });
    },
    getAllServerChannels : async function() {
        // Returns all servers' command channels

        return new Promise((resolve, reject) => {
            db.all(`SELECT server_id, command_channel FROM server`, (err, row) => {
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
                if (err) reject ("There was an unhandled issue from your command.");
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
    addTrack : async function(serverId, userId, name, url, type, skipValidation = false) {
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
        if (reserved) return 'RESERVED';
        if (name.search(/[\[\]\(\)"'{}]/) > -1) return 'BADNAME';
        if (name.length > 30) return 'LONG';

        url = knownSchemas(url);
        console.log("Amended url: " + url);

        let edgeCase = false;
        
        // Checks if provided url will work (preliminarily)
        if (!skipValidation) {
            switch(await isValidUrl(url, 'audio')) {
                case 'BADURL':
                    // return 'You did not provide a valid URL.';
                    return 'BADURL';
                case 'TIMEOUT':
                    // return `IchiBot did not receive a response from the URL in 10 seconds - the request timed out.`;
                    return 'TIMEOUT';
                case false:
                    if (url.match(/^(https:\/\/www.dropbox.com\/scl\/fi\/.*)&raw=1$/)) {
                        console.log("Dropbox url identified - exception made.");
                        edgeCase = true;
                        break;
                    }
                    return 'NOTAUDIO';
                default:
                    console.log("URL verified to be valid audio source.");
            }
        }

        // Attempts to add track into database - rejected if track name is found to already exist
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO playlist (server_id, user_id, track_name, track_url, type) VALUES (?, ?, ?, ?, ?)`, [serverId, userId, name, url, type], (err) => {
                if (err) {
                    switch(err.errno) {
                        case 19:
                            resolve('INUSE');
                        default:
                            reject('UNHANDLEDERR');
                    }
                }

                resolve(edgeCase ? 'DROPBOXSUCCESS' : 'SUCCESS');
            });
        });
    },
    removeTrack : async function(serverId, userId, track, admin) {
        // Removes track [name] from database from [serverId]
        // Will fail if [name] is not found, or is found but not uploaded by [userId]
        // If admin, permits deleting track of anyone

        // Temporary detail storage
        let trackCurator = '';
        let isOverride = false;

        return new Promise((resolve, reject) => {
            db.get(`SELECT track_name, user_id FROM playlist WHERE (server_id = ? and track_name = ?)`, [serverId, track], (err, row) => {
                if (!row || err) reject(`\`${track}\` does not exist in this server, or is an immutable default track.`);
                if (row && userId != admin && (!row.user_id || row.user_id != userId)) reject(`You are not the curator of \`${track}\`, therefore you cannot delete it.`);
                resolve(row);
            });
        }).then((row) => {
            trackCurator = row.user_id;
            isOverride = userId != row.user_id;
            console.log("Deleting from playlist");
            return new Promise ((resolve, reject) => {
                db.run(`DELETE FROM playlist WHERE (server_id = ? and track_name = ?)`, [serverId, track], (err) => {
                    if (err) reject(err);
        
                    resolve(`\`${track}\` has been successfully deleted. ${notice}${isOverride ? `\n**ALERT**: This was an override action done by the server owner <@${admin}>. The original uploader is <@${trackCurator}>.` : ''}`);
                });
            });
        }).catch((error) => {
            return error;
        });
    },
    retrieveList : async function(serverId, type, userId, tag = null) {
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
            case 't':
                numType = 2;
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

        // If tagged, has unique parsing
        if (numType === 2) {
            const taggedTracks = await new Promise ((resolve, reject) => {
                db.get(`SELECT tag_name, tracks FROM taglist WHERE (server_id = ? AND user_id = ? AND tag_name = ?)`, [serverId, userId, tag], (err, row) => {
                    if (!row || err) reject([]);
                    resolve(row);
                });
            });
            const unfilteredTracks = await new Promise ((resolve, reject) => {
                db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (user_id = ? AND server_id = ?) ORDER BY track_name`, [userId, serverId], (err, rows) => {
                    if (err) reject([]);
                    resolve(rows);
                });
            });
            const tagArray = JSON.parse(taggedTracks.tracks);
            const filteredTracks = [];
            for (let i = 0; i < unfilteredTracks.length; i++) {
                for (let j = 0; j < tagArray.length; j++) {
                    if (unfilteredTracks[i].track_name === tagArray[j]) filteredTracks.push(unfilteredTracks[i]);
                }
            }

            return filteredTracks;
        }

        // Filters database by parameters, then return results
        return new Promise((resolve, reject) => {
            if (!userId) {
                let t = '';
                if (numType != -1) t = ` AND type = ${numType}`;
                db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (server_id = ?${t})${defaultList} ORDER BY track_name`, [serverId], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            }
            db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (user_id = ? AND server_id = ? AND type = ?)${defaultList} ORDER BY track_name`, [userId, serverId, numType], (err, rows) => {
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
    secretList : async function() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT track_name, track_url, track_banner, track_image FROM secret_album`, [], (err, rows) => {
                if (err) reject([]);
                resolve(rows);
            });
        });
    },
    listUploads : async function(serverId, userId, verbose = false) {
        // Return list of tracks [userId] has uploaded to the server

        const tags = await new Promise((resolve, reject) => {
            db.all(`SELECT tag_name, tracks FROM taglist WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, tags) => {
                if (err) reject([]);
                resolve(tags);
            });
        });

        return new Promise((resolve, reject) => {
            db.all(`SELECT track_name, track_url, user_id, type FROM playlist WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, rows) => {
                if (err) reject([]);
                resolve(rows);
            });
        }).then((rows) => {
            if (!verbose) return rows;

            for (i = 0; i < tags.length; i++) {
                tags[i].tracks = JSON.parse(tags[i].tracks);
            }

            for (j = 0; j < rows.length; j++) {
                var tagString = "";

                for (k = 0; k < tags.length; k++) {
                    if (tags[k].tracks.includes(rows[j].track_name)) {
                        tagString = tagString + tags[k].tag_name + ", ";
                    }
                }
                if (tagString.length > 0) {
                    tagString = tagString.substring(0, tagString.length - 2);
                    tagString = ' (' + tagString + ')';
                }

                rows[j].tagList = tagString;
            }

            return rows;
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
    assignProfile : async function(serverId, userId, image) {
        // Assigns [image] to [userId] in [serverId]
        switch(await isValidUrl(image, 'image')) {
            case 'BADURL':
                return "You did not provide a valid image URL to set your profile.";
            case 'TIMEOUT':
                return "The image resource could not be retrieved in time.";
            default:
                let extension = image.split('.');
                if (!extension) return "You did not provide a valid image URL to set your profile.";
                switch (extension.pop()) {
                    case 'png':
                    case 'jpg':
                    case 'jpeg':
                    case 'gif':
                    case 'webp':
                        break;
                    default:
                        return "You did not provide a valid image type. The accepted types are `.png`, `.jpg`, `.jpeg`, `.gif` and `.webp`.";
                }
                console.log("URL verified to be valid audio source.");
        }

        return new Promise ((resolve, reject) => {
            db.run(`REPLACE INTO user (server_id, user_id, custom_image) VALUES (?, ?, ?)`, [serverId, userId, image], (err) => {
                if (err) reject("There was an error assigning your image to your profile in this server.");
                resolve("Your profile has been successfully updated.");
            });
        });
    },
    dismountProfile : async function(serverId, userId) {
        // Removes [userId] profile from [serverId]

        return new Promise ((resolve, reject) => {
            db.run(`DELETE FROM user WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err) => {
                if (err) reject (err.message);
                resolve("Your profile has been removed from the server (or did not exist in the first place).");
            });
        });
    },
    importData : async function(serverId, userId, importData) {
        // Imports data from [importData] into [serverId]

        let resultArray = [];
        for (let i = 0; i < importData.length; i++) {
            console.log(`Adding track:${importData[i].track_name}, ${importData[i].type}`);
            const result = await this.addTrack(serverId, userId, importData[i].track_name, importData[i].track_url, importData[i].type, true);
            resultArray.push({ code: result, name: importData[i].track_name, type: importData[i].type });
            console.log(`Finished ${importData[i].track_name}`);
        };

        return resultArray;
    },
    createTag : async function(serverId, userId, tagName, mode = 1) {
        // Return list of tags by [userId] to see if the maximum allotment of 5 will be exceeded
        let existingTags = await new Promise((resolve, reject) => {
            db.all(`SELECT tag_name, user_id FROM taglist WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, rows) => {
                if (err) reject([]);
                resolve(rows);
            });
        });
        if (existingTags.length >= 5) return 'MAXED';

        const qualifiedRegex = /([^a-zA-Z0-9])/g;
        if (qualifiedRegex.test(tagName) || tagName.length > 8) return 'INVALID';

        // Attempts to add tag into database - rejected if tag name is found to already exist
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO taglist (server_id, user_id, tag_name, mode) VALUES (?, ?, ?, ?)`, [serverId, userId, tagName, mode], (err) => {
                if (err) {
                    switch(err.errno) {
                        case 19:
                            resolve('INUSE');
                        default:
                            reject('UNHANDLEDERR');
                    }
                }

                resolve('SUCCESS');
            });
        });
    },
    deleteTag : async function(serverId, userId, tagName) {
        // Removes tag [tagName] from database from [serverId]
        // Will fail if [tagName] is not found created by the user in that server

        return new Promise((resolve, reject) => {
            db.get(`SELECT tag_name, user_id FROM taglist WHERE (server_id = ? AND user_id = ? AND tag_name = ?)`, [serverId, userId, tagName], (err, row) => {
                if (!row || err) reject('NOTFOUND');
                resolve(row);
            });
        }).then((row) => {
            return new Promise ((resolve, reject) => {
                db.run(`DELETE FROM taglist WHERE (server_id = ? AND user_id = ? AND tag_name = ?)`, [serverId, userId, tagName], (err) => {
                    if (err) reject('UNHANDLEDERR');
        
                    resolve('SUCCESS');
                });
            });
        }).catch((error) => {
            return error;
        });
    },
    fetchTagList : async function (serverId, userId) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT tag_name, tracks, mode FROM taglist WHERE (server_id = ? AND user_id = ?)`, [serverId, userId], (err, rows) => {
                if (!rows || err) reject([]);
                resolve(rows);
            });
        });
    },
    checkExists : async function(serverId, userId, trackName) {
        // Return if specified [trackName] exists

        return new Promise((resolve, reject) => {
            db.get(`SELECT track_name FROM playlist WHERE (server_id = ? AND user_id = ? AND track_name = ?)`, [serverId, userId, trackName], (err, track) => {
                if (!track || err || track === "") reject(false);
                resolve(track);
            });
        }).catch((error) => {
            return false;
        });
    },
    changeTagMode : async function(serverId, userId, tag, newModeMod) {
        const oldTag = await new Promise((resolve, reject) => {
            db.get(`SELECT tag_name, tracks, mode FROM taglist WHERE (server_id = ? AND user_id =? AND tag_name = ?)`, [serverId, userId, tag], (err, tagData) => {
                if (!tagData || err) reject(null);
                resolve(tagData);
            });
        }).catch((error) => {
            return null;
        });
        let newMode = (parseInt(oldTag.mode) + 1) % 2;
        if (newModeMod >= 0) newMode = newModeMod;
        console.log(newMode);

        return new Promise((resolve, reject) => {
            db.run(`UPDATE taglist SET mode = ${newMode} WHERE (server_id = ? AND user_id = ? AND tag_name = ?)`, [serverId, userId, tag], (err) => {
                if (err) {
                    reject(-1);
                };
                resolve(newMode);
            });
        });
    },
    checkTagMode : async function(serverId, userId, tag) {
        // Return the playback mode of the specfied tag

        return new Promise((resolve, reject) => {
            db.get(`SELECT mode FROM taglist WHERE (server_id = ? AND user_id = ? AND tag_name = ?)`, [serverId, userId, tag], (err, mode) => {
                if (!mode || err || mode === "") reject(0);
                resolve(mode);
            });
        }).catch((error) => {
            return 0;
        });
    },
    attachTags : async function(serverId, userId, trackName, tags) {
        const results = {};

        for (const tag of tags) {
            await new Promise((resolve, reject) => {
                db.get(`SELECT tag_name, server_id, user_id, tracks FROM taglist WHERE (tag_name = ? AND server_id = ? AND user_id = ?)`, [tag, serverId, userId], (err, row) => {
                    if (!row || err) {
                        resolve('FAILURE');
                        return;
                    }
                    else {
                        var trackList = JSON.parse(row.tracks);
        
                        for (j = 0; j < trackList.length; j++) {
                            if (trackName === trackList[j]) {
                                resolve('REPEAT');
                                return;
                            };
                        };
        
                        trackList.push(trackName);
        
                        db.run(`UPDATE taglist SET tracks = (?) WHERE (tag_name = ? AND server_id = ? AND user_id = ?)`, [JSON.stringify(trackList), tag, serverId, userId], (err) => {
                            if (err) {
                                reject('UNHANDLEDERR');
                                return;
                            };
                            resolve('SUCCESS');
                        });
                    }
                });
            }).then((state) => {
                results[tag] = state;
            }).catch(() => {
                results[tag] = 'UNHANDLEDERR';
            });
        }

        return results;
    },
    detachTags : async function(serverId, userId, trackName, tags) {
        const results = {};

        for (const tag of tags) {
            await new Promise((resolve, reject) => {
                db.get(`SELECT tag_name, server_id, user_id, tracks FROM taglist WHERE (tag_name = ? AND server_id = ? AND user_id = ?)`, [tag, serverId, userId], (err, row) => {
                    if (!row) {
                        resolve('NOTEXIST');
                        return;
                    }
                    else {
                        var trackList = JSON.parse(row.tracks);
                        console.log(trackList);
                        const index = trackList.indexOf(trackName);
                        if (index < 0) {
                            resolve('NOTTAGGED');
                            return;
                        }
                        trackList.splice(index, 1);
        
                        db.run(`UPDATE taglist SET tracks = (?) WHERE (tag_name = ? AND server_id = ? AND user_id = ?)`, [[JSON.stringify(trackList), tag, serverId, userId], tag, serverId, userId], (err) => {
                            if (err) {
                                reject('UNHANDLEDERR');
                                return;
                            };
                            resolve('SUCCESS');
                        });
                    }
                })
            }).then((state) => {
                results[tag] = state;
            }).catch(() => {
                results[tag] = 'UNHANDLEDERR';
            });
        }

        return results;
    }
}