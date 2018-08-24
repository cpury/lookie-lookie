$(document).ready(function() {
  window.mouse = {
    mousePosX: 0.5,
    mousePosY: 0.5,

    handleMouseMove: function(event) {
      mouse.mousePosX = event.clientX / $('body').width();
      mouse.mousePosY = event.clientY / $('body').height();
    },

    getMousePos: function() {
      return [mouse.mousePosX, mouse.mousePosY];
    },
  };

  document.onmousemove = mouse.handleMouseMove;
});
