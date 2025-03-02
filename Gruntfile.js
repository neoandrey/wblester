module.exports = function (grunt) {

   /* Project configuration.
   * 1. Copy files referenced in the index.html page to staging.Files with 'custom' in their directory structure and images go directly to the static folder
   * 2. Minify CSS files except those that have already been minified
   * 3. Uglify JS files except core libraries like Jquery,moment,chart,etc., and those that have already been minified. JS file that use Require, import and export should not be uglified or concatenated. 
   * 4. Concatenate core library files into a single file
   * 
   */
   grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      copy: {
         main: {

            files: [
               { src: ['app/static/dist/css/adminlte.min.css'], dest: 'app/staging/dist/css/adminlte.min.css' }
               , { src: ['app/static/plugins/tempusdominus-bootstrap-4/css/tempusdominus-bootstrap-4.min.css'], dest: 'app/staging/dist/css/tempusdominus-bootstrap-4/tempusdominus-bootstrap-4.min.css' }
               , { src: ['app/static/plugins/icheck-bootstrap/icheck-bootstrap.min.css'], dest: 'app/staging/dist/css/icheck-bootstrap/icheck-bootstrap.min.css' }
               , { src: ['app/static/plugins/overlayScrollbars/css/OverlayScrollbars.min.css'], dest: 'app/staging/dist/css/overlayScrollbars/OverlayScrollbars.min.css' }
               , { src: ['app/static/plugins/daterangepicker/daterangepicker.css'], dest: 'app/staging/dist/css/daterangepicker/daterangepicker.css' }
               , { src: ['app/static/plugins/datatables-bs4/css/dataTables.bootstrap4.min.css'], dest: 'app/staging/dist/css/datatables-bs4/dataTables.bootstrap4.min.css' }
               , { src: ['app/static/css/datatable.css'], dest: 'app/staging/dist/css/datatable.css' }
               , { src: ['app/static/plugins/jqvmap/jqvmap.min.css'], dest: 'app/staging/dist/css/jqvmap/jqvmap.min.css' }
               , { src: ['app/static/css/datatable-responsive.css'], dest: 'app/staging/dist/css/datatable-responsive.css' }
               , { src: ['app/static/css/datatable-buttons.css'], dest: 'app/staging/dist/css/datatable-buttons.css' }
               , { src: ['app/static/dist/css/sourcesanspro.css'], dest: 'app/staging/dist/css/sourcesanspro.css' }
               , { src: ['app/static/dist/css/ionicons.min.css'], dest: 'app/staging/dist/css/ionicons.min.css' }
               , { src: ['app/static/plugins/summernote/summernote-bs4.min.css'], dest: 'app/staging/dist/css/summernote/summernote-bs4.min.css' }
               , { src: ['app/static/plugins/fontawesome-free/**'], dest: 'app/staging/dist/css/fontawesome-free/css/all.min.css', filter: 'isFile' }

               , { src: ['app/static/dist/img/AdminLTELogo.png'], dest: 'app/dist/static/img/AdminLTELogo.png' }
               , { src: ['app/static/plugins/jquery/jquery.min.js'], dest: 'app/staging/dist/js/jquery/jquery.min.js' }
               , { src: ['app/static/plugins/jquery-ui/jquery-ui.js'], dest: 'app/staging/dist/js/jquery-ui/jquery-ui.js' }
               , { src: ['app/static/plugins/jqvmap/jquery.vmap.js'], dest: 'app/staging/dist/js/jqvmap/jquery.vmap.js' }
               , { src: ['app/static/plugins/jqvmap/maps/jquery.vmap.usa.js'], dest: 'app/staging/dist/js/jqvmap/maps/jquery.vmap.usa.js' }
               , { src: ['app/static/plugins/overlayScrollbars/js/jquery.overlayScrollbars.js'], dest: 'app/staging/dist/js/overlayScrollbars/jquery.overlayScrollbars.js' }
               , { src: ['app/static/plugins/moment/moment.min.js'], dest: 'app/staging/dist/js/moment/moment.min.js' }
               , { src: ['app/static/plugins/summernote/summernote-bs4.js'], dest: 'app/staging/dist/js/summernote/summernote-bs4.js' }
               , { src: ['app/static/plugins/bootstrap/js/bootstrap.bundle.js'], dest: 'app/staging/dist/js/bootstrap/js/bootstrap.bundle.js' }
               , { src: ['app/static/plugins/tempusdominus-bootstrap-4/js/tempusdominus-bootstrap-4.js'], dest: 'app/staging/dist/js/tempusdominus-bootstrap-4/tempusdominus-bootstrap-4.js' }
               , { src: ['app/static/plugins/bootstrap4-duallistbox/jquery.bootstrap-duallistbox.js'], dest: 'app/staging/dist/js/jbootstrap4-duallistbox/jquery.bootstrap-duallistbox.js' }
               , { src: ['app/static/plugins/chart.js/Chart.js'], dest: 'app/staging/dist/js/chartjs/Chart.js' }
               , { src: ['app/static/plugins/sparklines/sparkline.js'], dest: 'app/staging/dist/js/sparklines/sparkline.js' }
               , { src: ['app/static/plugins/select2/js/select2.full.js'], dest: 'app/staging/dist/js/select2/select2.full.js' }
               , { src: ['app/static/plugins/inputmask/jquery.inputmask.js'], dest: 'app/staging/dist/js/inputmask/jquery.inputmask.js' }
               , { src: ['app/static/plugins/jquery-knob/jquery.knob.min.js'], dest: 'app/staging/dist/js/jquery-knob/jquery.knob.min.js' }
               , { src: ['app/static/plugins/daterangepicker/daterangepicker.js'], dest: 'app/staging/dist/js/daterangepicker/daterangepicker.js' }
               , { src: ['app/static/dist/js/adminlte.js'], dest: 'app/staging/dist/js/adminlte.js' }
               , { src: ['app/static/dist/js/demo.js'], dest: 'app/staging/dist/js/demo.js' }
               , { src: ['app/static/dist/js/pages/dashboard.js'], dest: 'app/staging/dist/js/pages/dashboard.js' }
               , { src: ['app/static/dist/custom/js/data/pouchdb.js'], dest: 'app/staging/dist/js/data/pouchdb.js' }
               , { src: ['app/static/dist/custom/js/data/pouchdb.find.js'], dest: 'app/staging/dist/js/data/pouchdb.find.js' }
               , { src: ['app/static/plugins/datatables/jquery.dataTables.js'], dest: 'app/staging/dist/js/datatables/jquery.dataTables.js' }
               , { src: ['app/static/plugins/datatables-bs4/js/dataTables.bootstrap4.js'], dest: 'app/staging/dist/js/datatables-bs4/dataTables.bootstrap4.js' }
               , { src: ['app/static/plugins/datatables-buttons/js/buttons.print.js'], dest: 'app/staging/dist/js/datatables-buttons/buttons.print.js' }
               , { src: ['app/static/plugins/datatables-responsive/js/dataTables.responsive.js'], dest: 'app/staging/dist/js/datatables-responsive/dataTables.responsive.js' }
               , { src: ['app/static/plugins/datatables-responsive/js/responsive.bootstrap4.js'], dest: 'app/staging/dist/js/datatables-responsive/responsive.bootstrap4.js' }
               , { src: ['app/static/plugins/datatables-buttons/js/dataTables.buttons.js'], dest: 'app/staging/dist/js/dataTables.buttons.js' }
               , { src: ['app/static/plugins/datatables-buttons/js/buttons.bootstrap4.js'], dest: 'app/staging/dist/js/buttons.bootstrap4.js' }
               , { src: ['app/static/plugins/jszip/jszip.js'], dest: 'app/staging/dist/js/jszip/jszip.js' }
               , { src: ['app/static/plugins/pdfmake/pdfmake.js'], dest: 'app/staging/dist/js/pdfmake/pdfmake.js' }
               , { src: ['app/static/plugins/pdfmake/vfs_fonts.js'], dest: 'app/staging/dist/js/pdfmake/vfs_fonts.js' }
               , { src: ['app/static/plugins/datatables-buttons/js/buttons.html5.js'], dest: 'app/staging/dist/js/datatables-buttons/js/buttons.html5.js' }
               , { src: ['app/static/plugins/datatables-buttons/js/buttons.colVis.js'], dest: 'app/staging/dist/js/datatables-buttons/js/buttons.colVis.js' }

               , { src: ['app/static/dist/js/custom/FormValidator.js'], dest: 'app/dist/static/js/custom/FormValidator.js' }
               , { src: ['app/static/dist/js/custom/Serializer.js'], dest: 'app/dist/static/js/custom/Serializer.js' }
               , { src: ['app/static/dist/js/custom/Table.js'], dest: 'app/dist/static/js/custom/Table.js' }
               , { src: ['app/static/dist/js/custom/Form.js'], dest: 'app/dist/static/js/custom/Form.js' }
               , { src: ['app/static/dist/js/custom/FormElement.js'], dest: 'app/dist/static/js/custom/FormElement.js' }
               , { src: ['app/static/dist/js/custom/base.js'], dest: 'app/dist/static/js/custom/base.js' }
               , { src: ['app/static/dist/custom/**'], dest: 'app/dist/static/js/custom/', filter: 'isFile' }
               , { src: ['app/static/dist/js/custom/wblestertoolkit.js'], dest: 'app/dist/static/js/custom/wblestertoolkit.js' }


               , {
                  src: ['app/static/logo_mini.png'], dest: 'app/dist/static/logo_mini.png'
               }
               , { src: ['app/static/logo.png'], dest: 'app/dist/static/logo.png' }
               , { src: ['app/static/logo50_small.png'], dest: 'app/dist/static/logo50_small.png' }
               , { src: ['app/static/logo50.png'], dest: 'app/dist/static/logo50.png' }
               , { src: ['app/static/logo192.png'], dest: 'app/dist/static/logo192.png' }
               , { src: ['app/static/logo512.png'], dest: 'app/dist/static/logo512.png' }
               , { src: ['app/static/manifest.json'], dest: 'app/dist/static/manifest.json' }
               , { src: ['app/static/robots.txt'], dest: 'app/dist/static/robots.txt' }
               , { src: ['app/static/sw.js'], dest: 'app/dist/static/sw.js' }


            ],
            options: {
               process: function (content, srcpath) {
                  return content.replace(/static\/dist\/custom/g, "static/js/custom/app/static");
               }
            },
         }
      },
      cssmin: {
         target: {
            files: [{
               src: ['app/staging/dist/css/**/*.css', '!*.min.css'],
               dest: 'app/dist/static/css/wblester-css.css'
            }]
         }
      }
      ,
      uglify: {
         options: {
            banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            , sourceMap: true
            , compress: true
            , sourceMapPrefix: "app/staging/dist/js/wblester-sourcemap-1"
            , reserveDOMProperties: true
            , mangle: {
               reserved: ['Buttons', 'Chart', 'jQuery', 'LokiJS', 'Backbone', 'moment', 'datatables', 'datatables-bs4', 'datatables-buttons', 'datatables-responsive', 'pouchdb', 'PouchDB', 'summernote', 'knob', 'DataTable']
               , properties: false
            }
         },
         target: {

            src: ['app/staging/dist/js/**/*.js', '!app/staging/dist/js/datatables/**/*.js', '!app/staging/dist/js/daterangepicker/*', '!app/staging/dist/js/buttons.bootstrap4/*', '!app/staging/dist/js/moment/*', '!app/staging/dist/js/dataTables.buttons.js', '!app/staging/dist/js/jquery/*.js', '!app/staging/dist/js/datatable/*.js', '!app/staging/dist/js/data/*pouch*', '!app/staging/dist/js/custom/*.js', '!app/staging/dist/js/custom/*/**', '!*.min.js'],
            dest: 'app/dist/static/js/wblester-splmt-lib.min.js'

         }
      }, concat: {

         options: {
            options: {
               separator: ';',
            }
         },
         build: {
            src: [
               'app/staging/dist/js/jquery/jquery.min.js'
               , 'app/staging/dist/js/jquery-ui/jquery-ui.js'
               , 'app/staging/dist/js/chartjs/Chart.js'
               , 'app/staging/plugins/jqvmap/maps/jquery.vmap.usa.js'
               , 'app/staging/dist/js/bootstrap/js/bootstrap.bundle.js'
               , 'app/staging/dist/js/moment/moment.min.js'
               , 'app/staging/dist/js/daterangepicker/daterangepicker.js'
               , 'app/staging/dist/js/data/pouchdb.js'
               , 'app/staging/dist/js/data/pouchdb.find.js'
               , 'app/staging/dist/js/datatables/jquery.dataTables.js'
               , 'app/staging/dist/js/dataTables.buttons.js'
               , 'app/staging/dist/js/datatables-buttons/js/buttons.html5.js'
               , 'app/staging/dist/js/datatables-buttons/buttons.print.js'
               , 'app/staging/dist/js/datatables-buttons/js/buttons.colVis.js'
            ]
            , dest: 'app/dist/static/js/wblester-core-lib.js'
         }
      }
   });

   // Load the plugin that provides the "uglify" task.
   //grunt.loadNpmTasks('grunt-contrib-uglify');
   //grunt.loadNpmTasks('grunt-contrib-cssmin');
   //grunt.loadNpmTasks('grunt-contrib-concat');
   grunt.loadNpmTasks('grunt-contrib-copy');
   grunt.loadNpmTasks('grunt-contrib-cssmin');
   grunt.loadNpmTasks('grunt-contrib-uglify');
   grunt.loadNpmTasks('grunt-contrib-concat');


   // Default task(s).
   grunt.registerTask('default', ['copy', 'cssmin', 'uglify', 'concat']);

};