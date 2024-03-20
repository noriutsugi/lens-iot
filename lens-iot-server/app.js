/* import  Express  from 'express';
const app = Express()
const port = 3000 */
//import fetch from 'node-fetch';

var WebSocketClient = require('websocket').client;

var client = new WebSocketClient();

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });
    
    function sendNumber() {
        if (connection.connected) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            connection.sendUTF(number.toString());
            setTimeout(sendNumber, 1000);
        }
    }
    sendNumber();
});

client.connect('ws://192.168.1.1:80/ws', 'echo-protocol');
/* 
app.use(Express.json()) */

/* app.post("/controller", function (request, response) {
  console.log(request.body)
  response.sendStatus(200);
}); */


 /* async function getUsers() {
  const response = await fetch('http://192.168.1.1/setDevices?servername=http://192.168.1.3/controls/On');
   const data = response.body; 
  console.log(response);
}

getUsers()  */
/* var body = {
  ip: "a",
  command: "Speed3"
}
const response = await fetch('http://192.168.1.1/setDevices', {
    method: 'post',get the Jar treatment
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json'}
});
//const data = await response.json();

console.log(response); */

/* 
app.post('/android', (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
}) */
/* 
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
}) */