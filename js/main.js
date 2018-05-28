$(document).ready(function() {
  var $target = $('#target');
  var targetSize = $target.outerWidth();

  function moveTarget() {
    // Move the model target to where we predict the user is looking to
    if (training.currentModel == null || training.inTraining) {
      return;
    }

    var prediction = training.getPrediction();
    var left = prediction[0] * ($('body').width() - targetSize);
    var top = prediction[1] * ($('body').height() - targetSize);

    $target.css('left', left + 'px');
    $target.css('top', top + 'px');
  }

  setInterval(moveTarget, 100);


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
