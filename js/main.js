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

  function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }


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

  $('#store-data').click(function(e) {
    var data = dataset.toJSON();
    var json = JSON.stringify(data);
    download(json, 'dataset.json', 'text/plain');
  });

  $('#load-data').click(function(e) {
    $("#data-uploader").trigger('click');
  });

  $('#data-uploader').change(function(e) {
    var file = e.target.files[0];
    var reader = new FileReader();

    reader.onload = function() {
      var data = reader.result;
      var json = JSON.parse(data);
      dataset.fromJSON(json);
    }

    reader.readAsBinaryString(file);
  });

  $('#store-model').click(async function(e) {
    await training.currentModel.save('downloads://model');
  });

  $('#load-model').click(function(e) {
    $("#model-uploader").trigger('click');
  });

  $('#model-uploader').change(async function(e) {
    var files = e.target.files;
    training.currentModel = await tf.loadModel(tf.io.browserFiles([files[0], files[1]]));
    ui.onFinishTraining();
  });
});
