function genericHelp() {
    return "```md\n" +
        "@IchiBot        : Calls IchiBot to your voice channel.\n" +
        "-h|help (x)     : Shows help for various commands. Specify a command for further details (e.g. -help i).\n" +
        "-i|init         : Initializes IchiBot for use in the server.\n" +
        "-s|set|settings : Configures server settings for IchiBot.\n" +
        "-p|profile      : Set personal profile for IchiBot.\n" +
        "-a|add          : Add audio tracks to playlist.\n" +
        "-d|delete       : Remove audio tracks from playlist.\n" +
        "-f|force        : Force specific playback routine.\n" +
        "-l|list         : List your uploaded tracks.```";
}

module.exports = {
    specificHelp : function(arg) {
        switch (arg) {
            case 'i':
            case 'init':
                return "```md\n" +
                    "-i|init  ---  Initializes IchiBot for use in the server.\n\n" +
                    "* IchiBot requires this command to be run at least once on the server before functioning.\n" +
                    "* Future initializations will reset all server configurations done by [-s|set|settings].```";
            case 's':
            case 'set':
            case 'settings':
                return "```md\n" +
                    "-s|set|settings [param] [value]  ---  Configures server settings for IchiBot.\n\n" +
                    "* Only one setting can be changed with each command.\n" +
                    "* Using [-i|init] will discard all changes made by this command in this server.\n" +
                    "* [param] [value] pairs are listed below:\n\n" +
                    "* [c|command] [#TEXTCHANNEL]  >>>  IchiBot will only listen in [#TEXTCHANNEL] for commands.\n" +
                    "  * If not set, IchiBot will listen on the entire server for commands.\n" +
                    "  * [-i|init], [-h|help] and [-s|set|settings] are always exempt from this configuration.\n" +
                    "* [p|player] [#TEXTCHANNEL]  >>>  IchiBot will only generate the embedded player in that channel when mentioned.\n" +
                    "  * If not set, IchiBot will generate the player in the same channel the mention was invoked.\n" +
                    "* [d|default] [true / false]  >>>  Determines whether IchiBot uses default tracks in the server.\n" +
                    "* [m|mahjong] [true / false]  >>>  Will use generic terms on embedded player if set to false.```";
            case 'p':
            case 'profile':
                return "```md\n" +
                    "-p|profile [IMAGEURL]/[d|delete]  ---  Set personal profile for IchiBot.\n\n" +
                    "* The image can be in any common image format, including GIFs.\n" +
                    "* The image will always FIT TO FILL square bounds. For the best result, make sure your image has square dimensions.\n" +
                    "* A bad/faulty image link will cause the player to render nothing, causing a shrunk player.\n" +
                    "* Using [d|delete] instead of providing an image URL will unset your profile for the server, restoring default settings.```";
            case 'a':
            case 'add':
                return "```md\n" +
                    "-a|add [h|hanchan|a|ambient|0 / r|riichi|b|battle|1] [TRACKNAME] [AUDIOURL]  ---  Add audio tracks to playlist.\n\n" +
                    "* If any parameters need a space ( ), enclose the parameter in quotes \"like so\".\n" +
                    "* [TRACKNAME] must be a unique, unused string of less than or equal to 30 characters in the server.\n" +
                    "* [AUDIOURL] must direct to a raw audio source. A correct link if opened in a browser should be nothing but a playback GUI.\n" +
                    "  * The audio can be in any common audio format such as .mp3 or .ogg.\n" +
                    "  * If you need help in uploading your own audio files to link, type [-help mp3].```";
            case 'd':
            case 'delete':
                return "```md\n" +
                    "-d|delete [TRACKNAME]  ---  Remove audio tracks from playlist.\n\n" +
                    "* [TRACKNAME] must be the exact same unique string you used when you [add]ed the track.\n" +
                    "* You can only delete the tracks you [add]ed yourself, and cannot delete other people's tracks or the default tracks.\n" +
                    "  * The default tracks can be disabled in [s|set|settings], however.```";
            case 'f':
            case 'force':
                return "```md\n" +
                    "-f|force [@MENTION / TRACKNAME]  ---  Force specific playback routine.\n\n" +
                    "* If any parameters need a space ( ), enclose the parameter in quotes \"like so\".\n" +
                    "* [@MENTION] will only work if IchiBot is in default mode, and [TRACKNAME] will only work in jukebox mode.\n" +
                    "* Passing a [@MENTION] in default mode will allow you to play a user's Riichi playlist in their stead.\n" +
                    "* Passing a [TRACKNAME] in jukebox mode will allow you to play the specific track.\n" +
                    "  * [TRACKNAME] must match the exact name of the track - case, spaces and all.\n" +
                    "  * If successful, the displayed page will also jump to the track's location in the jukebox.```"
            case 'l':
            case 'list':
                return "```md\n" +
                    "-u|upload  ---  List your uploaded tracks.\n\n" +
                    "* You can only request your own list.```"
            case 'mp3':
                return "```md\n" +
                "* If you have local audio files (e.g. .mp3 files) that you can use after uploading, the following two methods are streamlined by IchiBot:\n" +
                "<GOOGLE_DRIVE>\n" +
                "1. Upload your audio file into your Google Drive\n" +
                "2. Open the context menu (three vertical dots) of the audio file and click [Share > Share].\n" +
                "3. Make sure [General Access] is set to [Anyone with the link] and click on [Copy Link] at the bottom left.\n" +
                "4. A usable URL should look something like: [https://drive.google.com/file/d/(FILEIDHERE)/view?usp=sharing]\n" +
                "<DROPBOX>\n" +
                "1. Upload your audio file into your Dropbox\n" +
                "2. Hover over the uploaded audio file and click on [Copy Link]\n" +
                "   * If the above option doesn't show, hover over the file and open the context menu (three horizontal dots) - [Copy Link] should be there\n" +
                "3. A usable URL should look something like: [https://www.dropbox.com/scl/fi/(ID)/(AUDIOFILE)?rlkey=(KEYID)&dl=0]\n\n" +
                "* IchiBot is converting the links to raw audio urls behind the scenes for you if you use one of the above techniques!\n" +
                "* If using a different host, it must direct to a raw audio source. A correct link if opened in a browser should be nothing but a playback GUI.\n" +
                "  * Alternatively, if when selecting the track in IchiBot's Jukebox it immediately plays the next track instead, the audio is not working.```";
            default:
                return genericHelp();
        }
    }
}