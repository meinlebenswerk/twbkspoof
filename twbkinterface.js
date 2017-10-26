var WebSocket, answers,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

WebSocket = require('ws');

answers = ['y', 'n', 'a', 'b', 'c', 'd', 'e', 'f'];

exports.TWBKInterface = (function() {
  function TWBKInterface(data) {
    var error;
    if (data == null) {
      data = {
        url: "",
        id: "",
        answerindex: 0,
        n_votes: 10,
        method: 0
      };
    }
    this._loginHandler = bind(this._loginHandler, this);
    this._close = bind(this._close, this);
    this._voteByReAUTH = bind(this._voteByReAUTH, this);
    this._socketDataHandler = bind(this._socketDataHandler, this);
    this._onSocketOpen = bind(this._onSocketOpen, this);
    this.id = data.id, this.answerindex = data.answerindex, this.n_votes = data.n_votes, this.method = data.method;
    console.log("attempting to connect to: " + data.url);
    this.quiz_id = 0;
    try {
      this.socket = new WebSocket(data.url);
    } catch (error1) {
      error = error1;
      console.log("error opening WebSocket!");
    }
    this.quiz_id = "";
    this.quiz_type = "yn";
    this.index = 0;
    this.vote_run = false;
    this.tb_session = null;
    this.socket.on('open', this._onSocketOpen);
  }

  TWBKInterface.prototype._onSocketOpen = function() {
    console.log("connected to websocket!");
    this.socket.on('message', this._socketDataHandler);
    return this._emit("tb_session", {
      init: true
    });
  };

  TWBKInterface.prototype._emit = function(name, data) {
    var msg, ref;
    msg = {
      name: name,
      data: data,
      tb_session: this.tb_session
    };
    console.log("message: " + msg.name);
    console.log("session: " + ((ref = this.tb_session) != null ? ref.session_id : void 0));
    return this.socket.send(JSON.stringify(msg));
  };

  TWBKInterface.prototype._joinLesson = function() {
    return this._emit("join_lesson", {
      lesson_id: this.id,
      client_info: {
        browser_name: "Chrome",
        browser_version: "62.0.3202.62 Safari/537.36",
        os: "linux",
        referrer: "",
        screen_height: 900,
        screen_width: 1600,
        user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.62 Safari/537.36"
      }
    });
  };

  TWBKInterface.prototype._initHandler = function(data) {
    this.tb_session = JSON.parse(data);
    console.log("tb_session is now: " + data);
    return this._joinLesson();
  };

  TWBKInterface.prototype._updateHandler = function(data) {
    var feature, found, j, len, quiz, ref;
    if (this.vote_run) {
      return;
    }
    quiz = {};
    found = false;
    ref = data.data.features;
    for (j = 0, len = ref.length; j < len; j++) {
      feature = ref[j];
      if (feature.feature_id === "quiz") {
        if (feature.enabled) {
          found = true;
          this.quiz_id = feature.data.current.quiz_id;
          this.quiz_type = feature.data.current.quiz_type;
        }
      }
    }
    if (!found) {
      return;
    }
    console.log("found active quiz, activating vote-bot");
    return this._voteHandler();
  };

  TWBKInterface.prototype._socketDataHandler = function(message) {
    var data, name, session;
    message = JSON.parse(message);
    name = message.name;
    data = message.data;
    session = message.session;
    if (name === "tb_session") {
      this.session = data;
      if (this.vote_run) {
        this._loginHandler();
      }
      this._initHandler(data);
    }
    if (name === "update_response" || name === "join_lesson_response") {
      this._updateHandler(data);
    }
    if (name === "quiz:quiz_start") {
      this.quiz_id = data.quiz_id;
      return this.quiz_type = data.quiz_type;
    }
  };

  TWBKInterface.prototype._voteHandler = function() {
    this.vote_run = true;
    switch (this.method) {
      case 0:
        this._voteByReplay();
        break;
      case 1:
        this._voteByReAUTH();
        break;
    }
  };

  TWBKInterface.prototype._voteByReplay = function() {
    var i, j, ref, results, socketEvent;
    results = [];
    for (i = j = 0, ref = this.n_votes; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
      socketEvent = {
        "feature_id": "quiz",
        "name": "give_answer",
        "data": {
          "quiz_id": this.quiz_id,
          "answer": answers[this.answerindex]
        }
      };
      results.push(this._emit("feature_event", socketEvent));
    }
    return results;
  };

  TWBKInterface.prototype._voteByReAUTH = function() {
    this.vote_run = true;
    console.log("begin reauth");
    this.index = 0;
    return this._loginHandler();
  };

  TWBKInterface.prototype._close = function() {

    /*
    try
      @socket.close()
    catch error
      console.log "Error closing WebSocket -> this can be ignored"
     */
    return process.exit(1);
  };

  TWBKInterface.prototype._loginHandler = function() {
    var socketEvent;
    this.index++;
    console.log("Index:" + this.index);
    if (this.index === this.n_votes) {
      this._close();
    }
    socketEvent = {
      "feature_id": "quiz",
      "name": "give_answer",
      "data": {
        "quiz_id": this.quiz_id,
        "answer": answers[this.answerindex]
      }
    };
    this._emit("feature_event", socketEvent);
    this.tb_session = null;
    return this._emit("tb_session", {
      'init': true
    });
  };

  TWBKInterface.prototype._errorHandler = function(error) {
    if (error == null) {
      return;
    }
    return console.log(error);
  };

  return TWBKInterface;

})();
