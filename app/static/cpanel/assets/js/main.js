/*
	ZeroFour by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function($) {

	skel
		.breakpoints({
			desktop: '(min-width: 737px)',
			tablet: '(min-width: 737px) and (max-width: 1200px)',
			mobile: '(max-width: 736px)'
		})
		.viewport({
			breakpoints: {
				tablet: {
					width: 1080
				}
			}
		});

	$(function() {

		var	$window = $(window),
			$body = $('body');

		// Disable animations/transitions until the page has loaded.
			$body.addClass('is-loading');

			$window.on('load', function() {
				$body.removeClass('is-loading');
			});

		// Fix: Placeholder polyfill.
			$('form').placeholder();

		// Dropdowns.
			$('#nav > ul').dropotron({
				offsetY: -22,
				mode: 'fade',
				noOpenerFade: true,
				speed: 300,
				detach: false
			});

		// Prioritize "important" elements on mobile.
			skel.on('+mobile -mobile', function() {
				$.prioritize(
					'.important\\28 mobile\\29',
					skel.breakpoint('mobile').active
				);
			});

		// Off-Canvas Navigation.

			// Title Bar.
				$(
					'<div id="titleBar">' +
						'<a href="#navPanel" class="toggle"></a>' +
						'<span class="title">' + $('#logo').html() + '</span>' +
					'</div>'
				)
					.appendTo($body);

			// Navigation Panel.
				$(
					'<div id="navPanel">' +
						'<nav>' +
							$('#nav').navList() +
						'</nav>' +
					'</div>'
				)
					.appendTo($body)
					.panel({
						delay: 500,
						hideOnClick: true,
						hideOnSwipe: true,
						resetScroll: true,
						resetForms: true,
						side: 'left',
						target: $body,
						visibleClass: 'navPanel-visible'
					});

			// Fix: Remove navPanel transitions on WP<10 (poor/buggy performance).
				if (skel.vars.os == 'wp' && skel.vars.osVersion < 10)
					$('#titleBar, #navPanel, #page-wrapper')
						.css('transition', 'none');

	});

	$('registration').ready((e) => { 
			
       $(this).html( `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
         <h3 class="card-title"> Image</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">
         	
				<div class="form-group row">
						<label for="Image-id" class="form-label col-sm-2">Image ID</label>
  					<div class="col-sm-10">
						<input type="text" class="form-control" name="image_id" id="image-id" value="" placeholder="ID" disabled="disabled" >
					</div>
				</div>
				
        <div class="form-group row">
          <label class="col-sm-2" for="image-name">Image Name</label>
         <div class="col-sm-10"> <input type="text" name="image_name" class="form-control" id="image-name" placeholder="Image Name" value=""></div>
         </div>
     		<div class="form-group row">
						<label class="form-label col-md-2" for="image-type">Image Type</label>
					<div class="col-md-10">
						<select  name="image_type" id="image-type" class="form-control select2" style="width: 100%;">
						</select>
					</div>
				</div>    
      
      <div class="form-group row">
        <label for="image-dimensions" class="form-label col-sm-2">Image Dimensions</label>
        <div class="col-sm-10"><input type="text" class="form-control " id="image-dimensions" name="image_dimensions" placeholder="" value="${dimensions}"></div>
      </div>
				<div class="form-group row">
					<div class="col-md-2">  <label for="image-file">Image File</label> 
					</div>
					<div class="col-md-10"> 
						<div class="input-group">
							<div class="custom-file">
								<input type="file" class="custom-file-input form-control-lg" accept="" id="image-file" name="image_file">
								<label class="custom-file-label" for="image-file" id="image-label"></label>
							</div>
						</div>
					</div>
				</div>
          </div>
          <div class="card-footer">
            <button type="cancel" class="btn btn-default float-left" id="image-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="image-submit-btn">Submit</button>
          </div>
        </form>
      </div></div></div>`
      );


	})

})(jQuery);