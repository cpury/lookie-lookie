$(document).ready(function() {
  function moveModelBall() {
    // Move the model ball to where we predict the user is looking to
    if (training.currentModel == null) {
      return;
    }
    tf.tidy(function() {
      var img = dataset.getImage();
      var eyePos = dataset.getEyePos();
      var prediction = training.currentModel.predict([img, eyePos]);
      ball.moveBall(prediction.get(0, 0) + 0.5, prediction.get(0, 1) + 0.5, 'modelBall');
    });
  }

  setInterval(moveModelBall, 100);
  ball.moveBall(0.5, 0.5, 'modelBall');


  // Map functions to keys and buttons:

  $('body').keyup(function(e) {
    // On space key:
    if (e.keyCode == 32 && ui.readyToCollect) {
      dataset.captureExample();
      setTimeout(ball.moveFollowBallRandomly, 100);

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
