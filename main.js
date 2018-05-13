async function loadMobilenet() {
  const mobilenet = await tf.loadModel(
      'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');

  // Return a model that outputs an internal activation.
  const layer = mobilenet.getLayer('conv_pw_13_relu');
  console.info('MobileNet layers', mobilenet.layers);
  return tf.model({inputs: mobilenet.inputs, outputs: layer.output});
};

loadMobilenet();
