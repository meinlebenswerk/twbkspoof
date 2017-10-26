var TWBKInterface, answers, baseURL, chosen_answer, id, iface, interval, intervalID, running, votes;

TWBKInterface = require('./twbkinterface').TWBKInterface;

id = "a52";

votes = 10;

answers = ['y', 'n', 'a', 'b', 'c', 'd', 'e', 'f'];

chosen_answer = 0;

baseURL = "http://tum.twbk.de/";

running = true;

interval = 1000;

intervalID = 0;

iface = new TWBKInterface({
  url: baseURL + "socket/websocket",
  id: id,
  answerindex: chosen_answer,
  n_votes: votes,
  method: 1
});
