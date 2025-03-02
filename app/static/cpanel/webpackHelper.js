//import './favicon.ico'
import './logo192.png' 
import './manifest.json'
import './dist/css/sourcesanspro.css'
import './plugins/fontawesome-free/css/all.min.css'
import './dist/css/ionicons.min.css'
import './plugins/tempusdominus-bootstrap-4/css/tempusdominus-bootstrap-4.min.css' 
import './plugins/icheck-bootstrap/icheck-bootstrap.min.css'
import './plugins/jqvmap/jqvmap.min.css'
import './dist/css/adminlte.min.css'
import './plugins/overlayScrollbars/css/OverlayScrollbars.min.css'
import './plugins/daterangepicker/daterangepicker.css'
import './plugins/summernote/summernote-bs4.min.css'
import './plugins/datatables-bs4/css/dataTables.bootstrap4.min.css'
import './css/datatable.css'
import './css/datatable-responsive.css'
import './css/datatable-buttons.css'


import( './plugins/jquery/jquery.min.js')
import('./plugins/jquery-ui/jquery-ui.min.js')
import('./plugins/bootstrap/js/bootstrap.bundle.min.js')
import('./plugins/moment/moment.min.js')
import('./plugins/chart.js/Chart.min.js')
import('./plugins/sparklines/sparkline.js')
import('./plugins/jqvmap/jquery.vmap.min.js')
import('./plugins/jqvmap/maps/jquery.vmap.usa.js')
import('./plugins/jquery-knob/jquery.knob.min.js')
import('./plugins/daterangepicker/daterangepicker.js')
import('./plugins/tempusdominus-bootstrap-4/js/tempusdominus-bootstrap-4.min.js')
import('./plugins/summernote/summernote-bs4.min.js')
import('./plugins/overlayScrollbars/js/jquery.overlayScrollbars.min.js')
import('./dist/js/adminlte.js')
import('./dist/js/demo.js')
import('./dist/js/pages/dashboard.js')	
import('./dist/custom/js/data/pouchdb.js')
import('./dist/custom/js/data/pouchdb.find.js')
import('./plugins/datatables/jquery.dataTables.min.js')
import('./plugins/datatables-bs4/js/dataTables.bootstrap4.min.js')
import('./plugins/datatables-responsive/js/dataTables.responsive.min.js')
import('./plugins/datatables-responsive/js/responsive.bootstrap4.min.js')
import('./plugins/datatables-buttons/js/dataTables.buttons.min.js')
import('./plugins/datatables-buttons/js/buttons.bootstrap4.min.js')
import('./plugins/jszip/jszip.min.js')
import('./plugins/pdfmake/pdfmake.min.js')
import('./plugins/pdfmake/vfs_fonts.js')
import('./plugins/datatables-buttons/js/buttons.html5.min.js')
import('./plugins/datatables-buttons/js/buttons.print.min.js')
import('./plugins/datatables-buttons/js/buttons.colVis.min.js')
import('./plugins/select2/js/select2.full.min.js')
import('./plugins/bootstrap4-duallistbox/jquery.bootstrap-duallistbox.min.js')
import('./plugins/moment/moment.min.js')
import('./plugins/inputmask/jquery.inputmask.min.js')
import('./dist/js/custom/base.js')
import('./dist/js/custom/wblestertoolkit.js')
import('./dist/custom/js/main.js')

const head = document.head;
const body = document.body

 const addLink = (rel="stylesheet", href, type= "text/css") =>{
	  let link = document.createElement("link");
	  link.href = href;
	  link.type = type;
	  link.rel =  rel;
	  head.appendChild(link);
}
 
const addMeta  = ( opts) =>{
 let meta = document.createElement("meta"); 
 let charset = opts?.charset? opts.charset: null;
 let content = opts?.content? opts.content: null;
 let name	 = opts?.name? opts.name: null;
 
  if(charset){
	  meta.charset = charset
	  
  }
  if(content){
	  meta.content = content
  }
  if(name){
	  meta.name = name
  }
 head.appendChild(meta);
 
}

const addScript= (src, scriptBody=null,type="text/javascript")=>{
	let script   =  document.createElement("script");
	script.type  =  type;
	if(src){ 
		script.src = src;
	}
	if (scriptBody){
		let scriptContents = document.createTextNode(scriptBody);
        script.appendChild(scriptContents)
	}
	body.appendChild(script);	
}

addMeta({"charset":"utf-8"})
addMeta({"name":"viewport", "content":"width=device-width, initial-scale=1"})
addMeta({"name":"theme-color", "content":"#000000"})
addMeta({"name":"description", "content":"WBLESTER Reports and Analytics Platform"})

// addLink('icon','./favicon.ico', 'image/vnd.microsoft.icon')
// addLink('apple-touch-icon','./logo192.png', 'image/vnd.microsoft.icon')
// addLink('manifest','./manifest.json', 'application/json')
// addLink('stylesheet','./dist/css/sourcesanspro.css', 'text/css')
// addLink('stylesheet','./plugins/fontawesome-free/css/all.min.css', 'text/css')
// addLink('stylesheet','./dist/css/ionicons.min.css', 'text/css')
// addLink('stylesheet','./plugins/tempusdominus-bootstrap-4/css/tempusdominus-bootstrap-4.min.css', 'text/css')
// addLink('stylesheet','./plugins/icheck-bootstrap/icheck-bootstrap.min.css', 'text/css')
// addLink('stylesheet','./plugins/jqvmap/jqvmap.min.css', 'text/css')
// addLink('stylesheet','./dist/css/adminlte.min.css', 'text/css')
// addLink('stylesheet','./plugins/overlayScrollbars/css/OverlayScrollbars.min.css', 'text/css')
// addLink('stylesheet','./plugins/daterangepicker/daterangepicker.css', 'text/css')
// addLink('stylesheet','./plugins/summernote/summernote-bs4.min.css', 'text/css')
// addLink('stylesheet','./plugins/datatables-bs4/css/dataTables.bootstrap4.min.css', 'text/css')
// addLink('stylesheet','./css/datatable.css', 'text/css')
// addLink('stylesheet','./css/datatable-responsive.css', 'text/css')
// addLink('stylesheet','./css/datatable-buttons.css', 'text/css')

body.className = "hold-transition sidebar-mini"
let noScript = document.createElement("noscript");
noScript.innerHTML = "You need to enable JavaScript to run this app"
body.appendChild(noScript)
let wrapperDiv          = document.createElement("div")
wrapperDiv.className    = "wrapper"
wrapperDiv.setAttribute("id","index-root")
body.appendChild(wrapperDiv)

// let modalSpan = document.createElement('span')
// modalSpan.innerHTML= (`{% include "main/modal.html" %}`);
// body.appendChild(modalSpan);

// addScript('./plugins/jquery/jquery.min.js')
// addScript('./plugins/jquery-ui/jquery-ui.min.js')

addScript(null, "$.widget.bridge('uibutton', $.ui.button)")

// addScript('./plugins/bootstrap/js/bootstrap.bundle.min.js')
// addScript('./plugins/chart.js/Chart.min.js')
// addScript('./plugins/sparklines/sparkline.js')
// addScript('./plugins/jqvmap/jquery.vmap.min.js')
// addScript('./plugins/jqvmap/maps/jquery.vmap.usa.js')
// addScript('./plugins/jquery-knob/jquery.knob.min.js')
// addScript('./plugins/moment/moment.min.js')
// addScript('./plugins/daterangepicker/daterangepicker.js')
// addScript('./plugins/tempusdominus-bootstrap-4/js/tempusdominus-bootstrap-4.min.js')
// addScript('./plugins/summernote/summernote-bs4.min.js')
// addScript('./plugins/overlayScrollbars/js/jquery.overlayScrollbars.min.js')
// addScript('./dist/js/adminlte.js')
// addScript('./dist/js/demo.js')
// addScript('./dist/js/pages/dashboard.js')

const scriptText = `const config = {{ dataConfig | tojson | safe }}
const defaultComponents = {{ defaultComponents| tojson | safe }}
window.config = JSON.parse(config)
window.defaultComponents = JSON.parse(defaultComponents)`;	
addScript(null, scriptText)


// addScript('./dist/custom/js/data/pouchdb.js')
// addScript('./dist/custom/js/data/pouchdb.find.js')
// addScript('./plugins/datatables/jquery.dataTables.min.js')
// addScript('./plugins/datatables-bs4/js/dataTables.bootstrap4.min.js')
// addScript('./plugins/datatables-responsive/js/dataTables.responsive.min.js')
// addScript('./plugins/datatables-responsive/js/responsive.bootstrap4.min.js')
// addScript('./plugins/datatables-buttons/js/dataTables.buttons.min.js')
// addScript('./plugins/datatables-buttons/js/buttons.bootstrap4.min.js')
// addScript('./plugins/jszip/jszip.min.js')
// addScript('./plugins/pdfmake/pdfmake.min.js')
// addScript('./plugins/pdfmake/vfs_fonts.js')
// addScript('./plugins/datatables-buttons/js/buttons.html5.min.js')
// addScript('./plugins/datatables-buttons/js/buttons.print.min.js')
// addScript('./plugins/datatables-buttons/js/buttons.colVis.min.js')
// addScript('./plugins/select2/js/select2.full.min.js')
// addScript('./plugins/bootstrap4-duallistbox/jquery.bootstrap-duallistbox.min.js')
// addScript('./plugins/moment/moment.min.js')
// addScript('./plugins/inputmask/jquery.inputmask.min.js')
// addScript('./dist/js/custom/base.js')
// addScript('./dist/js/custom/wblestertoolkit.js',null, "module")
// addScript('./dist/custom/js/main.js',null, "module")


  



 