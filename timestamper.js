
let twbk_timestamp = () => {
  let alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split("")
  let ts = Date.now()
  console.log(ts)

  let t = ""
  do {
    t = alphabet[ts % alphabet.length] + t
    ts = Math.floor(ts / alphabet.length)
  } while (ts > 0);

  return t
}

console.log(twbk_timestamp())

module.exports = twbk_timestamp
