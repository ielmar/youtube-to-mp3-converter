var express = require('express');
var router = express.Router();
var mysql = require('mysql');

var pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'youtube2mp3',
    connectionLimit: 10,
});

router.get('/', function (req, res, next) {
    res.send('index');
});

/* GET songs listing. */
router.get('/:id(\\d+)\-:slug(*)', function (req, res, next) {
    pool.getConnection(function (err, connection) {
        if (!err) {
            connection.query('select info.title title, info.description description, info.slug slug, info.img_link img_link from videoInfos info join videoIds id on id.`videoId`=info.`videoId` where id.id = ? limit 1', [req.params.id], function (err, result, rows) {
                if (!err) {
                    res.render('song', {
                        page_title: result[0].title+' - Convert your favourite YouTube videos to high quality MP3',
                        song_url: 'http://www.youtube2mp3.eu/download-mp3/'+req.params.id+'-'+result[0].slug,
                        song_img_url: result[0].img_link,
                        song_title: result[0].title,
                        song_description: result[0].description
                    });
                } else
                    console.log('error running select: ' + err);
            });
            
            connection.release();
        } else
            console.log('getconnection err: ' + err);
    });
});

module.exports = router;