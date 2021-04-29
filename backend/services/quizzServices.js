const spotifyService = require("./spotifyServices");
const { getFormattedTrackQuestion, getTrackAnswer, pickRandomElement } = require('../utils/formattedUtils');

exports.startGame = async (session, username, mode, artist) => {
  try { // we initialize a new session
    if(session.endGame){
      delete session.endGame;
    }
    session.username = username;
    session.points = "0";
    session.mode = mode;
    session.artist = artist;
    session.trackAlreadyAsked = [];
    return { username, artist, points: session.points };
  } catch(e){
    throw e;
  }
}

exports.getQuestion = async (session) => { // pick a random album, then a random song in the album
  try {
    let albums = await spotifyService.getAlbums(session.artist);
    if(albums.status != 200){
      throw "Spotify " + albums.message;
    }
    let randomAlbum = pickRandomElement(albums.data.items);
    let albumTracks = await spotifyService.getAlbumTracklist(randomAlbum.id);
    if(albumTracks.status != 200){
      throw "Spotify " + albums.message;
    }
    let randomTrack = pickRandomElement(albumTracks.data.items);
    let trackInfo = await spotifyService.getTrack(randomTrack.id); // get informations about the track we picked randomly
    while(trackInfo.status == 200 && session.trackAlreadyAsked.includes(trackInfo.data.id)){ // while we already asked the track to the user
      trackInfo = await spotifyService.getTrack(randomTrack.id);
    } 
    let trackFormattedInfo = getFormattedTrackQuestion(trackInfo.data);
    session.trackAlreadyAsked.push(trackFormattedInfo.id); // update redis session management object 
    session.currentYearAnswer = getTrackAnswer(trackInfo.data);
    session.currentQuestion = trackFormattedInfo.id;
    return trackFormattedInfo;
  } catch(e) {
    throw e;
  }
}

exports.answer = async (session, songID, year) => {
  try {
    if(session.currentQuestion === songID){
      let returnedAnswer = checkAnswer(session, year);
      delete session.currentYearAnswer;
      delete session.currentQuestion;
      return returnedAnswer;
    }else{
      throw "There is a difference between the current question and the song id provided."
    }
  } catch(e) {
    throw e;
  }
}

getTopTracks = async artist => {
  let mostPopularSongs = await spotifyService.getTopSongs(artist);
    if(mostPopularSongs.status != 200){
      throw "Spotify " + mostPopularSongs.message;
    }
    let tracks = [];
    mostPopularSongs.data.tracks.forEach(track => {
      let trackObject = getFormattedTrackQuestion(track);
      tracks.push(trackObject);
    });
    return tracks;
}


checkAnswer = (session, year) => {
  let returnedObject = {};
  if(session.currentYearAnswer === year){
    session.points = (parseInt(session.points) + 1).toString(); // + 1 point
    returnedObject.answer = true;
  }else{ // we end the game by adding a new session parameter for future API call
    session.endGame = true;
    delete session.trackAlreadyAsked;
    returnedObject.answer = false;
  }
  returnedObject.points = parseInt(session.points);
  returnedObject.release_year = session.currentYearAnswer;
  return returnedObject;
}