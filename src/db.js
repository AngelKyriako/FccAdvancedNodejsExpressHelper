var mongoose = require('mongoose');
var bcrypt = require('bcrypt');

var ValidationError = mongoose.Error.ValidationError;
var ValidatorError  = mongoose.Error.ValidatorError;

var userSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return v && v.length > 0 && v.length<32;
      },
      message: '{VALUE} is not a valid username!'
    },
    required: [true, 'a unique username is required']
  },
  name: {
    type: String,
    validate: {
      validator: function (v) {
        return v && v.length > 0 && v.length<64;
      },
      message: '{VALUE} is not a valid name!'
    }
  },
  passports: [{
    type: {
      type: String,
      enum: ['local', 'facebook', 'google'],
      required: [true, 'a passport type is required']
    },
    // local registration
    password: {
      type: String,
      trim: true,
      validate: {
        validator: function (pwd) {
          return !pwd || (pwd.length > 0 && pwd.length<64);
        },
        message: '{VALUE} is not a valid password!'
      }
    },
    // social media registration
    accessToken: {
      type: String
    },
    profileId: {
      type: String
    }
  }],
  avatarUrl: {
    type: String,
    trim: true,
    default: '/avatar/default'
  }
}, {
  timestamps: true
});

// encryption helper, we will use it for the password encryption process
userSchema.methods.getPassportByType = function getPassportByType(type) {
  return this.passports.find(function (p) {
    return p.type === type;
  });
};

userSchema.methods.verifyPassword = function verifyPassword(password, next) {
  var localPassport = this.getPassportByType('local');
  if (password && localPassport) {
    bcrypt.compare(password, localPassport.password, next);
  } else {
    next(null, false);
  }
};
userSchema.methods.verifyPasswordSync = function verifyPasswordSync(password) {
  var localPassport = this.getPassportByType('local');
  return password && localPassport && bcrypt.compareSync(password, localPassport.password);
};

userSchema.pre('save', function beforeSave(next) {
  
  if (!this.name) {
    this.name = this.username;
  }
  
  // support local users only
  var localPassport = this.getPassportByType('local');
  
  var error = new ValidationError(this);
  if (!localPassport) {
    error.errors.passports = new ValidatorError('passports', 'at least a passport of type "local" is required', 'notvalid', this.passports);    
    next(error);
  } else {
    console.info('presave localPassport', localPassport)
    if (!localPassport.password) {
      console.info('presave localPassport.password', localPassport.password)
      error.errors.password = new ValidatorError('password', 'password is required', 'notvalid', localPassport.password);    
      next(error);
    } else {
      bcrypt.hash(localPassport.password, 10, function(err, hash) {
        if (err) {
          next(err);
        } else {
          localPassport.password = hash;
          next();
        }
      });      
    }
  }
});

userSchema.method('toClient', function toClient() {
    var obj = this.toObject();

    obj.id = obj._id;
    delete obj._id;

    delete obj.passports;

    return obj;
});

var messageSchema = new mongoose.Schema({
  creator: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'a creator id is required']
    },
    name: {
      type: String,
      validate: {
        validator: function (v) {
          return v && v.length > 0 && v.length<256;
        },
        message: '{VALUE} is not a valid text!'
      },
      required: [true, 'a creator name is required']
    },
    avatarUrl: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || v.length > 0;
        },
        message: '{VALUE} is not a valid avatar url!'
      }
    }
  },
  text: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return v && v.length > 0 && v.length<256;
      },
      message: '{VALUE} is not a valid text!'
    },
    required: [true, 'a text is required']
  },
  geo: {
    country_name: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || v.length<256;
        },
        message: '{VALUE} is not a valid country!'
      }
    },
    region_name: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || v.length<256;
        },
        message: '{VALUE} is not a valid region!'
      }
    },
    city: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || v.length<256;
        },
        message: '{VALUE} is not a valid city!'
      }
    },
    time_zone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || v.length<256;
        },
        message: '{VALUE} is not a valid timezone!'
      }
    }
  }
}, {
  timestamps: true
});

messageSchema.method('toClient', function toClient() {
    var obj = this.toObject();

    obj.id = obj._id;

    delete obj._id;

    return obj;
});

messageSchema.virtual('friendlyTimestamp').get(function() {
  var delta = Math.round((+new Date() - this.createdAt) / 1000);

  var minute = 60,
      hour = minute * 60,
      day = hour * 24,
      week = day * 7;

  if (delta < 30) {
    return 'just now';
  } else if (delta < minute) {
    return delta + ' seconds ago';
  } else if (delta < 2 * minute) {
    return 'a minute ago';
  } else if (delta < hour) {
    return Math.floor(delta / minute) + ' minutes ago';
  } else if (Math.floor(delta / hour) == 1) {
    return '1 hour ago';
  } else if (delta < day) {
    return Math.floor(delta / hour) + ' hours ago';
  } else if (delta < day * 2) {
    return 'yesterday';
  } else if (delta < week) {
    return Math.floor(delta / day) + ' days ago';
  } else {
    return ' a long time ago';
  }
});

messageSchema.virtual('location').get(function() {
  var geo = this.geo;
  var location = '';
  if (geo.time_zone && geo.time_zone.length > 0) {
    return geo.time_zone;
  } else if (geo.country_name && geo.country_name.length !== 0 &&
      geo.city && geo.city.length !== 0) {
    return geo.city + '/' + geo.country_name;
  } else {
    return undefined;
  }
});

messageSchema.virtual('footer').get(function() {
  var loc = this.location;
  var timestamp = this.friendlyTimestamp;

  if (loc) {
    return timestamp + ', ' + loc;
  } else {
    return timestamp;
  }
});

function initialize(dbUri) {
  mongoose.connect(dbUri);

  // init guest user
  db.User.findOne({ username: 'guestuser' }).exec(function (err, user) {
    if (err) {
      console.error('failed to check guest user existence: ', err);
    } else if (!user) {
      db.User.create({
        username: 'guestuser',
        name: 'guest',
        passports: [{
          type: 'local',
          password: 'guestuser'
        }]
      }, function(err, user) {
        if (err)
          console.error('failed to create guest user: ', err);
        else {
          console.info('guest user created: ', user);
          // init default messages
          db.Message.create({
            creator: {
              id: user._id,
              name: user.name,
              avatarUrl: user.avatarUrl
            },
            text: 'Hello friend !!'
          }, function(err, message) {
            if (err)
              console.error('failed to create default message: ', err);
            else
              console.info('default message created: ', message);
          });
        }
      });
    }
  });  
}

var db = {
  init: initialize,
  User: mongoose.model('User', userSchema),
  Message: mongoose.model('Message', messageSchema)
};

module.exports = db;