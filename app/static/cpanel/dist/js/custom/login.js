 $.fn.isConfirmed= ()=> {
    return $('#username').val().trim() && $('#username').val().length > 2 != '' && $('#password').val().trim() != '' && $('#password').val().length >= 6
 }   
$(function () {

    $('#password').on('keypress change', function (e) {
        if ($('#password').val() && $('#password').val().length >= 6) {
            $('#password-errors').html('');
            if (e && e.keyCode == 13) {
                if ($.fn.isConfirmed()) {
             $('#login-submit-bttn').click()
                 }
            }
        }
    });

    $('#username').on('keypress change', function (e) {
        if ($('#username').val() && $('#username').val().length >= 2) {
            $('#username-errors').html('');
            if (e && e.keyCode == 13) {
                if ($.fn.isConfirmed()) {
                $('#login-submit-bttn').click()
                 }
            }
      }
    });

    //$('.form-group').css('max-width','90%');


    $("#login-form").submit(function (e) {
        $('#login-submit-bttn').attr("disabled","disabled")
        if (!$.fn.isConfirmed()) {
            e.preventDefault();

            var username = $('#username').val().trim()
            var password = $('#password').val().trim()
            if (username == '' || $('#username').val().length <= 2) {

                $.fn.showMessageDialog('<div align="center">Login Failed</div>', '<div align = "center" color="red">Username cannot be empty</div>');
                $('#username-errors').html('<p>Please type a valid username</p>');
               
            } else {

                if (password == '') {

                    $.fn.showMessageDialog('<div align="center">Login Failed</div>', '<div align = "center" color="red">Password cannot be empty</div>');
                    if (username != '') {
                        $('#password-errors').html('<p>Please a valid password for ' + username)

                    }

                }
            }
            $('#login-submit-bttn').removeAttr("disabled")
        } 
        
    });

    window.addEventListener("load", () => {
        const box = document.querySelector(".login-box");
        box.style.width = `60%`;
    });

    window.addEventListener("resize", () => {
        const box = document.querySelector(".login-box");
        box.style.width = `60%`;
    });


});