// var WebSocket, answers,
//   bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
//
// WebSocket = require('ws');
//
// answers = ['y', 'n', 'a', 'b', 'c', 'd', 'e', 'f'];
//

const request = require('request');
const { JWT } = require('jose')
const WebSocket = require('ws');

const WS_PING = '2'
const WS_PING_RESPONSE = '3'

const WS_PROBE = '2probe'
const WS_PROBE_RESPONSE = '3probe'

const WS_PROBE_ACK = '5'
const WS_QUERY_RESPONSE = '43'

const ROOM_API_ADDRESS = "https://tweedback.de/api/v1/get-room-info/"

let twbk_timestamp = () => {
  let alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split("")
  let ts = Date.now()

  let t = ""
  do {
    t = alphabet[ts % alphabet.length] + t
    ts = Math.floor(ts / alphabet.length)
  } while (ts > 0);

  return t
}

class TWBKInterface {
  constructor(session_id, terminal, name){
    this.terminal = terminal
    this.id = session_id

    this.name = name || `user#${Math.floor(Math.random() * 10e5)}`

    //Hardcoded to 3 in the TWBK code.
    this.protocol = 3

    this.sessionInfo = null

    this.sid = null
    this.pingInterval = null
    this.pingTimeout = null

    this.ws = null
    this.wsIntervalTimer = null

    this.quizzes = null
    this.updateQuizzes = true

    this.token = null
    this.lastQuery = null

    this.options = null
    this.nVotes = 0

    terminal('Connecting to TweedbackSession @ %s \n', this.id)
    this.getSessionInfo().then(this._sessionInfoCallback.bind(this))
  }

  getT(){
    return twbk_timestamp()
  }

  NewIdentity(){
    this.ws.close()
    clearInterval(this.wsIntervalTimer)
    this.obtainAuth()
    .then(this.obtainSID.bind(this))
    .then(this._joinRoom.bind(this))
    .then(this.authenticate.bind(this))
    .then(this.checkAuth.bind(this))
    .then(this._initWebsocket.bind(this))
  }

  _sessionInfoCallback(sessionInfo){
    this.sessionInfo = sessionInfo

    let date = new Date(this.sessionInfo.creationDate)
    this.terminal('Found session with id %s @ %s, which was created at: %s.\n', this.sessionInfo.id, this.sessionInfo.name, date.toString())
    this.obtainSID().then(this._SIDCallback.bind(this))
  }

  getSessionInfo(){
    return new Promise((resolve, reject) => {
      request(`https://tweedback.de/api/v1/get-room-info/${this.id}`, (e, r, body) => {
        let sessionInfo = (!e)? JSON.parse(body) : null
        resolve(sessionInfo)
      })
    })
  }

  _SIDCallback(info){
    this._joinRoom()
    .then(this.obtainAuth.bind(this))
    .then(this.authenticate.bind(this))
    // .then(this.checkAuth.bind(this))
    .then(this._initWebsocket.bind(this))
  }

  obtainSID(){
    return new Promise((resolve, reject) => {
      request(`https://tweedback.de/socket.io/?EIO=3&transport=polling&t=${this.getT()}`, (e, r, body) => {
        //let sessionInfo = (!e)? JSON.parse(body) : null
        //resolve(sessionInfo)
        body = body.match(/({[^}]+})/)[0]
        let info = JSON.parse(body)

        this.sid = info.sid
        this.pingInterval = info.pingInterval
        this.pingTimeout = info.pingTimeout

        resolve(info)
      })
    })
  }

  obtainAuth(){
    return new Promise((resolve, reject) => {
      request.post({url:'https://tweedback.de/api/v1/auth'}, (e, r, body) => {
        let token = JSON.parse(body).token
        this.token = token
        resolve()
      })
    })
  }

  _joinRoom(){
    return new Promise((resolve, reject) => {
      let url = `https://tweedback.de/socket.io/?EIO=3&transport=polling&t=${this.getT()}&sid=${this.sid}`
      request.post({url:url, body: `40:40/${this.sessionInfo.id},`, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (e, r, body) => {
        (body === 'ok')? resolve() : reject()
      })
    })
  }

  authenticate(){
    let payload_string = `614:42/${this.sessionInfo.id},["authenticate",{"token":"${this.token}"}]`

    return new Promise((resolve, reject) => {
      let url = `https://tweedback.de/socket.io/?EIO=3&transport=polling&t=${this.getT()}&sid=${this.sid}`
      request.post({url:url, body: payload_string, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (e, r, body) => {
        (body === 'ok')? resolve() : reject()
      })
    })
  }

  checkAuth(){
    return new Promise((resolve, reject) => {
      request(`https://tweedback.de/socket.io/?EIO=3&transport=polling&t=${this.getT()}&sid=${this.sid}`, (e, r, body) => {
        (body.length> 20)? resolve() : reject()
      })
    })
  }

  _initWebsocket(){
    this.ws = new WebSocket(`wss://tweedback.de/socket.io/?EIO=${this.protocol}&transport=websocket&sid=${this.sid}`)

    this.ws.on('open', () => {
      this.ws.send('2probe')
      this.wsIntervalTimer = setInterval(this._wsPing.bind(this), this.pingTimeout)
    })

    this.ws.on('message', this._wsMSGHandler.bind(this));

  }

  _parseOptionNames(name){
    switch(name){
      case '__builtin_yes':
      return 'Yes'
      case '__builtin_no':
      return 'No'
      case '__builtin_a':
      return 'A'
      case '__builtin_b':
      return 'B'
      case '__builtin_c':
      return 'C'
      case '__builtin_d':
      return 'D'
      case '__builtin_e':
      return 'E'
    }
    return name
  }

  _parseQuizzes(quiz_query_data){
    let parsed = []
    for(let quizData of quiz_query_data[0].data){
      let quiz = {
        id: quizData.id,
        title: quizData.title,
        state: quizData.state,
        options: []
      }

      for(let option of quizData.voteOptions){
        let op = {
          id: option.id,
          description: this._parseOptionNames(option.description),
          correct: option.correct,
          index: option.index
        }
        quiz.options.push(op)
      }

      parsed.push(quiz)
    }
    return parsed
  }

  _answerSelected(quiz, err, selected){
    let idx = selected.selectedIndex

    let answer_id = quiz.options[idx].id
    let quiz_id = quiz.id

    this.options= {
      quiz: quiz_id,
      id: answer_id
    }
    this.terminal.green('Starting spoofer, just press CTRL+C to abort.\n')
    this._wsVote(quiz_id, answer_id)
  }

  _quizSelected(err, selected){
    let id = selected.selectedText

    let quiz = this.quizzes.filter(q=> q.title === id || q.id === id)[0]
    let answers = quiz.options.map(op => op.description? op.description : op.index + `[${op.correct? 'correct' : 'incorrect'}]`)

    this.terminal.green('Selected Quiz %s, choose your answer:\n', id) ;

    this.terminal.singleColumnMenu(answers, this._answerSelected.bind(this, quiz))
  }

  _wsMSGHandler(msg){
    // console.log(msg)
    if(msg === WS_PROBE_RESPONSE){
      //console.log('received probe response')
      this.ws.send(WS_PROBE_ACK)
      if(this.options !== null){
        this._wsVote(this.options.quiz, this.options.id)
      }else{
        this._wsQueryQuizzes()
      }
    }

    if(msg === WS_PING_RESPONSE && this.updateQuizzes){
      this._wsQueryQuizzes()
    }

    let op = msg.slice(0,2)
    if(op === WS_QUERY_RESPONSE){
      switch(this.lastQuery){
        case 'quiz':
          let data = JSON.parse(msg.match(/(\[[^]+\])/)[0])
          this.quizzes = this._parseQuizzes(data)
          if(this.quizzes.length != 0){
            this.updateQuizzes = false
          }

          this.terminal.green('Successfully connected to session -> select your quiz:\n' ) ;
          let options = this.quizzes.filter(q => q.state === 'running').map(q => q.title? q.title : q.id)
          this.terminal.singleColumnMenu(options, this._quizSelected.bind(this))
        break;

        case 'vote':
          this.NewIdentity()
        break;
      }
    }

  }

  _wsQueryQuizzes(){
    let msg = `42/${this.sessionInfo.id},0["action",{"featureId":"quiz","action":{"type":"[Quiz] Get All Quizzes"}}]`
    console.log('Querying Quizzes.')
    this.ws.send(msg)
    this.lastQuery = 'quiz'
  }

  _wsVote(quiz_id, option_id){
    let payload = `42/${this.sessionInfo.id},1["action",{"featureId":"quiz","action":{"type":"[Quiz] Vote Quiz","payload":{"quizId":"${quiz_id}","voteOptions":[{"voteOptionId":"${option_id}"}]}}}]`
    this.ws.send(payload)
    this.lastQuery = 'vote'
    this.terminal.green('Sent Vote #%s\n', this.nVotes)
    this.nVotes++
  }

  _wsPing(){
    // console.log('pinging WS')
    this.ws.send(WS_PING)
  }

}

module.exports = TWBKInterface
