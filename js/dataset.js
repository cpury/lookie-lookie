window.dataset = {
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
  },

  getImage: function() {
    // Capture the current image in the eyes canvas as a tensor.
    return tf.tidy(function() {
      var image = tf.fromPixels(document.getElementById('eyes'));
      var batchedImage = image.expandDims(0);
      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });
  },

  getMetaInfos: function(mirror) {
    // Get some meta info about the rectangle as a tensor:
    // - middle x, y of the eye rectangle, relative to video size
    // - size of eye rectangle, relative to video size
    // - angle of rectangle (TODO)
    var x = facetracker.currentEyeRect[0] + (facetracker.currentEyeRect[2] / 2);
    var y = facetracker.currentEyeRect[1] + (facetracker.currentEyeRect[3] / 2);
    var canvasWidth = $('#temp').width();
    var canvasHeight = $('#temp').height();

    x = (x / canvasWidth) * 2 - 1;
    y = (y / canvasHeight) * 2 - 1;

    var rectWidth = facetracker.currentEyeRect[2] / canvasWidth;
    var rectHeight = facetracker.currentEyeRect[3] / canvasHeight;

    if (mirror) {
      x = 1 - x;
      y = 1 - y;
    }
    return tf.tidy(function() {
      return tf.tensor1d([
        x, y, rectWidth, rectHeight,
      ]).expandDims(0);
    });
  },

  whichDataset: function() {
    // Returns 'train' or 'val' depending on what makes sense / is random.
    if (dataset.train.n == 0) {
      return 'train';
    }
    if (dataset.val.n == 0) {
      return 'val';
    }
    return Math.random() < 0.2 ? 'val' : 'train';
  },

  addToDataset: function(image, metaInfos, target, key) {
    // Add the given x, y to either 'train' or 'val'.
    var set = dataset[key];

    if (set.x == null) {
      set.x = [
        tf.keep(image),
        tf.keep(metaInfos),
      ];
      set.y = tf.keep(target);
    } else {
      var oldImage = set.x[0];
      set.x[0] = tf.keep(oldImage.concat(image, 0));

      var oldEyePos = set.x[1];
      set.x[1] = tf.keep(oldEyePos.concat(metaInfos, 0));

      var oldY = set.y;
      set.y = tf.keep(oldY.concat(target, 0));

      oldImage.dispose();
      oldEyePos.dispose();
      oldY.dispose();
      target.dispose();
    }

    set.n += 1;
  },

  addExample: function(image, metaInfos, target) {
    // Given an image, eye pos and target coordinates, adds them to our dataset.
    target[0] = target[0] - 0.5;
    target[1] = target[1] - 0.5;
    target = tf.tidy(function() { return tf.tensor1d(target).expandDims(0); });
    var key = dataset.whichDataset();

    dataset.addToDataset(image, metaInfos, target, key);

    ui.onAddExample(dataset.train.n, dataset.val.n);
  },

  captureExample: function() {
    // Take the latest image from the eyes canvas and add it to our dataset.
    // Takes the coordinates of the mouse.
    tf.tidy(function() {
      var img = dataset.getImage();
      var mousePos = mouse.getMousePos();
      var metaInfos = dataset.getMetaInfos();
      dataset.addExample(img, metaInfos, mousePos);
    });
  },
};
