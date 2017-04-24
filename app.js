var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var cons = require('consolidate');
var session = require('express-session');
var kleiDust = require('klei-dust');
var socket = require('socket.io');
var request = require('request');
var getYouTubeID = require('get-youtube-id');
var slug = require('slug');
var fs = require('fs');
var process = require('child_process');
var moment = require('moment');

var routes = require('./routes/index');
var users = require('./routes/users');
var xmle = require('./routes/xml');
var songs = require('./routes/songs');

var app = express();
var io = socket();
app.io = io;

var pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'youtube2mp3',
    connectionLimit: 10
});

app.engine('dust', cons.dust);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('dust', kleiDust.dust);
app.set('view engine', 'dust');
app.set('view options', {
    layout: false
});

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: 'uwotm8'
}));

app.use('/users', users);
//app.use('/xmle', xmle);
app.use('/download-mp3',songs);
app.use('/', routes);

io.on('connection', function (socket) {
    
    socket.on('getLast', function(){
        pool.getConnection(function (err, connection) {
            if (!err) {
                connection.query('select distinct info.title title from videoInfos info join videoIds id on id.`videoId`=info.`videoId` order by info.id desc limit 5', function (err, result, rows) {
//                    console.log({songs:result});
                    if (!err) {
                        // if result is not empty
                        if(result.length)
                            socket.emit('last', result);
                    } else
                        console.log('error running select: ' + err);
                });
            } else
                console.log('getconnection err: ' + err);

            connection.release();
        });
    });
    
    pool.getConnection(function (err, connection) {
        if (!err) {
            connection.query('select distinct info.title title from videoInfos info join videoIds id on id.`videoId`=info.`videoId` order by rand() limit 5', function (err, result, rows) {
//                connection.release(); 
                if (!err) {
                    // if result is not empty
                    if(result.length)
                        socket.emit('random', result);
                    
                } else
                    console.log('error running select: ' + err);
            });
        } else
            console.log('getconnection err: ' + err);
        
        connection.release();
    });
    
    socket.on('getmp3', function(id){
        pool.getConnection(function (err, connection) {
            if(!err){
                connection.query('select info.title title, info.description description, info.img_link img_link from videoInfos info join videoIds id on id.`videoId`=info.`videoId` where id.id = ? limit 1', [id], function(err, result, rows){
                    connection.release();
                    if(!err)
                    {
                        socket.emit('mp3', {
                            img_url: result[0].img_link, 
                            title: result[0].title, 
                            description: result[0].description
                        });
//                        console.log(result);
                    }
                    else
                        console.log('error running select: '+err);
                });
            }
            else
                console.log('getconnection err: '+err);
        });          
      });
    
    socket.on('gimmemp3', function(id){
        pool.getConnection(function(err, connection){
            if(!err){
                connection.query('select videoId from videoIds where id =? limit 1', [id], function(err, result, rows){
                    if(!err){
                        // download and convert youtube video
                        var url = "https://www.googleapis.com/youtube/v3/videos?id=" + result[0].videoId + "&key=***REMOVED***&part=contentDetails,snippet";
                        request(url, function(err, res, body){
                            if(!err && res.statusCode == 200) {
                                // get the url request body 
                                var json = JSON.parse(body);
                                
                                // check if file exists. if not download again
                                if (!fs.existsSync('/home/youtube2mp3.eu/youtube2mp3/mp3/' + slug(json.items[0].snippet.title.toLowerCase()) + '.mp3')) {
                                    // start the download and convert
                                    var ls = process.exec('youtube-dl "https://www.youtube.com/watch?v=' + result[0].videoId + '" -x --audio-format "mp3" --audio-quality 0 -o "/home/youtube2mp3.eu/youtube2mp3/mp3/' + slug(json.items[0].snippet.title.toLowerCase()) + '.%(ext)s"', function (error, stdout, stderr) {
                                        // functions
                                    });
                                
                                    // when downloaded and convert finished, emit the mp3
                                    ls.on('exit', function () {
                                        socket.emit('convert_finished', {
                                            mp3_url: slug(json.items[0].snippet.title.toLowerCase()) + '.mp3'
                                        });
                                        
                                        // release the db connection
                                        connection.release();
                                        setTimeout(function () {
                                            // 15 minutes have passed, delete the file
                                            try{
                                                fs.unlinkSync('/home/youtube2mp3.eu/youtube2mp3/mp3/' + slug(json.items[0].snippet.title.toLowerCase()) + '.mp3');
                                            }catch(e){
                                                // error. 
                                                console.log('Failed to delete mp3 file: '+e);
                                            }
                                        }, 60 * 1000 * 15);
                                    });
                                }
                                else {
                                    // file exists. give the url
                                    socket.emit('convert_finished', {
                                        mp3_url: slug(json.items[0].snippet.title.toLowerCase()) + '.mp3'
                                    });
                                    console.log('file exists. no need to download and convert again ');
                                }
                            }
                            else
                                console.log('Could not get the url: '+err);
                        });
                    }
                    else
                        console.log('error running select: '+err);
                });
            }
            else
                console.log('getconnection err: '+err);
        });
    });
    
    socket.on('convert', function (youtubeUrl) {
        var videoId = getYouTubeID(youtubeUrl);
        if (videoId === null) {
            // show invalid url error
            socket.emit('notyoutube', 'Paste a YouTube URL.');
        } else {
            var url = "https://www.googleapis.com/youtube/v3/videos?id=" + videoId + "&key=***REMOVED***&part=contentDetails,snippet";
            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var json = JSON.parse(body);

                    pool.getConnection(function (err, connection) {
                        if(err) 
                            console.log(err)
                        else
                        //			  var ip = req.headers['X-Real-IP'] || req.connection.remoteAddress;
                        connection.query('INSERT INTO videoIds (videoId, lastConvertTime) VALUES ("' + videoId + '", NOW())', function (err, result) {
                            if (!err) {
                                socket.emit('converted', {
                                    slug_url: 'download-mp3/'+result.insertId + '-' + slug(json.items[0].snippet.title.toLowerCase()),
                                    img_url: json.items[0].snippet.thumbnails.high.url,
                                    title: json.items[0].snippet.title,
                                    description: json.items[0].snippet.description
                                });
                                // start the download
                                var ls = process.exec('youtube-dl "' + youtubeUrl + '" -x --audio-format "mp3" --audio-quality 0 -o "/home/youtube2mp3.eu/youtube2mp3/mp3/' + slug(json.items[0].snippet.title.toLowerCase()) + '.%(ext)s"', function (error, stdout, stderr) {
                                    // functions
                                });
                                ls.on('exit', function () {
                                    socket.emit('convert_finished', {
                                        mp3_url: slug(json.items[0].snippet.title.toLowerCase()) + '.mp3'
                                    });

                                    connection.release();
                                    setTimeout(function () {
                                        // 15 minutes have passed, delete the file
                                        try{
                                            fs.unlinkSync('/home/youtube2mp3.eu/youtube2mp3/mp3/' + slug(json.items[0].snippet.title.toLowerCase()) + '.mp3');
                                        }catch(e){
                                            // error. 
                                            console.log('Failed to delete mp3 file: '+e);
                                        }
                                    }, 60 * 1000 * 30);
                                });
                                // let's add video info to videoinfos table
                                var insertSql = "INSERT INTO videoInfos (videoId, title, description, img_link, slug) VALUES ('" + json.items[0].id + "', " + connection.escape(json.items[0].snippet.title) + ", " + connection.escape(json.items[0].snippet.description) + ", '" + json.items[0].snippet.thumbnails.high.url + "', '" + slug(json.items[0].snippet.title.toLowerCase()) + "')";
                                connection.query(insertSql, function (err, result) {
                                    if (err)
                                        console.log('Failed to insert into videoInfos table: '+err);
                                });

                                // let's add info to sitemap.xml
                                connection.query('select ids.id id, ids.videoId, date(ids.lastConvertTime) as lasttime, infos.title title, infos.slug from videoIds ids, videoInfos infos where ids.videoId = infos.videoId', function (err, result, fields) {
                                    if (!err) {
                                        var xmlString = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
                                        for (var i in result) {
                                            xmlString += "<url><loc>http://www.youtube2mp3.eu/download-mp3/" + result[i].id + "-" + (result[i].slug.length > 1 ? result[i].slug : result[i].title) + "</loc><lastmod>" + moment(result[i].lasttime).format('YYYY-MM-DD') + "</lastmod></url>";
                                        }
                                        xmlString += '</urlset>';
                                        fs.writeFile("public/sitemap.xml", xmlString, function (err) {
                                            if (err) {
                                                console.log('Failed to write to sitemap.xml file: '+err);
                                            }
                                        });
                                    }
                                });
                            }
                            else
                                console.log('Failed to insert into videoids: '+err);
                        });

                    });
                }
            })
        }
    })

});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
/* app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('index', {
        message: err.message,
        error: {}
    });
});*/

app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('views/index.dust');
});


module.exports = app;