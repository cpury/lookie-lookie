window.training = {
  currentModel: null,
  inTraining: false,
  epochsTrained: 0,

  createModel: function() {
    const inputImage = tf.input({
      name: 'image',
      shape: [dataset.inputHeight, dataset.inputWidth, 3],
    });
    const inputMeta = tf.input({
      name: 'metaInfos',
      shape: [4],
    });

    const conv = tf.layers
      .conv2d({
        kernelSize: 5,
        filters: 20,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
      .apply(inputImage);

    const maxpool = tf.layers
      .maxPooling2d({
        poolSize: [2, 2],
        strides: [2, 2],
      })
      .apply(conv);

    const flat = tf.layers.flatten().apply(maxpool);

    const dropout = tf.layers.dropout(0.2).apply(flat);

    const concat = tf.layers.concatenate().apply([dropout, inputMeta]);

    const output = tf.layers
      .dense({
        units: 2,
        activation: 'tanh',
        kernelInitializer: 'varianceScaling',
      })
      .apply(concat);

    const model = tf.model({
      inputs: [inputImage, inputMeta],
      outputs: output,
    });

    return model;
  },

  fitModel: function() {
    // TODO Set params in UI?
    this.inTraining = true;
    const epochs = 10;

    let batchSize = Math.floor(dataset.train.n * 0.1);
    batchSize = Math.max(2, Math.min(batchSize, 64));

    $('#start-training').prop('disabled', true);
    $('#start-training').html('In Progress...');

    if (training.currentModel == null) {
      training.currentModel = training.createModel();
    }

    console.info('Training on', dataset.train.n, 'samples');

    ui.state = 'training';

    let bestEpoch = -1;
    let bestTrainLoss = Number.MAX_SAFE_INTEGER;
    let bestValLoss = Number.MAX_SAFE_INTEGER;
    const bestModelPath = 'localstorage://best-model';

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
      },
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
      let img = dataset.getImage();
      img = dataset.convertImage(img);
      const metaInfos = dataset.getMetaInfos();
      const prediction = training.currentModel.predict([img, metaInfos]);

      return [prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5];
    });
  },

  drawSingleFilter: function(weights, filterId, canvas) {
    const canvasCtx = canvas.getContext('2d');
    const kernelSize = weights.shape[0];
    const pixelSize = canvas.width / kernelSize;

    let x, y;
    let min = 10000;
    let max = -10000;
    let value;

    // First, find min and max:
    for (x = 0; x < kernelSize; x++) {
      for (y = 0; y < kernelSize; y++) {
        value = weights.get(x, y, 0, filterId);
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    for (x = 0; x < kernelSize; x++) {
      for (y = 0; y < kernelSize; y++) {
        value = weights.get(x, y, 0, filterId);
        value = ((value - min) / (max - min)) * 255;

        canvasCtx.fillStyle = 'rgb(' + value + ',' + value + ',' + value + ')';
        canvasCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  },

  visualizePixels: function(canvas) {
    const model = training.currentModel;
    const convLayer = model.layers[1];
    const weights = convLayer.weights[0].read();
    const bias = convLayer.weights[1].read();
    const filterId = 1;

    training.drawSingleFilter(weights, filterId, canvas);
  },
};
