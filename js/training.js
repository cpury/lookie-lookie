window.training = {
  currentModel: null,
  inTraining: false,
  epochsTrained: 0,

  createModel: function() {
    var inputImage = tf.input({
      name: 'image',
      shape: [dataset.inputHeight, dataset.inputWidth, 3],
    });
    var inputMeta = tf.input({
      name: 'metaInfos',
      shape: [4],
    });

    var conv = tf.layers.conv2d({
      kernelSize: 5,
      filters: 20,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling',
    }).apply(inputImage);

    var maxpool = tf.layers.maxPooling2d({
      poolSize: [2, 2],
      strides: [2, 2],
    }).apply(conv);

    var flat = tf.layers.flatten().apply(maxpool);

    var dropout = tf.layers.dropout(0.2).apply(flat);

    var concat = tf.layers.concatenate().apply([dropout, inputMeta]);

    var output = tf.layers.dense({
      units: 2,
      activation: 'tanh',
      kernelInitializer: 'varianceScaling',
    }).apply(concat);

    var model = tf.model({inputs: [inputImage, inputMeta], outputs: output});

    return model;
  },

  fitModel: function() {
    // TODO Set params in UI?
    this.inTraining = true;
    var epochs = 4 + Math.floor(dataset.train.n * 0.2);

    if (training.epochsTrained == 0) {
      epochs *= 2;
    }
    epochs = Math.min(100, epochs);

    var batchSize = Math.floor(dataset.train.n * 0.1);
    if (batchSize < 4) {
      batchSize = 4;
    } else if (batchSize > 64) {
      batchSize = 64;
    }

    $('#start-training').prop('disabled', true);
    $('#start-training').html('In Progress...');

    if (training.currentModel == null) {
      training.currentModel = training.createModel();
    }

    console.info('Training on', dataset.train.n, 'samples');

    ui.state = 'training';

    var bestEpoch = -1;
    var bestTrainLoss = Number.MAX_SAFE_INTEGER;
    var bestValLoss = Number.MAX_SAFE_INTEGER;
    var bestModelPath = 'localstorage://best-model';

    training.currentModel.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'meanSquaredError',
    });

    training.currentModel.fit(dataset.train.x, dataset.train.y, {
      batchSize: batchSize,
      epochs: epochs,
      shuffle: true,
      validationData: [dataset.val.x, dataset.val.y],
      callbacks: {
        onEpochEnd: async function(epoch, logs) {
          console.info('Epoch', epoch, 'losses:', logs);
          training.epochsTrained += 1;
          ui.setContent('n-epochs', training.epochsTrained);
          ui.setContent('train-loss', logs.loss.toFixed(5));
          ui.setContent('val-loss', logs.val_loss.toFixed(5));

          if (logs.val_loss < bestValLoss) {
            // Save model
            bestEpoch = epoch;
            bestTrainLoss = logs.loss;
            bestValLoss = logs.val_loss;

            // Store best model:
            await training.currentModel.save(bestModelPath);
          }

          return await tf.nextFrame();
        },
        onTrainEnd: async function() {
          console.info('Finished training');

          // Load best model:
          training.epochsTrained -= epochs - bestEpoch;
          console.info('Loading best epoch:', training.epochsTrained);
          ui.setContent('n-epochs', training.epochsTrained);
          ui.setContent('train-loss', bestTrainLoss.toFixed(5));
          ui.setContent('val-loss', bestValLoss.toFixed(5));

          training.currentModel = await tf.loadModel(bestModelPath);

          $('#start-training').prop('disabled', false);
          $('#start-training').html('Start Training');
          training.inTraining = false;
          ui.onFinishTraining();
        },
      }
    });
  },

  resetModel: function() {
    $('#reset-model').prop('disabled', true);
    training.currentModel = null;
    training.epochsTrained = 0;
    ui.setContent('n-epochs', training.epochsTrained);
    ui.setContent('train-loss', '?');
    ui.setContent('val-loss', '?');
    $('#reset-model').prop('disabled', false);
  },

  getPrediction: function() {
    // Return relative x, y where we expect the user to look right now.
    return tf.tidy(function() {
      var img = dataset.getImage();
      img = dataset.convertImage(img);
      var metaInfos = dataset.getMetaInfos();
      var prediction = training.currentModel.predict([img, metaInfos]);

      return [prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5];
    });
  }
};
