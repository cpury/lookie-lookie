$(document).ready(function() {
  var vid = document.getElementById('webcam');
  var overlay = document.getElementById('overlay');

  window.facetracker = {
    vid: vid,
    vidWidth: vid.width,
    vidHeight: vid.height,
    overlay: overlay,
    overlayCC: overlay.getContext('2d'),

    trackingStarted: false,
    currentPosition: null,
    currentEyeRect: null,

    adjustVideoProportions: function() {
      // resize overlay and video if proportions of video are not 4:3
      // keep same height, just change width
      var proportion = facetracker.vid.videoWidth / facetracker.vid.videoHeight;
      facetracker.vidWidth = Math.round(facetracker.vidHeight * proportion);
      facetracker.vid.width = facetracker.vidWidth;
      facetracker.overlay.width = facetracker.vidWidth;
    },

    gumSuccess: function(stream) {
      ui.onWebcamEnabled();

      // add camera stream if getUserMedia succeeded
      if ("srcObject" in facetracker.vid) {
        facetracker.vid.srcObject = stream;
      } else {
        facetracker.vid.src = (window.URL && window.URL.createObjectURL(stream));
      }

      facetracker.vid.onloadedmetadata = function() {
        facetracker.adjustVideoProportions();
        facetracker.vid.play();
      };

      facetracker.vid.onresize = function() {
        facetracker.adjustVideoProportions();
        if (facetracker.trackingStarted) {
          facetracker.ctrack.stop();
          facetracker.ctrack.reset();
          facetracker.ctrack.start(facetracker.vid);
        }
      };
    },

    gumFail: function() {
      ui.showInfo('There was some problem trying to fetch video from your webcam 😭', true);
    },

    startVideo: function() {
      // start video
      facetracker.vid.play();
      // start tracking
      facetracker.ctrack.start(facetracker.vid);
      facetracker.trackingStarted = true;
      // start loop to draw face
      facetracker.positionLoop();
    },

    positionLoop: function() {
      // Check if a face is detected, and if so, track it.
      requestAnimationFrame(facetracker.positionLoop);
      facetracker.currentPosition = facetracker.ctrack.getCurrentPosition();
      facetracker.overlayCC.clearRect(0, 0, facetracker.vidWidth, facetracker.vidHeight);
      if (facetracker.currentPosition) {
        facetracker.trackFace(facetracker.currentPosition);
        facetracker.ctrack.draw(facetracker.overlay);
        ui.onFoundFace();
      }
    },

    getEyesRect: function(position) {
      // Given a tracked face, returns a rectangle surrounding the eyes.
      var minX = position[19][0] + 3;
      var maxX = position[15][0] - 3;
      var minY = Math.min(position[20][1], position[21][1], position[17][1], position[16][1]) + 6;
      var maxY = Math.max(position[23][1], position[26][1], position[31][1], position[28][1]) + 3;

      var width = maxX - minX;
      var height = maxY - minY - 5;

      return [minX, minY, width, height * 1.25];
    },

    trackFace: function(position) {
      // Given a tracked face, crops out the eyes and draws them in the eyes canvas.
      var rect = facetracker.getEyesRect(position);
      facetracker.currentEyeRect = rect;

      var tempCanvas = document.getElementById('temp');
      var tempCtx = tempCanvas.getContext('2d');
      var eyesCanvas = document.getElementById('eyes');
      var eyesCtx = eyesCanvas.getContext('2d');

      tempCtx.drawImage(facetracker.vid, 0, 0, facetracker.vidWidth, facetracker.vidHeight);
      eyesCtx.drawImage(tempCanvas, rect[0], rect[1], rect[2], rect[3], 0, 0, eyesCanvas.width, eyesCanvas.height);
      tempCtx.strokeStyle = 'green';
      tempCtx.strokeRect(rect[0], rect[1], rect[2], rect[3]);
    }
  };

  vid.addEventListener('canplay', facetracker.startVideo, false);

  // set up video
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia({video : true})
    .then(facetracker.gumSuccess)
    .catch(facetracker.gumFail);
  } else if (navigator.getUserMedia) {
    navigator.getUserMedia({video : true}, facetracker.gumSuccess, facetracker.gumFail);
  } else {
    ui.showInfo('Your browser does not seem to support getUserMedia. 😭 This will probably only work in Chrome or Firefox.', true);
  }

  facetracker.ctrack = new clm.tracker();
  facetracker.ctrack.init();
});
