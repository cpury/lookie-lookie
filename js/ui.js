window.ui = {
  setContent: function(key, value) {
    // Set an element's content based on the data-content key.
    $('[data-content="' + key + '"]').html(value);
  },

  showInfo: function(text, dontFlash) {
    // Show info and beep / flash.
    ui.setContent('info', text);
    if (!dontFlash) {
      $('#info').addClass('flash');
      new Audio('hint.mp3').play();
      setTimeout(function() {
        $('#info').removeClass('flash');
      }, 1000);
    }
  },

  onAddExample: function(nTrain, nVal) {
    // Call this when an example is added.
    ui.setContent('n-train', nTrain);
    ui.setContent('n-val', nVal);
    if (nTrain == 2) {
      $('#start-training').prop('disabled', false);
    }
    if (state == 'collecting' && nTrain + nVal == 14) {
      ui.showInfo(
        'Great job! Now that you have a handful of examples, let\'s train the neural network!<br>'
        + 'Click the "Start Training" button on the right to start.'
      );
    }
  },

  onFinishTraining: function() {
    // Call this when training is finished.
    $('#modelBall').css('opacity', '0.9');
    $('#draw-heatmap').prop('disabled', false);
    $('#reset-model').prop('disabled', false);
    state = 'trained';
    ui.showInfo(
      'Awesome! The green ball should start following your eyes around.<br>'
      + 'It will be very bad at first, but you can collect more data and retrain again later!'
    );
  },
};
