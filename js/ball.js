$(document).ready(function() {
  window.ball = {
    ballSize: $('.ball').outerWidth(),

    moveFollowBallRandomly: function() {
      // Move the ball to a random position.
      var x = 0.02 + Math.random() * 0.96;
      var y = 0.02 + Math.random() * 0.96;

      ball.moveBall(x, y, 'followBall');
    },

    moveBall: function(x, y, id) {
      // Given relative coordinates, moves the ball there.
      var left = x * ($('body').width() - this.ballSize);
      var top = y * ($('body').height() - this.ballSize);

      var $ball = $('#' + id);
      $ball.css('left', left + 'px');
      $ball.css('top', top + 'px');
    },

    getFollowBallPos: function() {
      // Get the normalized ball position.
      var $ball = $('#followBall');
      var left = $ball.css('left');
      var top = $ball.css('top');
      var x = Number(left.substr(0, left.length - 2));
      var y = Number(top.substr(0, top.length - 2));

      return [
        x / ($('body').width() - ball.ballSize),
        y / ($('body').height() - ball.ballSize)
      ];
    },

    mousePosX: 0.5,
    mousePosY: 0.5,

    handleMouseMove: function(event) {
      ball.mousePosX = event.clientX / $('body').width();
      ball.mousePosY = event.clientY / $('body').height();
    },

    getMousePos: function() {
      return [ball.mousePosX, ball.mousePosY];
    },
  };

  ball.moveBall(0.5, 0.25, 'followBall');
  document.onmousemove = ball.handleMouseMove;
});
