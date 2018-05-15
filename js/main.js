// video support utility functions
function supports_video() {
  return !!document.createElement('video').canPlayType;
}

function supports_h264_baseline_video() {
  if (!supports_video()) { return false; }
  var v = document.createElement("video");
  return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
}

function supports_webm_video() {
  if (!supports_video()) { return false; }
  var v = document.createElement("video");
  return v.canPlayType('video/webm; codecs="vp8"');
}


$(document).ready(function() {
  var vid = document.getElementById('video');
	var vid_width = vid.width;
	var vid_height = vid.height;
	var overlay = document.getElementById('overlay');
	var overlayCC = overlay.getContext('2d');
  var currentPosition = null;

	/*********** Setup of video/webcam and checking for webGL support *********/

	var insertAltVideo = function(video) {
		// insert alternate video if getUserMedia not available
		if (supports_video()) {
			if (supports_webm_video()) {
				video.src = "./media/cap12_edit.webm";
			} else if (supports_h264_baseline_video()) {
				video.src = "./media/cap12_edit.mp4";
			} else {
				return false;
			}
			return true;
		} else return false;
	}

	function adjustVideoProportions() {
		// resize overlay and video if proportions of video are not 4:3
		// keep same height, just change width
		var proportion = vid.videoWidth/vid.videoHeight;
		vid_width = Math.round(vid_height * proportion);
		vid.width = vid_width;
		overlay.width = vid_width;
	}

	function gumSuccess( stream ) {
		// add camera stream if getUserMedia succeeded
		if ("srcObject" in vid) {
			vid.srcObject = stream;
		} else {
			vid.src = (window.URL && window.URL.createObjectURL(stream));
		}
		vid.onloadedmetadata = function() {
			adjustVideoProportions();
			vid.play();
		}
		vid.onresize = function() {
			adjustVideoProportions();
			if (trackingStarted) {
				ctrack.stop();
				ctrack.reset();
				ctrack.start(vid);
			}
		}
	}

	function gumFail() {
		// fall back to video if getUserMedia failed
		insertAltVideo(vid);
		document.getElementById('gum').className = "hide";
		document.getElementById('nogum').className = "nohide";
		alert("There was some problem trying to fetch video from your webcam, using a fallback video instead.");
	}

	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
	window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

	// set up video
	if (navigator.mediaDevices) {
		navigator.mediaDevices.getUserMedia({video : true}).then(gumSuccess).catch(gumFail);
	} else if (navigator.getUserMedia) {
		navigator.getUserMedia({video : true}, gumSuccess, gumFail);
	} else {
		insertAltVideo(vid);
		document.getElementById('gum').className = "hide";
		document.getElementById('nogum').className = "nohide";
		alert("Your browser does not seem to support getUserMedia, using a fallback video instead.");
	}

	vid.addEventListener('canplay', startVideo, false);

	/*********** Code for face tracking *********/

	var ctrack = new clm.tracker();
	ctrack.init();
	var trackingStarted = false;

	function startVideo() {
		// start video
		vid.play();
		// start tracking
		ctrack.start(vid);
		trackingStarted = true;
		// start loop to draw face
		positionLoop();
	}

	function positionLoop() {
		requestAnimationFrame(positionLoop);
		var position = ctrack.getCurrentPosition();
    overlayCC.clearRect(0, 0, vid_width, vid_height);
    if (position) {
      currentPosition = position;
      // console.info(currentPosition);
      capture();
      ctrack.draw(overlay);
    } else {
      // requestAnimationFrame(positionLoop);
    }
	}

  function getFaceRect(position) {
    var minX = position[19][0];
    var maxX = position[15][0];
    var minY = Math.min(position[20][1], position[21][1], position[17][1], position[16][1]);
    var maxY = Math.max(position[23][1], position[26][1], position[31][1], position[28][1]);
    // var maxY = Math.max(position[26][1]);

    var width = maxX - minX;
    var height = maxY - minY;

    return [minX, minY, width, height * 1.5];
  }

  function capture() {
    var rect = getFaceRect(currentPosition);

    var $video = $('#video');
    var tempCanvas = document.getElementById('temp');
    var tempCtx = tempCanvas.getContext('2d');
    var eyesCanvas = document.getElementById('eyes');
    var eyesCtx = eyesCanvas.getContext('2d');

    tempCtx.drawImage(video, 0, 0, video.width, video.height);

    tempCtx.strokeStyle = 'green';
    tempCtx.strokeRect( rect[0], rect[1], rect[2], rect[3] );

    eyesCtx.drawImage(tempCanvas, rect[0], rect[1], rect[2], rect[3], 0, 0, eyesCanvas.width, eyesCanvas.height);
  }
});
