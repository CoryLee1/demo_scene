let bgMusic;
let musicPlaying = false;

function preload() {
  soundFormats('mp3', 'ogg');
  bgMusic = loadSound('endleSSStation.mp3');
}

function setup() {
}

function draw() {
}

function mousePressed() {
  // Use a flag to make sure we only try to play music once
  if (!musicPlaying) {
    // On user interaction, we resume the audio context and start our music
    userStartAudio().then(() => {
      bgMusic.loop();
    });
    musicPlaying = true;
  }
}
