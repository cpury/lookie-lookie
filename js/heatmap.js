window.heatmap = {
  getHeatColor: function(value, alpha) {
    // Adapted from https://stackoverflow.com/a/17268489/1257278
    if (typeof alpha == 'undefined') {
      alpha = 1.0;
    }
    var hue = ((1 - value) * 120).toString(10);
    return 'hsla(' + hue + ',100%,50%,' + alpha + ')';
  },

  fillHeatmap: function(data, ctx, width, height, radius) {
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
      ctx.fillStyle = this.getHeatColor(error, 0.5);
      ctx.arc(pointX, pointY, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  },

  drawHeatmap: function(dataset) {
    $('#draw-heatmap').prop('disabled', true);
    $('#draw-heatmap').html('In Progress...');

    var heatmap = $('#heatMap')[0];
    var ctx = heatmap.getContext('2d');

    var width = $('body').width();
    var height = $('body').height();

    heatmap.width = width;
    heatmap.height = height;
    ctx.clearRect(0, 0, width, height);

    this.fillHeatmap(dataset.val, ctx, width, height, 30);
    this.fillHeatmap(dataset.train, ctx, width, height, 15);

    $('#clear-heatmap').prop('disabled', false);
    $('#draw-heatmap').prop('disabled', false);
    $('#draw-heatmap').html('Draw Heatmap');
  },

  clearHeatmap: function() {
    $('#clear-heatmap').prop('disabled', true);

    var heatmap = $('#heatMap')[0];
    var ctx = heatmap.getContext('2d');

    var width = $('body').width();
    var height = $('body').height();

    ctx.clearRect(0, 0, heatmap.width, heatmap.height);
    $('#clear-heatmap').prop('disabled', false);
  }
};
