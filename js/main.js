$(document).ready(function() {
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
      var img = dataset.getImage();
      var eyePos = dataset.getEyePos();
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
      dataset.captureExample();
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
    heatmap.drawHeatmap(dataset, currentModel);
  });

  $('#clear-heatmap').click(function(e) {
    heatmap.clearHeatmap();
  });
});
