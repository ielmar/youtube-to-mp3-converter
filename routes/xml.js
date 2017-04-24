var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var request = require('request');
var xml = require('node-jsxml');
var slug = require('slug');
var fs = require('fs');
var moment = require('moment');

var pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'youtube2mp3',
    connectionLimit: 10,
});

// middleware specific to this router
router.use(function timeLog(req, res, next) {
        console.log('Time: ', Date.now());
        next();
    })
    // define the home page route
router.get('/', function (req, res) {
        pool.getConnection(function (err, connection) {
            connection.query('select ids.id id, ids.videoId, date(ids.lastConvertTime) as lasttime, infos.title title, infos.slug from videoIds ids, videoInfos infos where ids.videoId = infos.videoId', function (err, result, fields) {
                if (!err) {
                    var xmlString = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
                    for (var i in result) {
                        xmlString += "<url><loc>http://www.youtube2mp3.eu/" + result[i].id + "-" + (result[i].slug.length > 1 ? result[i].slug : result[i].title) + "</loc><lastmod>" + moment(result[i].lasttime).format('YYYY-MM-DD') + "</lastmod></url>";
                    }
                    xmlString += '</urlset>';
                    fs.writeFile("public/sitemap.xml", xmlString, function (err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            });
            connection.release();
        });
        console.log('finished');
    })
    // define the about route
router.get('/about', function (req, res) {
    res.send('About birds');
})

module.exports = router;