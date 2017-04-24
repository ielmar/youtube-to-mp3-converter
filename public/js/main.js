        var socket = io().connect('http://46.101.231.170:8000');
        $('#submit').on('click', function(){
            if($.trim($('.youtube').val()) == '')
                $('.youtube').focus();
            else {
                $(this).prop('disabled',true);
                socket.emit('convert',$('.youtube').val());
                $('.youtube').val('');
                socket.on('converted', function(data){
                    dust.render("tpl-layouts/partials/videoDetails.dust", data, function(err, out) {
                        if($('.videodetails').length){
                            $('.videodetails').html(out);
                        }
                        else
                        {
                            $(".jumbotron .container p").velocity( {opacity: 0}, 750, function() {
                                $(out).insertAfter(".jumbotron .container h2").show().velocity({opacity: 1}, 750);
                            });
                            $(".jumbotron p").hide('slow');
                        }
                        history.pushState(null,null,data.slug_url);
                    });
                });
            }
        });

        socket.on('convert_finished', function(data){
            $('<a href="/'+data.mp3_url+'" title="Download MP3" class="btn btn-success btn-primary btn-lg">Download MP3</a>').insertBefore('.m-progress').fadeIn();
            $('.m-progress').hide();
            $('#submit').prop('disabled',false);
        });
                  
        socket.on('last', function(data){
            dust.render("tpl-layouts/partials/last.dust", data, function(err, out) {
                if($('.last').length){
                    $('.last').html(out);
                }
                else
                {
                    $('.last').html(out).show().velocity({opacity: 1}, 750);
                    console.log(err);
                }
                console.log(out); 
            });
        });
        
        socket.on('random', function(data){
            dust.render("tpl-layouts/partials/other.dust", data, function(err, out) {
                if($('.other').length){
                    $('.other').html(out);
                    console.log(out);
                }
                else
                {
                    $('.other').html(out).show().velocity({opacity: 1}, 750);
                    console.log(err);
                }
            });
        });

        socket.on('connect', function(){
            socket.emit('getLast','');
            console.log('connected');
        });