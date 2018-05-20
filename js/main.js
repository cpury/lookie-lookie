$(document).ready(function() {
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
    // Get middle x, y of the eye rectangle, relative to video size, as a tensor.
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

    ui.onAddExample(dataset.train.n, dataset.val.n);
  }

  function captureExample() {
    // Take the latest image from the eyes canvas and add it to our dataset.
    // Takes the coordinates of the ball.
    tf.tidy(function() {
      var img = getImage();
      var ballPos = ball.getFollowBallPos();
      var eyePos = getEyePos();
      addExample(img, eyePos, ballPos);
    });
    // Add flipped image as well:
    tf.tidy(function() {
      var img = getImage().reverse(1);
      var ballPos = ball.getFollowBallPos();
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

    var dropout_input = tf.layers.dropout({
      rate: 0.1,
    }).apply(input_image);
    var conv = tf.layers.conv2d({
      kernelSize: 5,
      filters: 12,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    }).apply(dropout_input);
    var maxpool = tf.layers.maxPooling2d({
      poolSize: [2, 2],
      strides: [2, 2],
    }).apply(conv);
    var flat = tf.layers.flatten().apply(maxpool);
    var dropout_conv = tf.layers.dropout({
      rate: 0.1,
    }).apply(flat);

    var concat = tf.layers.concatenate().apply([dropout_conv, input_pos]);

    var output = tf.layers.dense({
      units: 2,
      activation: 'tanh',
      kernelInitializer: 'varianceScaling',
    }).apply(concat);

    var model = tf.model({inputs: [input_image, input_pos], outputs: output});

    optimizer = tf.train.adam(0.001);

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

    ui.state = 'training';

    currentModel.fit(dataset.train.x, dataset.train.y, {
      batchSize: batchSize,
      epochs: epochs,
      shuffle: true,
      validationData: [dataset.val.x, dataset.val.y],
      callbacks: {
        onEpochEnd: function(epoch, logs) {
          console.info('Epoch', epoch, 'losses:', logs);
          epochsTrained += 1;
          ui.setContent('n-epochs', epochsTrained);
          ui.setContent('train-loss', logs.loss.toFixed(5));
          ui.setContent('val-loss', logs.val_loss.toFixed(5));

          // Confusing code to make the UI update asyncronously:
          return awaiter(this, void 0, void 0, function* () {
            yield tf.nextFrame();
          });
        },
        onTrainEnd: function() {
          console.info('Finished training:', currentModel);
          $('#start-training').prop('disabled', false);
          $('#start-training').html('Start Training');
          ui.onFinishTraining();
        },
      }
    });
  }

  function resetModel() {
    $('#reset-model').prop('disabled', true);
    currentModel = null;
    epochsTrained = 0;
    ui.setContent('n-epochs', epochsTrained);
    ui.setContent('train-loss', '?');
    ui.setContent('val-loss', '?');
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
      ball.moveBall(prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5, 'modelBall');
    });
  }

  setInterval(moveModelBall, 100);
  ball.moveBall(0.5, 0.5, 'modelBall');



  /*********** Code for UI / control *********/

  $('body').keyup(function(e) {
    // On space key:
    if (e.keyCode == 32 && (ui.state == 'collecting' || ui.state == 'trained')) {
      captureExample();
      setTimeout(ball.moveFollowBallRandomly, 100);

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
    heatmap.drawHeatmap(dataset);
  });

  $('#clear-heatmap').click(function(e) {
    heatmap.clearHeatmap();
  });
});
