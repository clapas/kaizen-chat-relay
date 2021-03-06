var express = require('express')
var app = express();
var http = require('http');
var server = http.Server(app);
var io = require('socket.io')(server);

app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
  response.send("Hi there!")
})

var fs = require('fs'); // this engine requires the fs module
app.engine('ntl', function (filePath, options, callback) { // define the template engine
    fs.readFile(filePath, function (err, content) {
        if (err) throw new Error(err);
        // this is an exteremly simple template engine
        var rendered = content.toString()
            .replace(/#chat_title#/g, options.chat_title)
            .replace(/#user_id#/g, options.user_id)
            .replace(/#chat_relay_baseURL#/g, options.baseURL);
        return callback(null, rendered);
    })
});
app.set('views', './views'); // specify the views directory
app.set('view engine', 'ntl'); // register the template engine

app.get('/appkaizen.js', function (req, res) {
    if (!req.query.chat_title) req.query.chat_title = 'AppKaizen Chat';
    res.setHeader('content-type', 'application/javascript');
    res.render('appkaizen', {
        chat_title: req.query.chat_title,
        user_id: req.query.user_id,
        baseURL: req.protocol + '://' + req.get('host')
    });
});

var config = require('./config')
io.on('connection', function(socket) {
    var options = {
        host: config.XMPP_BOT,
        port: 80,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    socket.on('disconnect', function () {
        var data = 'socket.io=' + socket.id + '&user_id=' + socket.user_id;

        options.path = '/disconnect';
        options.headers['Content-Length'] = Buffer.byteLength(data);
        var httpreq = http.request(options, function (response) {
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                console.log("body: " + chunk);
            });
        });
        httpreq.write(data);
        httpreq.end();
    });
    socket.on('chat message', function(data) {
        console.log(data, socket.id);
        socket.user_id = data.user_id;
        data.message = 'message=' + encodeURIComponent(data.message) + '&socket.io=' + socket.id + '&user_id=' + data.user_id;

        options.path = '/send';
        options.headers['Content-Length'] = Buffer.byteLength(data.message);
        var httpreq = http.request(options, function (response) {
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                console.log("body: " + chunk);
            });
        });
        httpreq.write(data.message);
        httpreq.end();
    });
    socket.on('email message', function(data) {
        console.log(data, socket.id);
        socket.user_id = data.user_id;
        data.message = 'message=' + encodeURIComponent(data.message) + '&user_id=' + data.user_id + '&from=' + encodeURIComponent(data.from);

        options.path = '/email';
        options.headers['Content-Length'] = Buffer.byteLength(data.message);
        var httpreq = http.request(options, function (response) {
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                console.log("body: " + chunk);
            });
        });
        httpreq.write(data.message);
        httpreq.end();
    });
    socket.on('test', function(data) {
        var test = 'socket.io=' + socket.id + '&user_id=' + data.user_id;
        options.path = '/send';
        options.headers['Content-Length'] = Buffer.byteLength(test);
        var httpreq = http.request(options, function (response) {
            if (response.statusCode != '503') io.sockets.in(socket.id).emit('available');
        });
        httpreq.write(test);
        httpreq.end();
    });
});

app.get('/answer', function(req, res) {
    console.log(req.query.message + ' answered');
    io.sockets.in(req.query['socket.io']).emit('chat message', req.query.message);
    res.send('ok');
});

server.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})
