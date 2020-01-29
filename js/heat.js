window.heatmap = {
  getHeatColor: function(value, alpha) {
    // Adapted from https://stackoverflow.com/a/17268489/1257278
    if (typeof alpha == 'undefined') {
      alpha = 1.0;
    }
    const hue = ((1 - value) * 120).toString(10);
    return 'hsla(' + hue + ',100%,50%,' + alpha + ')';
  },

  fillHeatmap: function(data, model, ctx, width, height, radius) {
    // Go through a dataset and fill the context with the corresponding circles.
    const predictions = model.predict(data.x).arraySync();

    let trueX, trueY, predX, predY, errorX, errorY, error, pointX, pointY;

    for (let i = 0; i < data.n; i++) {
      const dataY = data.y.arraySync();

      trueX = dataY[i][0];
      trueY = dataY[i][1];
      predX = predictions[i][0];
      predY = predictions[i][1];
      errorX = Math.pow(predX - trueX, 2);
      errorY = Math.pow(predY - trueY, 2);
      error = Math.min(Math.sqrt(Math.sqrt(errorX + errorY)), 1);

      pointX = Math.floor((trueX + 0.5) * width);
      pointY = Math.floor((trueY + 0.5) * height);

      ctx.beginPath();
      ctx.fillStyle = this.getHeatColor(error, 0.5);
      ctx.arc(pointX, pointY, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  },

  drawHeatmap: function(dataset, model) {
    $('#draw-heatmap').prop('disabled', true);
    $('#draw-heatmap').html('In Progress...');

    const heatmap = $('#heatMap')[0];
    const ctx = heatmap.getContext('2d');

    const width = $('body').width();
    const height = $('body').height();

    heatmap.width = width;
    heatmap.height = height;
    ctx.clearRect(0, 0, width, height);

    this.fillHeatmap(dataset.val, model, ctx, width, height, 30);
    this.fillHeatmap(dataset.train, model, ctx, width, height, 15);

    $('#clear-heatmap').prop('disabled', false);
    $('#draw-heatmap').prop('disabled', false);
    $('#draw-heatmap').html('Draw Heatmap');
  },

  clearHeatmap: function() {
    $('#clear-heatmap').prop('disabled', true);

    const heatmap = $('#heatMap')[0];
    const ctx = heatmap.getContext('2d');

    ctx.clearRect(0, 0, heatmap.width, heatmap.height);
    $('#clear-heatmap').prop('disabled', false);
  },
};
