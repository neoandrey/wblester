
$(function(){

$('.form-group').on('keyup', function(e){
    var id = e.target.id;
     $('#'+id+'-errors').html('')
     // $('#'+id+'-div').attr('class', 'form-group');
})

$('#password,#confirmPassword').each( function(e){

    $(this).on('change', function(e){
    var id = e.target.id;
    var  password            = $('#password').val()
    var  confirmPassword     = $('#confirmPassword').val()
    var minPassLen = 8 
    $('#'+id+'-errors').html('');
  if (password ==''){
                            
        $('#password-errors').html('<p>Please type a valid password</p>');
       
    }

    if (confirmPassword ==''){
                               
        $('#confirm-password-errors').html('<p>Please type a matching password</p>');

    }

     if (password.length >0  && confirmPassword.length >0  ){

        if(password.length < minPassLen){
             
            $('#password-errors').html('<p>Password must be at least '+minPassLen.toString()+' characters long</p>');
            $('#confirm-password-errors').html('<p>Password must be at least '+minPassLen.toString()+' characters long</p>');
        
        } else if (password != confirmPassword ){
        
            $('#password-errors').html('<p>Pasword and verification passwords do not match</p>');
            $('#confirm-password-errors').html('<p>Pasword and verification passwords do not match</p>');
        
        } else if (password == confirmPassword && !$.fn.isValidPass(password)) {

            $('#password-errors').html('<p>Password must contain alphabets, numbers and special characters</p>');
            $('#confirm-password-errors').html('<p>Password must contain alphabets, numbers and special characters</p>');



        } else if (password == confirmPassword && $.fn.isValidPass(password)) {

            $('#password-errors').html('');
            $('#confirm-password-errors').html('');
     

        }

}

    })

});


$("#user-submit-bttn").on('click', async function(e){
    let isConfirmed  = $('#is-confirmed').val()
    var  isFormValid =  true;
    if (isConfirmed !='9999999999') {
            e.preventDefault();
            var  username            = $('#username').val()
            var  password            = $('#password').val()
            var  confirmPassword     = $('#confirmPassword').val()

            var  validationMessage   = []
            validationMessage.push('<div style="text-align:left"><h4>Please address the followiwng errors:</h4><ol >')


            if (username ==''){
                validationMessage.push('<li>username cannot be empty</li>')                        
            $('#username-errors').html('<p>Please type a valid username</p>')
            isFormValid = false;

            }


            if (password ==''){
                validationMessage.push('<li>password cannot be empty</li>')     
                $('#password-errors').html('<p>Please type a valid password</p>');
                isFormValid = false;                  

            }

            if (confirmPassword ==''){
                validationMessage.push('<li>Password check field cannot be empty</li>'); 
                $('#confirm-password-errors').html('<p>Please type a matching password</p>');
                isFormValid = false;                       

            }
            var minPassLen = 8
            if (password.length >0  && confirmPassword.length >0  ){

            if(password.length < minPassLen){
                    validationMessage.push('<li>Password is too short</li>'); 
                    isFormValid = false;
            } else if (password !== confirmPassword ){
                validationMessage.push('<li>Password mismatch</li>'); 
                isFormValid = false;

            } else if (password == confirmPassword && !$.fn.isAlphanumSpecial(password)) {

                validationMessage.push('<li>Password is too weak</li>'); 
                isFormValid = false;

            } else if (password == confirmPassword && $.fn.isAlphanumSpecial(password)) {
                isFormValid = true;
                        
            }


            }

    
    
} 

if (isFormValid){
    $('#is-confirmed').val('9999999999');
    $('#registration-form').submit();
    $("#user-submit-bttn").click();


}else if(isConfirmed !='9999999999') {
    validationMessage.push('</ol></div>')
    $.fn.showMessageDialog('<div>User Validation Errors</div>', validationMessage.join(''));
}


});


window.addEventListener("load", () => {
    const box = document.querySelector(".register-box");
    box.style.width = `65%`;
});

window.addEventListener("resize", () => {
    const box = document.querySelector(".register-box");
    box.style.width = `65%`;
});


});
