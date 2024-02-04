module.exports = {
    specificHelp : function(arg) {
        switch (arg) {
            case 'i':
            case 'init':
                return "```md\n" +
                    "-i|init  ---  Initializes IchiBot for use in the server.\n" +
                    "> Example: -init\n\n" +
                    "* IchiBot requires this command to be run at least once on the server before functioning.\n" +
                    "* Future initializations will reset all server configurations done by [-s|set|settings].```";
            case 's':
            case 'set':
            case 'settings':
                return "```md\n" +
                    "-s|set|settings [param] [value]  ---  Configures server settings for IchiBot.\n" +
                    "> Example: -settings mahjong true\n\n" +
                    "* Only one setting can be changed with each command.\n" +
                    "* Using [-i|init] will discard all changes made by this command in this server.\n" +
                    "* [param] [value] pairs are listed below:\n\n" +
                    "* [c|command] [#TEXTCHANNEL]  >>>  IchiBot will only listen in [#TEXTCHANNEL] for commands.\n" +
                    "  * If not set, IchiBot will listen on the entire server for commands.\n" +
                    "  * [-i|init], [-h|help] and [-s|set|settings] are always exempt from this configuration.\n" +
                    "* [p|player] [#TEXTCHANNEL]   >>>  IchiBot will only generate the embedded player in that channel when mentioned.\n" +
                    "  * If not set, IchiBot will generate the player in the same channel the mention was invoked.\n" +
                    "* [d|default] [true / false]  >>>  Determines whether IchiBot uses default tracks in the server.\n" +
                    "* [m|mahjong] [true / false]  >>>  Will use generic terms on embedded player if set to false.```";
            case 'p':
            case 'profile':
                return "```md\n" +
                    "-p|profile [IMAGEURL]/[d|delete]  ---  Set a user's personal profile for IchiBot.\n" +
                    "> Example: -profile https://website/urltoimage/image.png\n\n" +
                    "* You can only manage your own profile image.\n" +
                    "* The image can be in any common image format, including GIFs.\n" +
                    "* The image will always FIT TO FILL square bounds. For the best result, make sure your image has square dimensions.\n" +
                    "* A bad/faulty image link will cause the player to render nothing, causing a shrunk player.\n" +
                    "* Using [d|delete] instead of providing an image URL will unset your profile for the server, restoring default settings.```";
            case 'a':
            case 'add':
                return "```md\n" +
                    "-a|add [h|hanchan|a|ambient|0 / r|riichi|b|battle|1] [TRACKNAME] [AUDIOURL]  ---  Add audio tracks to playlist.\n" +
                    "> Example: -add hanchan \"New Track\" https://website/urltonewtrack/dir/file.mp3\n\n" +
                    "* If any parameters need a space ( ), enclose the parameter in quotes \"like so\".\n" +
                    "* [TRACKNAME] must be a unique, unused string of less than or equal to 30 characters in the server.\n" +
                    "* [AUDIOURL] must direct to a raw audio source. A correct link if opened in a browser should be nothing but a playback GUI.\n" +
                    "  * The audio can be in any common audio format such as .mp3 or .ogg.\n" +
                    "  * If you need help in uploading your own audio files to link, type [-help mp3].```";
            case 'd':
            case 'delete':
                return "```md\n" +
                    "-d|delete [TRACKNAME]  ---  Remove audio tracks from playlist.\n" +
                    "> Example: -delete \"New Track\"\n\n" +
                    "* [TRACKNAME] must be the exact same unique string you used when you [add]ed the track.\n" +
                    "* You can only delete the tracks you [add]ed yourself, and cannot delete other people's tracks or the default tracks.\n" +
                    "  * The default tracks can be disabled in [s|set|settings], however.```";
            case 'f':
            case 'force':
                return "```md\n" +
                    "-f|force [@MENTION / TRACKNAME]  ---  Force specific playback routine.\n" +
                    "> Example: -force \"Winding Stream Party\"\n\n" +
                    "* If any parameters need a space ( ), enclose the parameter in quotes \"like so\".\n" +
                    "* [@MENTION] will only work if IchiBot is in default mode, and [TRACKNAME] will only work in jukebox mode.\n" +
                    "* Passing a [@MENTION] in default mode will allow you to play a user's Riichi playlist in their stead.\n" +
                    "* Passing a [TRACKNAME] in jukebox mode will allow you to play the specific track.\n" +
                    "  * [TRACKNAME] must match the exact name of the track - case, spaces and all.\n" +
                    "  * If successful, the displayed page will also jump to the track's location in the jukebox.```"
            case 'l':
            case 'list':
                return "```md\n" +
                    "-l|list  ---  List your uploaded tracks.\n" +
                    "> Example: -list\n\n" +
                    "* You can only request your own list.```"
            case 'x':
            case 'export':
                return "```md\n" +
                    "-e|export  ---  Generates server ID for export.\n" +
                    "> Example: -export\n\n" +
                    "* The ID is generated by Discord and is unique to every server.```"
            case 'm':
            case 'import':
                return "```md\n" +
                    "-m|import [SERVERID]  ---  Imports user's track from server ID.\n" +
                    "> Example: -import 12345\n\n" +
                    "* Import will only work if you have at least one track in the provided server (and the server must exist).\n" +
                    "* You will be prompted once before the import to make certain you want to import all the tracks.\n" +
                    "* Import will not validate any of the tracks as IchiBot will assume the URLs have not changed since they were added.```"
            case 'q':
            case 'faq':
                return "```md\n" +
                "> IchiBot isn't recognizing my #/@mention parameters in commands.\n" +
                "You must type mentions as Discord intended. Dragging usernames, channels or servers into the text field generates different text from one you manually type, but Discord \"corrects\" its display. Discord's API can only parse the ones you manually type, so it should work then.\n" +
                "> Google Drive tracks are no longer playing any music.\n" +
                "Providing a bad Google Drive link (e.g. invalid viewing permissions) may temporarily blacklist IchiBot's IP from accessing Google Drive for an extended period of time. Please double-check your track uploads to avoid this issue. This problem should resolve itself in about an hour. IchiBot will continue to function normally in all other aspects.\n" +
                "> IchiBot gave me a notice about DropBox URLs. What's that about?\n" +
                "Dropbox currently does not have an easy way for REQUESTs to accurately identify a file's type - everything returns as [application/json]. As such, it will be a user's responsibility to make sure DropBox URLs are audio files.\n" +
                "You can manually validate tracks by trying to play them in the Jukebox and see if playback works there.\n" +
                "> Dropbox tracks are stopping playback prematurely - why won't IchiBot play the full audio file?\n" +
                "Dropbox raw audio links can cut off prematurely due to their playback limitations according to your pricing plan. If using Dropbox for free, it is advised to only upload short tracks.\n" +
                "> I would like to use audio files without having to use Google Drive or Dropbox.\n" +
                "You can use any direct/raw mp3 source available on the internet. As long as the URL opens a page that immediately plays the audio file with nothing but a barebones audio GUI, the link should pass IchiBot's audio check. More often than not, valid URLs will end with an audio file extension, such as .mp3.\n" +
                "> The music keeps rubberbanding.\n" +
                "The VPS service has been upgraded since, but if it is still unbearably bad please DM the creator.\n" +
                "> Do not -force IchiBot.\n" +
                "Okay?```"
            case 'mp3':
                return "```md\n" +
                "* If you have local audio files (e.g. .mp3 files) that you can upload, the following two methods are streamlined by IchiBot:\n" +
                "<GOOGLE-DRIVE>\n" +
                "1. Create a folder for all your tracks in Google Drive\n" +
                "2. Open the context menu (three vertical dots) of the folder and click [Share > Share] and set [General Access] to [Anyone with the link].\n" +
                "4. Upload tracks you wish to use into this folder. Every audio track will inherit the sharing permissions of your folder.\n" +
                "5. With each track, right-click the file and click [Share > Copy Link].\n" +
                "   * You can check correct viewing permissions by going to [Share > Share] if you are uncertain about it on a file-by-file basis.\n" +
                "6. A usable URL should look something like: [https://drive.google.com/file/d/(FILEIDHERE)/view?usp=sharing]\n" +
                "   * It can alternatively look like: [https://drive.google.com/open?id=(FILEIDHERE)&(MISCPARAM)]\n" +
                "<DROPBOX>\n" +
                "1. Upload your audio file into your Dropbox\n" +
                "2. Hover over the uploaded audio file and click on [Copy Link]\n" +
                "   * If the above option doesn't show, [Copy Link] should also exist in the context menu (three horizontal dots)\n" +
                "3. A usable URL should look something like: [https://www.dropbox.com/scl/fi/(ID)/(AUDIOFILE)?rlkey=(KEYID)&dl=0]\n\n" +
                "* IchiBot is converting the links to raw audio urls behind the scenes for you if you use one of the above techniques!\n" +
                "* Type -q|faq for known drawbacks of each of the above methods, or how to confirm if an alternative method will work.```";
            default:
                return "```md\n" +
                "@IchiBot        : Calls IchiBot to your voice channel.\n" +
                "-h|help (x)     : Shows help for various commands. Specify a command for further details (e.g. -help i).\n" +
                "-i|init         : Initializes IchiBot for use in the server.\n" +
                "-s|set|settings : Configures server settings for IchiBot.\n" +
                "-p|profile      : Set personal profile for IchiBot.\n" +
                "-a|add          : Add audio tracks to playlist.\n" +
                "-d|delete       : Remove audio tracks from playlist.\n" +
                "-f|force        : Force specific playback routine.\n" +
                "-l|list         : List your uploaded tracks.\n" +
                "-x|export       : Generates server ID for export.\n" +
                "-m|import       : Imports user's track from server ID.\n" +
                "-q|faq          : List of common questions and alternative solutions.```";
        }
    }
}