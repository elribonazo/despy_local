var express = require('express');
var fs = require('fs');
var Spotify = require('spotify-web');
var ffmetadata = require("avconv_id3");
var spotify_config = require('./config/spotify.json');
var spotify_username =spotify_config.login;
var spotify_password =spotify_config.password;


var debugMemoryUsage = true;
var uris = [];
var currentTrack = [];
var trackList = [];
var downloadinfo = [];
var pathToFile = __dirname + "/downloads.txt";
var eliminadas = 0;
if (debugMemoryUsage) {
	setInterval(function () {
		var mem = process.memoryUsage();
		console.log(Math.round(mem.rss/1024/1024)+" MB RSS used | "+Math.round(mem.heapUsed/1024/1024)+" MB heap used | "+Math.round(mem.heapTotal/1024/1024)+" MB heap total | "+Math.round((mem.heapUsed/mem.heapTotal)*100)+"% of heap used");
	}, 500000);
}
function playTrack(spotify,downloadinfo) {

	if(!spotify){
		return;
	}

	var st = Date.now();
	if (trackList.length === 0) {
		spotify.disconnect();
		process.exit(code=0);
		return;
	}

	var linea = currentTrack++;

	var uri = trackList[linea];

	if (uri === undefined) {
		trackList = [];
		playTrack(spotify,downloadinfo);
		return;
	}

	spotify.get(uri, function (err, track) {
		if (err) throw err;

		/*fs.readFile(pathToFile, function (err, data) {
			var lineas = data.toString().split('\n'); 

			console.log("Removing " + uri + ":" + lineas[linea-eliminadas] + " Line " + (linea  - eliminadas));
			if(uri == lineas[linea  - eliminadas]) {

				var linea_eliminar = linea  - eliminadas;

				lineas.splice(linea_eliminar, 1);
				++eliminadas;

				var newfile = "";
				for(m=0;m<lineas.length;++m){
					if(m>0) newfile += "\n"
					newfile += lineas[m];
				}
*/

				/*fs.writeFile(pathToFile, newfile, function(err) {
					if(err) {
						console.log(err);
					} else {*/
						if (!spotify.isTrackAvailable(track)) {
							console.log("Unable to play "+track.artist[0].name+' - '+track.name+', track not available');
							playTrack(spotify,downloadinfo);
							return;
						}



						var _chunks = [];
						var datos = 0;
						var falbum = track.album.name;
						var ftrackname = track.name;


						var trackinfo = {};
						trackinfo.artist = track.artist.name;
						trackinfo.album = falbum;
						trackinfo.track = ftrackname;
						trackinfo.genre = track.genre;

						falbum = falbum.replace("\/","").replace(/[^a-zA-Z0-9 -_]/g,'').replace("(","").replace(")","");
						falbum = falbum.replace("\/","").replace(".","").replace(",","").replace("/","");
						ftrackname = ftrackname.replace(".","").replace("(","").replace(")","").replace("\/","").replace(",","").replace("/","").replace(/[^a-zA-Z0-9\- ]/gi,'');


						fs.exists(__dirname + "/downloads/" + ftrackname + ".mp3" , function(exists) {
							if (exists) {
								console.log(__dirname + "/downloads/" + ftrackname + ".mp3  YA existia");
								playTrack(spotify,downloadinfo);
							}else{

								var stream = track.play();
								console.log(ftrackname + ".mp3");
								console.log("Downloaded " +currentTrack + " , " + (trackList.length - eliminadas) + " pending downloads.");

								stream.on('data', function(chunk) {
									datos += chunk.length;
									_chunks.push(chunk);
								});


								stream.on("end",function(){
									var tags = {title: trackinfo.track, artist: track.artist[0].name, album: trackinfo.album}
									var fartist = track.artist[0].name;
									var body = Buffer.concat(_chunks);
									var fichero_destino = __dirname + "/downloads/" + ftrackname  + ".mp3";
									fs.writeFile(fichero_destino, body, function (err) {
										if (err) throw err;

										var data = {artist: tags.artist,title: tags.title,album: tags.album };

										if(downloadinfo.tipo == "playlist"){
											data.album = downloadinfo.playlist;
										}

										ffmetadata.write(fichero_destino, data, function(err) {
											if (err) 
												console.error("Error writing metadata" + err);
										});
									});
									playTrack(spotify,downloadinfo);
								});


							}
						});
					//}
				//}); 

		//	}
		//});



	});
}



fs.exists(__dirname + "/downloads/", function(exists) {
	if(!exists){
		fs.mkdirSync(__dirname + "/downloads");
	}
	Spotify.login(spotify_username, spotify_password, function (err, spotify) {
		console.log("Buscando pistas...");


		var i = -1;
		trackList = [];		
		currentTrack = 0;
		downloadinfo = {};

		fs.readFile(pathToFile, function (err, data) {
			bufferString = data.toString(); 
			bufferStringSplit = bufferString.split('\n'); 	    
			uris = bufferStringSplit; 
			uriLoop();
		});

		var f = 0;

		function uriLoop() {
			i++;

			if (i >= uris.length) {


				/*var newfile = "";
				for(m=0;m<trackList.length;++m){
					if(trackList[m].length < 8) continue;
					if(m>0) newfile += "\n"
						newfile += trackList[m];
				}


				fs.writeFile(pathToFile, newfile, function(err) {
					if(err) {
						console.log(err);
					} else {
						console.log(trackList.length +" track(s) in list");
						playTrack(spotify,downloadinfo);
					}
				}); */

				console.log(trackList.length +" track(s) in list");
				playTrack(spotify,downloadinfo);



				return;
			}


			try{
				var uri = uris[i];

				var type = Spotify.uriType(uri);

				if (type === 'track') {
					spotify.get(uri, function (err, track) {
						if (err) {
							return false;
						}
						console.log("Adding track "+track.name+" - "+track.artist[0].name + " - " + uri);

						trackList.push(uri);


						downloadinfo.tipo = type;
						downloadinfo.track = track;

						uriLoop();
					});
				} else if (type === 'playlist') {
					spotify.playlist(uri, 0, 1000, function (err, playlist) {
						if (err) {
							return false;
						}
						console.log("Adding playlist "+playlist.attributes.name);
						if (playlist.length > 0) {
							for (var j = 0; j < playlist.contents.items.length; j++) {
								var uri = playlist.contents.items[j].uri;
								if (Spotify.uriType(uri) === 'track') {
									trackList.push(playlist.contents.items[j].uri);
								}
							}

							downloadinfo.tipo = type;
							downloadinfo.playlist = playlist.attributes.name;
						}
						uriLoop();
					});
				} else if (type === 'album') {
					spotify.get(uri, function (err, album) {
						if (err) {
							return false;
						}
						console.log("Adding album "+album.name);

						var tracks = [];

						album.disc.forEach(function (disc) {
							if (!Array.isArray(disc.track)) return;

							for (var j = 0; j < disc.track.length; j++) {
								trackList.push(disc.track[j].uri);
							}
						});


						downloadinfo.tipo = type;
						downloadinfo.album = album;


						uriLoop();
					});


				} else {
					console.log("Ignoring "+uri+" of type "+type);
					uriLoop();
				}
			} catch (e) {
				console.log(e.message);
			}
		}
	});

});