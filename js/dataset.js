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
      const image = tf.browser.fromPixels(document.getElementById('eyes'));
      const batchedImage = image.expandDims(0);
      return batchedImage
        .toFloat()
        .div(tf.scalar(127))
        .sub(tf.scalar(1));
    });
  },

  getMetaInfos: function(mirror) {
    // Get some meta info about the rectangle as a tensor:
    // - middle x, y of the eye rectangle, relative to video size
    // - size of eye rectangle, relative to video size
    // - angle of rectangle (TODO)
    let x = facetracker.currentEyeRect[0] + facetracker.currentEyeRect[2] / 2;
    let y = facetracker.currentEyeRect[1] + facetracker.currentEyeRect[3] / 2;

    x = (x / facetracker.videoWidthExternal) * 2 - 1;
    y = (y / facetracker.videoHeightExternal) * 2 - 1;

    const rectWidth =
      facetracker.currentEyeRect[2] / facetracker.videoWidthExternal;
    const rectHeight =
      facetracker.currentEyeRect[3] / facetracker.videoHeightExternal;

    if (mirror) {
      x = 1 - x;
      y = 1 - y;
    }
    return tf.tidy(function() {
      return tf.tensor1d([x, y, rectWidth, rectHeight]).expandDims(0);
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

  async rgbToGrayscale(image, n, x, y) {
    // Given an rgb tensor, returns a grayscale value.
    // Inspired by http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0029740
    const imageArray = await image.array();
    let r = (imageArray[n][x][y][0] + 1) / 2;
    let g = (imageArray[n][x][y][1] + 1) / 2;
    let b = (imageArray[n][x][y][2] + 1) / 2;

    // Gamma correction:
    const exponent = 1 / 2.2;
    r = Math.pow(r, exponent);
    g = Math.pow(g, exponent);
    b = Math.pow(b, exponent);

    // Gleam:
    const gleam = (r + g + b) / 3;
    return gleam * 2 - 1;
  },

  convertImage: async function(image) {
    // Convert to grayscale and add spatial info
    const imageShape = image.shape;
    const w = imageShape[1];
    const h = imageShape[2];

    const data = [new Array(w)];
    const promises = [];
    for (let x = 0; x < w; x++) {
      data[0][x] = new Array(h);

      for (let y = 0; y < h; y++) {
        promises.push(
          dataset.rgbToGrayscale(image, 0, x, y).then(imageData => {
            data[0][x][y] = [imageData, (x / w) * 2 - 1, (y / h) * 2 - 1];
          }),
        );
      }
    }

    await Promise.all(promises);

    return tf.tensor(data);
  },

  addToDataset: function(image, metaInfos, target, key) {
    // Add the given x, y to either 'train' or 'val'.
    const set = dataset[key];

    if (set.x == null) {
      set.x = [tf.keep(image), tf.keep(metaInfos)];
      set.y = tf.keep(target);
    } else {
      const oldImage = set.x[0];
      set.x[0] = tf.keep(oldImage.concat(image, 0));

      const oldEyePos = set.x[1];
      set.x[1] = tf.keep(oldEyePos.concat(metaInfos, 0));

      const oldY = set.y;
      set.y = tf.keep(oldY.concat(target, 0));

      tf.dispose([oldImage, oldEyePos, oldY, target]);
    }

    set.n += 1;
  },

  addExample: async function(image, metaInfos, target, dontDispose) {
    // Given an image, eye pos and target coordinates, adds them to our dataset.
    target[0] = target[0] - 0.5;
    target[1] = target[1] - 0.5;
    target = tf.keep(
      tf.tidy(function() {
        return tf.tensor1d(target).expandDims(0);
      }),
    );
    const key = dataset.whichDataset();

    const convertedImage = await dataset.convertImage(image);

    dataset.addToDataset(convertedImage, metaInfos, target, key);

    ui.onAddExample(dataset.train.n, dataset.val.n);

    if (!dontDispose) {
      tf.dispose(image, metaInfos);
    }
  },

  captureExample: function() {
    // Take the latest image from the eyes canvas and add it to our dataset.
    // Takes the coordinates of the mouse.
    tf.tidy(function() {
      const img = dataset.getImage();
      const mousePos = mouse.getMousePos();
      const metaInfos = tf.keep(dataset.getMetaInfos());
      dataset.addExample(img, metaInfos, mousePos);
    });
  },

  toJSON: function() {
    const tensorToArray = function(t) {
      const typedArray = t.dataSync();
      return Array.prototype.slice.call(typedArray);
    };

    return {
      inputWidth: dataset.inputWidth,
      inputHeight: dataset.inputHeight,
      train: {
        shapes: {
          x0: dataset.train.x[0].shape,
          x1: dataset.train.x[1].shape,
          y: dataset.train.y.shape,
        },
        n: dataset.train.n,
        x: dataset.train.x && [
          tensorToArray(dataset.train.x[0]),
          tensorToArray(dataset.train.x[1]),
        ],
        y: tensorToArray(dataset.train.y),
      },
      val: {
        shapes: {
          x0: dataset.val.x[0].shape,
          x1: dataset.val.x[1].shape,
          y: dataset.val.y.shape,
        },
        n: dataset.val.n,
        x: dataset.val.x && [
          tensorToArray(dataset.val.x[0]),
          tensorToArray(dataset.val.x[1]),
        ],
        y: tensorToArray(dataset.val.y),
      },
    };
  },

  fromJSON: function(data) {
    dataset.inputWidth = data.inputWidth;
    dataset.inputHeight = data.inputHeight;
    dataset.train.n = data.train.n;
    dataset.train.x = data.train.x && [
      tf.tensor(data.train.x[0], data.train.shapes.x0),
      tf.tensor(data.train.x[1], data.train.shapes.x1),
    ];
    dataset.train.y = tf.tensor(data.train.y, data.train.shapes.y);
    dataset.val.n = data.val.n;
    dataset.val.x = data.val.x && [
      tf.tensor(data.val.x[0], data.val.shapes.x0),
      tf.tensor(data.val.x[1], data.val.shapes.x1),
    ];
    dataset.val.y = tf.tensor(data.val.y, data.val.shapes.y);

    ui.onAddExample(dataset.train.n, dataset.val.n);
  },
};
