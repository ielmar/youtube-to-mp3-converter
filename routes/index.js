var express = require('express');
var router = express.Router();
var mysql = require('mysql');

var pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'youtube2mp3',
    connectionLimit: 10
});

/* GET home page. */
router.get('/*', function (req, res, next) {
    res.render('index', {
        page_title: 'YouTube to MP3 Converter - YouTube2MP3.eu',
    });
});

module.exports = router;