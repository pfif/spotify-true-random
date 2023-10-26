// TODO Renew token every so often

function shuffleSongs(song_set, limit) {
  let songs_list = Array.from(song_set)
  for (let i = songs_list.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [songs_list[i], songs_list[j]] = [songs_list[j], songs_list[i]];
  }

  return songs_list.slice(0, limit)
}

const songStorage = (() => {
  return {
    getPlayedSongsForPlaylist: (playlist_id) => {
      let played_song_raw = window.localStorage.getItem(`spotifyrandom.playedsongs.${playlist_id}`);
      if (played_song_raw == null) {
        return new Set();
      }

      return new Set(JSON.parse(played_song_raw));
    },
    storePlayedSongsForPlaylist: (playlist_id, played_songs) => {
      window.localStorage.setItem(`spotifyrandom.playedsongs.${playlist_id}`, JSON.stringify(Array.from(played_songs)));
    },
    resetPlayedSongsForPlaylist: (playlist_id) => {
      window.localStorage.removeItem(`spotifyrandom.playedsongs.${playlist_id}`);
    },
    storeCurrentPlaylist: (song_list, playlist_id, playlist_length) => {
      window.localStorage.setItem("spotifyrandom.currentPlaylist", JSON.stringify({"list": song_list, playlist_id: playlist_id, playlist_length: playlist_length}))
    },

    getCurrentPlaylist: () => {
      let data = JSON.parse(window.localStorage.getItem("spotifyrandom.currentPlaylist"))
      return [data.list, data.playlist_id, data.playlist_length]
    }
  }
})();

const spotifyRandom = (() => {
  const clientId = 'fc82a69b362b44e1b5713becc23523c2';
  const redirect = 'http://127.0.0.1:8000';
  const scope = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-modify-playback-state',
    'user-library-read',
    'user-read-playback-state'
  ];
  const stateKey = 'state';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let alerted = false;
  let refreshIntervalID = "";

  const spotify = new SpotifyWebApi();
  let access;
  let expires;

  function hashParams() {
    const params = {};
    const r = /([^&;=]+)=?([^&;]*)/g,
      q = window.location.hash.substring(1);

    let e;
    while (e = r.exec(q)) {
      params[e[1]] = decodeURIComponent(e[2]);
    }

    return params;
  }

  function login() {
    const state = Array.apply(null, Array(16)).map(() => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
    localStorage.setItem(stateKey, state);

    window.location.href = 'https://accounts.spotify.com/authorize' +
      '?client_id=' + encodeURIComponent(clientId) +
      '&response_type=' + encodeURIComponent('token') +
      '&redirect_uri=' + encodeURIComponent(redirect) +
      '&state=' + encodeURIComponent(state) +
      '&scope=' + encodeURIComponent(scope.join(' '));
  }

  function token() {
    if (access && expires && new Date().getTime() < expires) {
      return access;
    }

    const params = hashParams();

    if (params['state'] && params['access_token'] && params['expires_in'] && params['state'] === localStorage.getItem(stateKey)) {
      localStorage.removeItem(stateKey);
      access = params['access_token'];
      expires = new Date().getTime() + params['expires_in'];
      window.location.hash = '';
      return access;
    }

    login();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  return {
    token: token,
    playlists: cb => {
      spotify.setAccessToken(token());
      spotify.getUserPlaylists({ limit: 50 }, (err, data) => cb(data));
    },
    tracks: (playlist, cb) => {
      const id = playlist.split(':')[1];

      const total = playlist.split(':')[2];
      let i = 0;

      const tracks = [];

      (function f() {
        spotify.setAccessToken(token());
        spotify.getPlaylistTracks(id, {
          offset: i,
          limit: 100,
          fields: 'items(track(uri))'
        }, (err, data) => {
          data['items'].map(obj => obj['track']['uri']).forEach(obj => tracks.push(obj));
          i += 100;

          if (i < total) {
            f();
          } else {
            cb(tracks, id);
          }
        });
      })();
    },
    savedTracks: cb => {
      spotify.setAccessToken(token());
      spotify.getMySavedTracks({ limit: 50 }, (err, data) => {
        const total = data['total'];
        let i = 50;

        const tracks = data['items'].map(obj => obj['track']['uri']);

        (function f() {
          spotify.setAccessToken(token());
          spotify.getMySavedTracks({
            offset: i,
            limit: 50,
          }, (err, data) => {
            data['items'].map(obj => obj['track']['uri']).forEach(obj => tracks.push(obj));
            i += 50;

            if (i < total) {
              f();
            } else {
              cb(tracks);
            }
          });
        })();
      });
    },
    library: (el, cb) => {
      let oldContent = el.textContent;
      el.disabled = true;
      spotify.setAccessToken(token());
      spotify.getMySavedAlbums({ limit: 50 }, (err, data) => {
        const total = data['total'];
        let i = 50;
        const albums = data['items'].map(obj => obj['album']['id']);
        (function f1() {
          spotify.getMySavedAlbums({
            offset: i,
            limit: 50,
          }, (err, data) => {
            data['items'].map(obj => obj['album']['id']).forEach(obj => albums.push(obj));
            i += 50;
            el.textContent = "Retrieving albums " + Math.min(i, total) + "/" + total;

            if (i < total) {
              f1();
            } else {
              tracks = [];
              let albumIndex = 0;
              (function f2() {
                if (albumIndex < albums.length) {
                  el.textContent = "Retrieving tracks " + Math.min(albumIndex, albums.length) + "/" + albums.length;
                  let i = 0;
                  spotify.getAlbumTracks(albums[albumIndex], {
                    offset: i,
                    limit: 50,
                  }, (err, data) => {
                    const total = data['total'];
                    data['items'].map(obj => obj['uri']).forEach(obj => tracks.push(obj));
                    i += 50;
                    if (i >= total) {
                      albumIndex++;
                      f2();
                      return;
                    }
                    (function f3() {
                      spotify.setAccessToken(token());
                      spotify.getAlbumTracks(albums[albumIndex], {
                        offset: i,
                        limit: 50,
                      }, (err, data) => {
                        data['items'].map(obj => obj['uri']).forEach(obj => tracks.push(obj));
                        i += 50;
                        if (i < total) {
                          f3();
                        } else {
                          albumIndex++;
                          f2();
                        }
                      });
                    })();
                  });
                } else {
                  el.disabled = false;
                  el.textContent = oldContent;
                  cb(tracks);
                }
              })();
            }
          });
        })();
      });
    },
    devices: cb => {
      spotify.setAccessToken(token());
      spotify.getMyDevices((err, data) => cb(data['devices'].filter(device => !device['is_restricted'])));
    },
    play: (playlist_song_list, playlist_id) => {

      const device = document.getElementById('devices-select').value;
      if (device !== '') {
        const played_song_list = songStorage.getPlayedSongsForPlaylist(playlist_id)

        const unplayed_song_list = new Set()

        for (const song of playlist_song_list) {
          if (!played_song_list.has(song)) {
            unplayed_song_list.add(song)
          }
        }
        console.log("Played / Unplayed", played_song_list, unplayed_song_list)
        console.log("Percentage of tracks remaining: ", unplayed_song_list.size, playlist_song_list.length, unplayed_song_list.size / playlist_song_list.length)

        const toqueue_length = Math.min(385, playlist_song_list.length)
        console.log("Length of the playlist", toqueue_length)

        let toqueue_song_list = []

        if (unplayed_song_list.size == 0) {
          console.log("Resetting songs for playlist", playlist_id)
          songStorage.resetPlayedSongsForPlaylist(playlist_id)
        } else {
          toqueue_song_list = shuffleSongs(unplayed_song_list, toqueue_length)
        }

        console.log("Playlist only from unplayed track", toqueue_song_list)

        if (toqueue_song_list.length < toqueue_length) {
          toqueue_song_list = [...toqueue_song_list,  ...shuffleSongs(played_song_list, toqueue_length - toqueue_song_list.length)]
        }

        console.log("Final playlist", toqueue_song_list)

        songStorage.storeCurrentPlaylist(toqueue_song_list, playlist_id, playlist_song_list.length)

        spotify.setAccessToken(token());
        spotify.play({
          uris: toqueue_song_list,
          device_id: device
        });
      }
    },
    logCurrentlyPlayedSong: async () => {
      try{
        spotify.setAccessToken(token());
        let currently_playing = (await spotify.getMyCurrentPlayingTrack())?.item?.uri;
        if (currently_playing !== undefined) {
          let [current_playlist, playlist_id, playlist_length] = songStorage.getCurrentPlaylist();
          let played_songs = songStorage.getPlayedSongsForPlaylist(playlist_id)
          // console.log(current_playlist.includes(currently_playing), !played_songs.has(currently_playing))
          if (current_playlist.includes(currently_playing) && !played_songs.has(currently_playing)) {
            console.log("Storing new song", currently_playing, playlist_id)
            console.log("Remaining", played_songs.size / playlist_length, playlist_length - played_songs.size)
            played_songs.add(currently_playing)
            songStorage.storePlayedSongsForPlaylist(playlist_id, played_songs)
          }
        }
      } catch (e) {
        console.error(e)
        if (!alerted) {
          alerted = true;
          alert("Could not reach Spotify. Please refresh the page")
        }
      }
    },
    refresh: () => {
      if (spotifyRandom.token()) {
        spotifyRandom.playlists(playlists => {
          const select = document.getElementById('playlists-select');

          for (let i = select.length - 1; i >= 0; i--) {
            select.remove(i);
          }

          playlists['items'].forEach(playlist => {
            const option = document.createElement('option');
            option.text = playlist['name'];
            option.value = playlist['owner']['id'] + ':' + playlist['id'] + ':' + playlist['tracks']['total'];
            select.add(option);
          });
        });

        spotifyRandom.devices(devices => {
          const select = document.getElementById('devices-select');

          for (let i = select.length - 1; i >= 0; i--) {
            select.remove(i);
          }

          if (devices.length === 0) {
            const option = document.createElement('option');
            option.text = 'Please Open Spotify';
            option.value = '';
            select.add(option);
          } else {
            devices.forEach(device => {
              const option = document.createElement('option');
              option.text = device['name'];
              option.value = device['id'];
              select.add(option);
            });
          }
        });
        clearInterval(refreshIntervalID)
        refreshIntervalID = setInterval(spotifyRandom.logCurrentlyPlayedSong, 1000)
      }
    }
  };
})();


document.addEventListener('DOMContentLoaded', () => spotifyRandom.refresh());
