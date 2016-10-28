var path = require('path');

var relativeDfltAvatarPath = '../img/default-avatar.svg';

// this does not work with hyperdev, we will export the svg content
module.exports = {
  path: path.join(__dirname, relativeDfltAvatarPath)
};