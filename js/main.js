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
  // Boilerplate code to allow async functions
  // Adapted from https://blog.mariusschulz.com/2016/12/09/typescript-2-1-async-await-for-es3-es5

  var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments)).next());
    });
  };

  /*********** Code for UI *********/

  var state = 'loading';

  function setContent(key, value) {
    // Set an element's content based on the data-content key.
    $('[data-content="' + key + '"]').html(value);
  }

  function addExampleCallback(n) {
    // Call this when example #n is added.
    setContent('n-train', n);
    if (n == 2) {
      $('#start-training').prop('disabled', false);
    }
    if (state == 'collecting' && n == 10) {
      setContent('info',
        'Great job! Now you have a handful of examples and can let the neural network train on them.<br>'
        + 'Click the "Train" button on the right to start.'
      );
    }
  }

  function trainingFinishedCallback() {
    // Call this when training is finished.
    $('#modelBall').css('opacity', '0.9');
    state = 'trained';
    setContent('info',
      'Awesome! The green ball should start following your eyes around.<br>'
      + 'It will be very bad at first, but you can collect more data and retrain again later!'
    );
  }



	/*********** Setup of video/webcam and checking for webGL support *********/

  var vid = document.getElementById('video');
	var vid_width = vid.width;
	var vid_height = vid.height;
	var overlay = document.getElementById('overlay');
	var overlayCC = overlay.getContext('2d');
  var currentPosition = null;

	function adjustVideoProportions() {
		// resize overlay and video if proportions of video are not 4:3
		// keep same height, just change width
		var proportion = vid.videoWidth/vid.videoHeight;
		vid_width = Math.round(vid_height * proportion);
		vid.width = vid_width;
		overlay.width = vid_width;
	}

	function gumSuccess( stream ) {
    state = 'collecting';
    setContent('info', 'Alright, follow the red ball with your eyes and hit the space key whenever you are focused on it.');
    $('#followBall').css('opacity', '0.9');
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
    setContent('info', 'There was some problem trying to fetch video from your webcam');
	}

	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
	window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

	// set up video
	if (navigator.mediaDevices) {
		navigator.mediaDevices.getUserMedia({video : true}).then(gumSuccess).catch(gumFail);
	} else if (navigator.getUserMedia) {
		navigator.getUserMedia({video : true}, gumSuccess, gumFail);
	} else {
		setContent('info', 'Your browser does not seem to support getUserMedia. This will probably only work in Chrome or Firefox.');
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
    // Check if a face is detected, and if so, track it.
		requestAnimationFrame(positionLoop);
		currentPosition = ctrack.getCurrentPosition();
    overlayCC.clearRect(0, 0, vid_width, vid_height);
    if (currentPosition) {
      trackFace(currentPosition);
      ctrack.draw(overlay);
    }
	}

  function getEyesRect(position) {
    // Given a tracked face, returns a rectangle surrounding the eyes.
    var minX = position[19][0];
    var maxX = position[15][0];
    var minY = Math.min(position[20][1], position[21][1], position[17][1], position[16][1]);
    var maxY = Math.max(position[23][1], position[26][1], position[31][1], position[28][1]);

    var width = maxX - minX;
    var height = maxY - minY;

    return [minX, minY, width, height * 1.5];
  }

  function trackFace(position) {
    // Given a tracked face, crops out the eyes and draws them in the eyes canvas.
    var rect = getEyesRect(position);

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


  /*********** Code for the ball position *********/

	function moveFollowBallRandomly() {
    // Move the ball to a random position.
    var x = 0.01 + Math.random() * 0.98;
    var y = 0.01 + Math.random() * 0.98;

    moveBall(x, y, 'followBall');
	}

  function moveBall(x, y, id) {
    // Given relative coordinates, moves the ball there.
    var left = x * $(document).width() - 40;
    var top = y * $(document).height() - 40;

    var $ball = $('#' + id);
    $ball.css('left', left + 'px');
    $ball.css('top', top + 'px');
  }

  function getFollowBallPos() {
    // Get the normalized ball position.
    var $ball = $('#followBall');
    var left = $ball.css('left');
    var top = $ball.css('top');
    var x = Number(left.substr(0, left.length - 2)) + 20;
    var y = Number(top.substr(0, top.length - 2)) + 20;

    return [x / $(document).width(), y / $(document).height()];
  }

  moveBall(0.5, 0.25, 'followBall');


  /*********** Code for collecting a dataset *********/

  // The dataset:
  var n = 0;
  var x = null;
  var y = null;
  var inputWidth = $('#eyes').width();
  var inputHeight = $('#eyes').height();

  function getImage() {
    // Capture the current image in the eyes canvas as a tensor.
    return tf.tidy(function() {
      var image = tf.fromPixels(document.getElementById('eyes'));
      var batchedImage = image.expandDims(0);
      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  }

  function addExample(image, target) {
    // Given an image and target coordinates, adds them to our dataset.
    target[0] = target[0] - 0.5;
    target[1] = target[1] - 0.5;
    target = tf.tidy(function() { return tf.tensor1d(target).expandDims(0); });
    if (x == null) {
      x = tf.keep(image);
      y = tf.keep(target);
    } else {
      var oldX = x;
      x = tf.keep(oldX.concat(image, 0));

      var oldY = y;
      y = tf.keep(oldY.concat(target, 0));

      oldX.dispose();
      oldY.dispose();
      target.dispose();
    }

    n = n + 1;
    addExampleCallback(n);
  }

  function captureExample() {
    // Take the latest image from the eyes canvas and add it to our dataset.
    // Takes the coordinates of the ball.
    tf.tidy(function() {
      var img = getImage();
      var ballPos = getFollowBallPos();
      addExample(img, ballPos);
    });
  }


  /*********** Code for training a model *********/

  var currentModel = null;
  var epochsTrained = 0;

  function createModel() {
    var model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [inputHeight, inputWidth, 3],
          kernelSize: 5,
          filters: 16,
          strides: 1,
          activation: 'relu',
          kernelInitializer: 'varianceScaling',
        }),
        tf.layers.maxPooling2d({
          poolSize: [4, 4],
          strides: [4, 4],
        }),
        tf.layers.flatten(),
        tf.layers.dropout({
          rate: 0.3,
        }),
        tf.layers.dense({
          units: 2,
          activation: 'tanh',
          kernelInitializer: 'varianceScaling',
        }),
      ]
    });

    optimizer = tf.train.adam(0.004);

    model.compile({optimizer: optimizer, loss: 'meanSquaredError'});

    return model;
  }

  function fitModel(model) {
    var n = x.shape[0];

    // TODO Set params in UI?
    var epochs = 4 + Math.floor(n * 0.2);

    var batchSize = Math.floor(n * 0.1);
    if (batchSize < 4) {
      batchSize = 4;
    } else if (batchSize > 32) {
      batchSize = 32;
    }

    // TODO Change UI to signify "training in progress".
    $('#start-training').prop('disabled', true);
    $('#start-training').html('In Progress...');
    console.info('Training on', n, 'samples');

    state = 'training';

    model.fit(x, y, {
      batchSize: batchSize,
      epochs: epochs,
      shuffle: true,
      validationSplit: .1,
      callbacks: {
        onEpochEnd: function(epoch, logs) {
          console.info('Epoch', epoch, 'losses:', logs);
          epochsTrained += 1;
          setContent('n-epochs', epochsTrained);
          setContent('train-loss', logs.loss.toFixed(5));
          setContent('val-loss', logs.val_loss.toFixed(5));

          // Confusing code to make the UI update asyncronously:
          return __awaiter(this, void 0, void 0, function* () {
            yield tf.nextFrame();
          });
        },
        onTrainEnd: function() {
          console.info('Finished training:', model);
          $('#start-training').prop('disabled', false);
          $('#start-training').html('Start Training');
          trainingFinishedCallback();
        },
      }
    });
  }

  function moveModelBall() {
    if (currentModel == null) {
      return;
    }
    tf.tidy(function() {
      var img = getImage();
      var prediction = currentModel.predict(img);
      moveBall(prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5, 'modelBall');
    });
  }

  setInterval(moveModelBall, 100);
  moveBall(0.5, 0.5, 'modelBall');



  /*********** Code for UI / control *********/

  $('body').keyup(function(e) {
    // On space key:
    if (e.keyCode == 32 && (state == 'collecting' || state == 'trained')) {
      captureExample();
      setTimeout(moveFollowBallRandomly, 100);

      e.preventDefault();
      return false;
    }
  });

  $('#start-training').click(function(e) {
    if (currentModel == null) {
      currentModel = createModel();
    }
    fitModel(currentModel);
  });
});
