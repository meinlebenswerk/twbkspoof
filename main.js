// var TWBKInterface, answers, baseURL, chosen_answer, id, iface, interval, intervalID, running, votes;
//
// TWBKInterface = require('./twbkinterface').TWBKInterface;
//
// id = "a52";
//
// votes = 10;
//
// answers = ['y', 'n', 'a', 'b', 'c', 'd', 'e', 'f'];
//
// chosen_answer = 0;
//
// baseURL = "http://tum.twbk.de/";
//
// running = true;
//
// interval = 1000;
//
// intervalID = 0;
//
// iface = new TWBKInterface({
//   url: baseURL + "socket/websocket",
//   id: id,
//   answerindex: chosen_answer,
//   n_votes: votes,
//   method: 1
// });

var term = require( 'terminal-kit' ).terminal ;
const figlet = require('figlet');
const request = require('request');
const TWBKInterface = require('./twbkinterface');

let spoofer_main = (session_id, term) => {
  let _if = new TWBKInterface(session_id, term)
}

term.on('key', function( name , matches , data ) {
  if ( name === 'CTRL_C' ) {process.exit()}
})

let text = figlet.textSync('Wahlbetrug\n')
term(text + '\n')
term('Welcome to the Tweedback Spoofer\n')
term('Enter the tweedback sessionID: ') ;
term.inputField((error, input) => {
  term('\n')
  spoofer_main(input, term)
}) ;


process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    process.exit();
});
