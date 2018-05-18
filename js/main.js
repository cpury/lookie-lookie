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

  function addExampleCallback() {
    // Call this when an example is added.
    setContent('n-train', dataset.train.n);
    setContent('n-val', dataset.val.n);
    if (dataset.train.n == 2) {
      $('#start-training').prop('disabled', false);
    }
    if (state == 'collecting' && dataset.train.n + dataset.val.n == 14) {
      setContent('info',
        'Great job! Now that you have a handful of examples, let\'s train the neural network!<br>'
        + 'Click the "Start Training" button on the right to start.'
      );
    }
  }

  function trainingFinishedCallback() {
    // Call this when training is finished.
    $('#modelBall').css('opacity', '0.9');
    $('#draw-heatmap').prop('disabled', false);
    $('#reset-model').prop('disabled', false);
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
    state = 'finding face';
    setContent('info', 'Thanks! Now let\'s find your face!');
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
  var currentEyeRect = null;

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
      if (state == 'finding face') {
        state = 'collecting';
        setContent('info', 'Alright, follow the red ball with your eyes and hit the space key whenever you are focused on it.');
      }
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
    currentEyeRect = rect;

    var $video = $('#video');
    var tempCanvas = document.getElementById('temp');
    var tempCtx = tempCanvas.getContext('2d');
    var eyesCanvas = document.getElementById('eyes');
    var eyesCtx = eyesCanvas.getContext('2d');

    tempCtx.drawImage(video, 0, 0, video.width, video.height);

    tempCtx.strokeStyle = 'green';
    tempCtx.strokeRect(rect[0], rect[1], rect[2], rect[3]);

    eyesCtx.drawImage(tempCanvas, rect[0], rect[1], rect[2], rect[3], 0, 0, eyesCanvas.width, eyesCanvas.height);
  }


  /*********** Code for the ball position *********/

  var ballSize = $('#followBall').outerWidth();

	function moveFollowBallRandomly() {
    // Move the ball to a random position.
    var x = 0.02 + Math.random() * 0.96;
    var y = 0.02 + Math.random() * 0.96;

    moveBall(x, y, 'followBall');
	}

  function moveBall(x, y, id) {
    // Given relative coordinates, moves the ball there.
    var left = x * ($('body').width() - ballSize);
    var top = y * ($('body').height() - ballSize);

    var $ball = $('#' + id);
    $ball.css('left', left + 'px');
    $ball.css('top', top + 'px');
  }

  function getFollowBallPos() {
    // Get the normalized ball position.
    var $ball = $('#followBall');
    var left = $ball.css('left');
    var top = $ball.css('top');
    var x = Number(left.substr(0, left.length - 2));
    var y = Number(top.substr(0, top.length - 2));

    return [x / ($('body').width() - ballSize), y / ($('body').height() - ballSize)];
  }

  moveBall(0.5, 0.25, 'followBall');


  /*********** Code for collecting a dataset *********/

  // The dataset:
  var dataset = {
    inputWidth: $('#eyes').width(),
    inputHeight: $('#eyes').height(),
    train: {
      n: 0,
      x: null,
      y: null,
    },
    val: {
      n: 0,
      x: null,
      y: null,
    }
  };

  function getImage() {
    // Capture the current image in the eyes canvas as a tensor.
    return tf.tidy(function() {
      var image = tf.fromPixels(document.getElementById('eyes'));
      var batchedImage = image.expandDims(0);
      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  }

  function getEyePos(mirror) {
    // Get middel x, y of the eye rectangle, relative to video size, as a tensor.
    var x = (currentEyeRect[0] + currentEyeRect[2]) / 2;
    var y = (currentEyeRect[1] + currentEyeRect[3] / 2);
    var maxX = $('#temp').width();
    var maxY = $('#temp').height();

    x = (x / maxX) * 2 - 1;
    y = (y / maxY) * 2 - 1;

    if (mirror) {
      x = 1 - x;
      y = 1 - y;
    }
    return tf.tidy(function() { return tf.tensor1d([x, y]).expandDims(0); });
  }

  function whichDataset() {
    // Returns 'train' or 'val' depending on what makes sense / is random.
    if (dataset.train.n == 0) {
      return 'train';
    }
    if (dataset.val.n == 0) {
      return 'val';
    }
    return Math.random() < 0.2 ? 'val' : 'train';
  }

  function addToDataset(image, eyePos, target, key) {
    // Add the given x, y to either 'train' or 'val'.
    var set = dataset[key];

    if (set.x == null) {
      set.x = [
        tf.keep(image),
        tf.keep(eyePos),
      ];
      set.y = tf.keep(target);
    } else {
      var oldImage = set.x[0];
      set.x[0] = tf.keep(oldImage.concat(image, 0));

      var oldEyePos = set.x[1];
      set.x[1] = tf.keep(oldEyePos.concat(eyePos, 0));

      var oldY = set.y;
      set.y = tf.keep(oldY.concat(target, 0));

      oldImage.dispose();
      oldEyePos.dispose();
      oldY.dispose();
      target.dispose();
    }

    set.n += 1;
  }

  function addExample(image, eyePos, target) {
    // Given an image, eye pos and target coordinates, adds them to our dataset.
    target[0] = target[0] - 0.5;
    target[1] = target[1] - 0.5;
    target = tf.tidy(function() { return tf.tensor1d(target).expandDims(0); });
    var key = whichDataset();

    addToDataset(image, eyePos, target, key);

    addExampleCallback();
  }

  function captureExample() {
    // Take the latest image from the eyes canvas and add it to our dataset.
    // Takes the coordinates of the ball.
    tf.tidy(function() {
      var img = getImage();
      var ballPos = getFollowBallPos();
      var eyePos = getEyePos();
      addExample(img, eyePos, ballPos);
    });
    // Add flipped image as well:
    tf.tidy(function() {
      var img = getImage().reverse(1);
      var ballPos = getFollowBallPos();
      var eyePos = getEyePos(true);
      ballPos[0] = 1 - ballPos[0];
      addExample(img, eyePos, ballPos);
    });
  }


  /*********** Code for training a model *********/

  var currentModel = null;
  var epochsTrained = 0;

  function createModel() {
    var input_image = tf.input({
      name: 'image',
      shape: [dataset.inputHeight, dataset.inputWidth, 3],
    });
    var input_pos = tf.input({
      name: 'eyePos',
      shape: [2],
    });

    var conv = tf.layers.conv2d({
      kernelSize: 5,
      filters: 12,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    }).apply(input_image);
    var flat = tf.layers.flatten().apply(conv);
    var dropout = tf.layers.dropout({
      rate: 0.5,
    }).apply(flat);

    var concat = tf.layers.concatenate().apply([dropout, input_pos]);
    var output = tf.layers.dense({
      units: 2,
      activation: 'tanh',
      kernelInitializer: 'varianceScaling',
    }).apply(concat);

    var model = tf.model({inputs: [input_image, input_pos], outputs: output});

    optimizer = tf.train.adam(0.005);

    model.compile({
      optimizer: optimizer,
      loss: 'meanSquaredError',
    });

    return model;
  }

  function fitModel() {
    // TODO Set params in UI?
    var epochs = 4 + Math.floor(dataset.train.n * 0.2);

    if (epochsTrained == 0) {
      epochs *= 2;
    }

    var batchSize = Math.floor(dataset.train.n * 0.1);
    if (batchSize < 4) {
      batchSize = 4;
    } else if (batchSize > 64) {
      batchSize = 64;
    }

    $('#start-training').prop('disabled', true);
    $('#start-training').html('In Progress...');

    if (currentModel == null) {
      currentModel = createModel();
    }

    console.info('Training on', dataset.train.n, 'samples');

    state = 'training';

    currentModel.fit(dataset.train.x, dataset.train.y, {
      batchSize: batchSize,
      epochs: epochs,
      shuffle: true,
      validationData: [dataset.val.x, dataset.val.y],
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
          console.info('Finished training:', currentModel);
          $('#start-training').prop('disabled', false);
          $('#start-training').html('Start Training');
          trainingFinishedCallback();
        },
      }
    });
  }

  function resetModel() {
    $('#reset-model').prop('disabled', true);
    currentModel = null;
    epochsTrained = 0;
    setContent('n-epochs', epochsTrained);
    setContent('train-loss', '?');
    setContent('val-loss', '?');
    $('#reset-model').prop('disabled', false);
  }

  function moveModelBall() {
    if (currentModel == null) {
      return;
    }
    tf.tidy(function() {
      var img = getImage();
      var eyePos = getEyePos();
      var prediction = currentModel.predict([img, eyePos]);
      moveBall(prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5, 'modelBall');
    });
  }

  setInterval(moveModelBall, 100);
  moveBall(0.5, 0.5, 'modelBall');


  /*********** Code for drawing heatmaps *********/

  function getHeatColor(value, alpha) {
    // Adapted from https://stackoverflow.com/a/17268489/1257278
    if (typeof alpha == 'undefined') {
      alpha = 1.0;
    }
    var hue = ((1 - value) * 120).toString(10);
    return 'hsla(' + hue + ',100%,50%,' + alpha + ')';
  };

  function fillHeatmap(data, ctx, width, height, radius) {
    // Go through a dataset and fill the context with the corresponding circles.
    var predictions = currentModel.predict(data.x);

    for (var i = 0; i < data.n; i++) {
      var input = data.x[i];
      var trueX = data.y.get(i, 0);
      var trueY = data.y.get(i, 1);
      var predX = predictions.get(i, 0);
      var predY = predictions.get(i, 1);
      var errorX = Math.pow(predX - trueX, 2);
      var errorY = Math.pow(predY - trueY, 2);
      var error = Math.min(Math.sqrt(Math.sqrt(errorX + errorY)), 1);

      var pointX = Math.floor((trueX + 0.5) * width);
      var pointY = Math.floor((trueY + 0.5) * height);

      ctx.beginPath();
      ctx.fillStyle = getHeatColor(error, 0.5);
      ctx.arc(pointX, pointY, radius, 0, 2 * Math.PI);
      ctx.fill()
    }
  }

  function drawHeatmap() {
    $('#draw-heatmap').prop('disabled', true);
    $('#draw-heatmap').html('In Progress...');

    var heatmap = $('#heatMap')[0];
    var ctx = heatmap.getContext('2d');

    var width = $('body').width();
    var height = $('body').height();

    heatmap.width = width;
    heatmap.height = height;
    ctx.clearRect(0, 0, width, height);

    fillHeatmap(dataset.val, ctx, width, height, 30);
    fillHeatmap(dataset.train, ctx, width, height, 15);

    $('#clear-heatmap').prop('disabled', false);
    $('#draw-heatmap').prop('disabled', false);
    $('#draw-heatmap').html('Draw Heatmap');
  }

  function clearHeatmap() {
    $('#clear-heatmap').prop('disabled', true);

    var heatmap = $('#heatMap')[0];
    var ctx = heatmap.getContext('2d');

    var width = $('body').width();
    var height = $('body').height();

    ctx.clearRect(0, 0, heatmap.width, heatmap.height);
    $('#clear-heatmap').prop('disabled', false);
  }



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
    fitModel();
  });

  $('#reset-model').click(function(e) {
    resetModel();
  });

  $('#draw-heatmap').click(function(e) {
    drawHeatmap();
  });

  $('#clear-heatmap').click(function(e) {
    clearHeatmap();
  });
});
