$(document).ready(function() {
  var $ball = $('#modelBall');
  var ballSize = $ball.outerWidth();

  function moveModelBall() {
    // Move the model ball to where we predict the user is looking to
    if (training.currentModel == null || training.inTraining) {
      return;
    }

    var prediction = training.getPrediction();
    var left = prediction[0] * ($('body').width() - ballSize);
    var top = prediction[1] * ($('body').height() - ballSize);

    $ball.css('left', left + 'px');
    $ball.css('top', top + 'px');
  }

  setInterval(moveModelBall, 100);


  // Map functions to keys and buttons:

  $('body').keyup(function(e) {
    // On space key:
    if (e.keyCode == 32 && ui.readyToCollect) {
      dataset.captureExample();

      e.preventDefault();
      return false;
    }
  });

  $('#start-training').click(function(e) {
    training.fitModel();
  });

  $('#reset-model').click(function(e) {
    training.resetModel();
  });

  $('#draw-heatmap').click(function(e) {
    heatmap.drawHeatmap(dataset, training.currentModel);
  });

  $('#clear-heatmap').click(function(e) {
    heatmap.clearHeatmap();
  });
});
