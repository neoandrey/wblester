import { RequestHandler, Preloader, Navbar, Sidebar ,ContentHeader, Footer,DisplayManager,DataSynchronizer,DashboardTable } from './lib.js';

const forceOnlineFetch  = window.config.syncMode=="LOCAL"?false:true;
let currentUser = null;

if (Object.keys(window.defaultComponents).includes('currentUser')){ 
     currentUser = window.defaultComponents.currentUser;
}
const currentUserRoleID = currentUser?currentUser.roleID:2;
const syncInterval = window.config.syncInterval
const syncMode     = window.config.syncMode
const dataSynchronizer = new DataSynchronizer();
new DisplayManager()
window.DisplayManager = DisplayManager; // Workaround for RequestHandler importing DisplayManager
window.dataSynchronizer = dataSynchronizer; // Workaround for RequestHandler importing DataSynchronizer
const defaultVersionMap = {}
window.syncID = -1
window.requestHandler = new RequestHandler();
const config = window.config
const appConfig  = window.appConfig
//window.isUpdateRunning= false
let  dashWorker = null;
let syncWorker = null;
window.tableMap = {};
const dbName = config.lokiDBDatabase + '.db'
window.columnOrder = {}
let excludedLokiFields = ["_id", "meta", "$loki", "current_version","_cls","contents"];

const idbAdapter = new LokiIndexedAdapter();
const pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: false }); // Paging here creates inconsistencies for this purpose. table updates don't reflect when required.
let db = new loki(dbName, {
  adapter: pa
});
//console.log(`main database name: ${dbName}`)
$.fn.databaseInitialize = () => {
  let dbCollections = db.collections;
  window.config.syncInfo.cpanel.filter((x => !dbCollections.includes(x.collectionName))).forEach((collection) => {
    db.addCollection(collection.collectionName, {
      indices: [collection.matchingFields, collection.watchedFields, collection.idField, 'created_datetime','last_modified_date','current_version']
      , autoupdate: true
      , unique: [collection.idField]
    });

  });
  
  window.config.syncInfo.cpanel.forEach((collection) => {
    window.tableMap[collection.collectionName] = db.getCollection(collection.collectionName);
  })
}

$.fn.getCurrentUser = ()=>{ 
  return currentUser;
}

/* Why clear interval/ */
// const interval_id = window.setInterval(function(){}, Number.MAX_SAFE_INTEGER);
// for (let i = 1; i < interval_id; i++) {
//   window.clearInterval(i);
// }

$.fn.refreshDisplay = () => {

    idbAdapter = new LokiIndexedAdapter();
    pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: false });
    db = new loki(dbName, { adapter: pa });
    db.loadDatabase({}, function (err) {
      $.fn.databaseInitialize();
     // console.log(`DisplayManager.lastRunFunction:${DisplayManager.lastRunFunction}`)
      eval(DisplayManager.lastRunFunction);
    });
  
  
}

$.fn.getGoogleUrl = (rawUrl)=>{
  let googleID = '';
  let googleURL = rawUrl
   if (rawUrl !="" && rawUrl.includes("?")){
	   let urlComponents = rawUrl.split("/");
	   urlComponents.pop()
     googleID = urlComponents.pop()
     googleURL = `https://lh3.googleusercontent.com/d/${googleID}`
     //googleURL =  `https://drive.google.com/uc?id=${googleID}`
     
   }
  return googleURL 
}

const acceptedFormats = [];
if ($.fn.getObjectType(appConfig["image_formats"]) != "object") { 
  appConfig["image_formats"] = appConfig["image_formats"];
}
for (let imgFormat of appConfig["image_formats"]) { 
      acceptedFormats.push(`.${imgFormat}`)
}

if (Object.keys(DisplayManager.collectionVersionMap).length > 0) {
  window.config.syncInfo.cpanel.forEach((collection) => { defaultVersionMap[collection.collectionName] = 0 })
  DisplayManager.collectionVersionMap = defaultVersionMap;
}

    
/**
 * ==============================================================================================================
 * 
 * Section for utility functions
 * 
 * ===============================================================================================================
 */


$.fn.capitalize = (str) => {
  /** 
   * Changes the first letter in a string to capital
   **/
  
  return  str.charAt(0).toUpperCase() + str.slice(1);
}


$.fn.showText = (id, test) => {
  alert(test + ' ' + id)
}

function isOnline() {
  return window.navigator.onLine;
}

function startSync() {

  if (window.syncID === -1) {

    window.syncID = setInterval(() => {

      if (isOnline()) {
      
        let fetchUrl = window.config.mongoBridgeURL + `cpanel&acky=${currentUser.acky}`;
        DataSynchronizer.runGet(fetchUrl, DataSynchronizer.getLocalTableVersion, { 'collectionSyncInfo': window.config.syncInfo.cpanel });
      }

    }, syncInterval)


  } else if (window.syncID !== -1) {

    //console.log("Data sync is already running");

  }


}

$.fn.isValidFile = (elementID) => {
  let files = document.getElementById(elementID).files;
  //console.log("files", files);
  if (files) {
      //console.log(files[0])
      let filePath = files[0]?.name;
      let fileSize  = files[0]?.size;
      const maxSize = window.appConfig.max_content_length;
      //console.log("fileType", fileType)
	  
      if (filePath && filePath.indexOf('.') > -1) {
        
        let validFileFormats = window.appConfig["file_formats"];
        window.appConfig.image_formats.forEach((imgFormat) => {
              validFileFormats.push(imgFormat);
      })
      let fileExtension = filePath.split(".").splice(-1)[0].toLowerCase();
      return validFileFormats.map((fileFormat) => fileFormat.toLowerCase()).includes(fileExtension) && (maxSize > fileSize );

      } else {
        return false;
      }
  }
  return false;
}

$.fn.isValidImage = (elementID) => {
  let files = document.getElementById(elementID).files;
  if (files){
      let imagePath = files[0]?.name;
      let imgType = files[0]?.type;
      if (imgType && imgType != "" && imgType.split('/')[0] !== "image") {
        return false;
      }
      if (imagePath && imagePath.indexOf('.') > -1) {
        let validImageFormats = window.appConfig["image_formats"] && typeof window.appConfig["image_formats"] !="string"?window.appConfig["image_formats"] :JSON.parse(window.appConfig["image_formats"])
        let imageExtension = imagePath.split(".").splice(-1)[0].toLowerCase()
        return validImageFormats.map((imgFormat)=>imgFormat.toLowerCase()).includes(imageExtension)
      } else {
        return false;
      }
}

}
$.fn.isAlphaNumSpecial = (fieldValue)=>{
  let pattern      =  /^[ A-Za-z0-9_@./:,#&+\s-]*$/i
  let matchDetails =  fieldValue && fieldValue.match(pattern)
  if (matchDetails && matchDetails.length> 0){
   return true
  }else {
   return false
  }

}
$.fn.isNumeric = (field) => {

    var numbers = /^[\d,\d.\d]+$/m;
    if (field.match(numbers)) {
        return true;
    } else {
        return false;
    }
}
$.fn.getDateFromObject =(dateObject) =>{
   let dateString =  dateObject;
    if(Object.keys( dateObject ).indexOf('$date') > -1){
      dateString = new Date(dateObject['$date']).toISOString();
   }
   return dateString;
}
$.fn.isFieldValid = (element, buttonID, siblingIDs) => {
  
  let value = $(element).val().trim();
  
  if (value === "" || !$.fn.isAlphaNumSpecial(value)) {
    
    $(element).addClass('is-invalid')
    $('#' + buttonID).attr('disabled', 'disabled')
    
  } else {
    
    $(element).removeClass('is-invalid');
    let validCount = siblingIDs.length;
    
     for (let id of siblingIDs){

         if($('#'+id).hasClass('is-invalid') ){
            --validCount;
         }

     }
    if (validCount == siblingIDs.length) { 
        
      $('#' + buttonID).removeAttr('disabled');

      }
  }

}
$.fn.isValidJSON = (elementID, value, bttnID=null) => {
  let isJsonValid = true;
  try {
    
    JSON.parse(value)
    let classList = $(elementID).attr('class') 
    if (classList.indexOf('is-invalid') > -1) {
      $(elementID).removeClass('is-invalid')
      $(elementID).addClass('is-valid')
      if (bttnID) {
        $(bttnID).removeAttr('disabled', 'disabled')
      }
    }
    

  } catch (e) { 
    isJsonValid = false;
    $(elementID).addClass('is-invalid')
  if (bttnID) { $(bttnID).attr('disabled', 'disabled') }

  }
  return isJsonValid;
} 
$.fn.isValidURL= (value)=> {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(value);
}
$.fn.cancelDialog = () => { 
  
  if(event){ 
      event.preventDefault();
  }
  $.fn.closeDialog();
  $.fn.resetModal();
}
$.fn.highlightSidebar = (objectType) =>{ 
    let navLinks = (document.querySelectorAll('.nav-link'))
    navLinks.forEach((link) => { 
      if (link.id.toLowerCase() !=="manage") {
          link.classList.remove("active")
      }
    })
  if (objectType.toLowerCase() == 'sitesettings') {
      $('.page-title').text('Site Settings')
  }else if (objectType.toLowerCase() == 'teammembers') {
      $('.page-title').text('Team Members')
  }else if (objectType.toLowerCase() == 'mailtemplates') {
      $('.page-title').text('Mail Templates')
  }else if (objectType.toLowerCase() == 'servicetypes') {
      $('.page-title').text('Service Types')
  }else if (objectType.toLowerCase() == 'audittrail') {
      $('.page-title').text('Audit Trail')
  }else if (objectType.toLowerCase() == 'eventypes') {
      $('.page-title').text('Event Types')
}else if (objectType.toLowerCase() == 'eventtriggers') {
      $('.page-title').text('Event Triggers')
}else if (objectType.toLowerCase() == 'dashboard') {
      $('.page-title').text('Client Statistics')
}else if (objectType.toLowerCase() == 'pagetemplates') {
      $('.page-title').text('Page Templates')
}else{ 
      $('.page-title').text($.fn.capitalize(objectType))
}
  
  let currentPage = DisplayManager.currentTab;
  const sidebarPositionMap = currentPage.toLowerCase() == 'configurations' ? {
    "sitesettings": 0
        ,"roles": 1
        ,"users": 2
        ,"mailaccounts": 3
        ,"mailtemplates": 4
        , "eventtypes": 5
        , "events": 6
        , "schedules": 7
        , "eventtriggers": 8
        ,"jobs": 9
        ,"audittrail": 10
  } : currentPage.toLowerCase() == 'components' ? {
      "images": 0
      , "files": 1
      , 'banners': 2
         ,'sliders':3
      , "pagetemplates": 4
      , "pages": 5
     // , "sections": 4
     
  }: {
      
      "dashboard":0
      ,"feedback":1
      , "ratings": 2
      ,"messages":3
      ,"faqs":4
  }
  
  const position = sidebarPositionMap[objectType];
  $('#sidebarnav-node-' + position + '-link').addClass("active");
  $.fn.highlightNavHeader(DisplayManager.currentTab); 
}
$.fn.sortObject=(obj)=> {
  return Object.keys(obj).sort().reduce(function (result, key) {
      result[key] = obj[key];
      return result;
  }, {});
}
$.fn.checkForUpdates = (oldData, newData)=>{ 

	let dashDataUpdated = false;
	if (!oldData || (oldData.length != newData.length)){
	  	dashDataUpdated = true;
	}

	if(!dashDataUpdated){

		      for (let i in  oldData){
            let oldMetaRecords  = oldData[i]
  
            let newMetaRecords  = newData.filter((record)=> record['_id']==oldMetaRecords['_id'])
            if(newMetaRecords.length == 0){
              dashDataUpdated =true;
              break
            }else{
              newMetaRecords = newMetaRecords[0]
            }
            for( let k of Object.keys(oldMetaRecords)){
              //console.log(k)
             // console.log(oldMetaRecords[k])
             // console.log(newMetaRecords[k])
              if (k !== 'records' && oldMetaRecords[k].length >0 && oldMetaRecords[k] != newMetaRecords[k] ){
                dashDataUpdated = true;
                break;
              }else if (k == 'records'){
                    for(let j in oldMetaRecords[k]){
                       //console.log(j)
                      // console.log(oldMetaRecords[k][j])
                       let oldReportRecords = oldMetaRecords[k][j]

                       let newReportRecords = oldMetaRecords[k].filter((record)=> record['_id']==oldReportRecords['_id'])
                       if(newReportRecords.length== 0){
                            dashDataUpdated =True;
                            break
                       }else{

                        newReportRecords=newReportRecords[0]
                       }


                       for(let l of Object.keys(oldReportRecords)){
                          if(oldReportRecords[l]!==newReportRecords[l]){
                            dashDataUpdated = true;
                            break;
                          }

                       }
                        if(dashDataUpdated){
                          break;
                        }
                                    
                        }
        
        
        
              }


              if(dashDataUpdated){
                break;
              }
            }
            if(dashDataUpdated){
              break;
            }


		      }

	}
	return dashDataUpdated
}
$.fn.syncLokiCollection = (collectionName, callback) => {
  const updateSet = new Set()
  updateSet.add(collectionName);
  let updateCount = 0;
  let fetchUrl = `/cpanel/sync/cpanel/${collectionName}?acky=${currentUser.acky}`;
  let xmlhttp = new XMLHttpRequest();
  let updateQuery = {}
  xmlhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
              let results = JSON.parse(this.responseText);           
           
              if (results && Object.keys(results).length > 0 && !Object.keys(results).includes("message")) {
                  
                Object.keys(results).forEach((tableName) => {
                  
                  try{
                  updateQuery[tableName] = []
                  let liveTableData = results[tableName];
                  let localTableData = window.tableMap[tableName] && Object.keys(window.tableMap[tableName]).includes('data') ? tableMap[tableName].data : [];
                  let idField = window.config.syncInfo.cpanel.filter((table) => table.collectionName.toLowerCase() == tableName.toLowerCase())[0]['idField']
                  let localIdList = localTableData.map((record) => { return record[idField] })
                  let liveIdList = liveTableData.map((record) => { return record[idField] })
                  let removedIdList = localIdList.filter((id) => !liveIdList.includes(id))
                  let currentIdList = liveIdList.filter((id) => !removedIdList.includes(id))
                  if (removedIdList && removedIdList.length > 0) {
                    let query = {}
                    query[idField] = { "$in": removedIdList };
                    tableMap[tableName].chain().find(query).remove();
                    updateCount += removedIdList.length
                  }
                  // Clear local tables
                    
                  // if (tableName.toLowerCase() == "assortments") { 
                  //     tableMap[tableName].chain().find({}).remove(); 
                  // }
                  // 

                  //Filter records with version mismatch
                  // db.saveDatabase();
                  db.saveDatabase((data) => {
                    let table = $.fn.capitalize(collectionName); tableMap[table] = db.getCollection(table)
                  });
                  if (localTableData && localTableData.length > 0) {
                    //  console.log(currentIdList);
                    for (let id of currentIdList) {

                      let localRecord = localTableData.filter((record) => record[idField] == id)
                      let liveRecord = liveTableData.filter((record) => record[idField] == id)
                      localRecord = localRecord && localRecord.length > 0 ? localRecord[0] : null
                      liveRecord = liveRecord && liveRecord.length > 0 ? liveRecord[0] : null;
                      
                      if (!localRecord) {
                        updateQuery[tableName].push(id);
                      } else if (parseInt(localRecord['current_version']) != parseInt(liveRecord['current_version'])) {
                            
                        updateQuery[tableName].push(id);
                      }
                    }
                  } else {
                    
                    updateQuery[tableName] = currentIdList;

                  }
                }catch (e) { 
                    console.log(e)
                }

                  });

               
                  let count = 0;

                  Object.keys(updateQuery).forEach((tableName) => { 
                  updateCount +=  updateQuery[tableName].length;
                  count += updateCount;
                  if (updateCount == 0) { 
                    delete updateQuery[tableName];
                  } 

                  })
                
                if (count > 0) {
                    
                         
                      let fetchUrl = '/cpanel/sync/update/cpanel?q=' + JSON.stringify(updateQuery) + `&acky=${currentUser.acky}`
                      Promise.resolve(DataSynchronizer.runGet(fetchUrl, DataSynchronizer.updateLocalTables, { 'updateSet': updateSet, "collectionSyncInfo": window.config.syncInfo.cpanel, 'updateCount': updateCount, 'callback':callback })).then((e) => {
                          
                        db.saveDatabase((err) => {
                          if (err){ console.log(err) }
                        });
                      

                  }).then((e) => {
                      callback();
                  })
                  
                } else { 
                    callback();

                }
                

              }


            
                          
                          
                    
              return results.length
            }
          };
          xmlhttp.open("GET", fetchUrl, true);
          xmlhttp.setRequestHeader('Access-Control-Allow-Headers', '*');
          xmlhttp.setRequestHeader('Content-type', 'application/json');
          xmlhttp.setRequestHeader('Access-Control-Allow-Origin', '*');
          xmlhttp.setRequestHeader('Accept', 'application/json');
          xmlhttp.send()
 
		

}
$.fn.areFieldsValid = (buttonID, siblingIDs) => {
  let response = false;
  let validCount = siblingIDs.length;
  for (let element of siblingIDs) {
      element = '#' + element;
      let value = $(element).val();
    if (value && value.trim() === "" || !$.fn.isAlphaNumSpecial(value)) {
      if (!$(element).hasClass('is-invalid')) {
        $(element).addClass('is-invalid')
      }
       $('#' + buttonID).attr('disabled', 'disabled')
         --validCount;
    } else {
      
        if ($(element).hasClass('is-invalid')) {
           $(element).removeClass('is-invalid');
      }
    }
  }
  //console.log(`${validCount} == ${siblingIDs.length}`)
  if (validCount == siblingIDs.length) {
    if ($('#' + buttonID).attr('disabled')=="disabled"||$('#' + buttonID).hasClass('disabled') ) {
         $('#' + buttonID).removeAttr('disabled')
    }
        response = true;
  }


  return response;
}
$.fn.getColumns = (records)=>{

 let largestColIndex = 0;
 let largestColSize  = 0;
 let index           = 0; 
 records.forEach((record) =>{
    if(Object.keys(record).length > largestColSize  ){
         largestColSize  =  Object.keys(record).length;
         largestColIndex = index;
      }
      index+=1
  })
 
  return Object.keys(records[largestColIndex])
}
$.fn.checkDateOfBirth = (dateValue) => { 
    let ageRestriction=  18
    let userAge = (Date.now() - Date.parse(dateValue)) / (1000 * 60 * 60 * 24 * 365)
    return  (userAge-ageRestriction)>=0
}
$.fn.resetModal = ()=>{

  $('#modal-content').html(`            <div class="modal-header">
  <div id="dialog-header-span" class="modal-title col-12 h2">
      <h5></h5>
  </div>
  </div>
  <div class="modal-body" id="dialog-message-div">
  <p>

  </p>
  </div>
  <div class="modal-footer" id="dialog-footer-div">
  <a href="#" type="button" class="btn btn-info" data-dismiss="modal" id="dialog-close-bttn">Close</a>
  <div class="row" id="dialog-bttns" style="display:none"> </div>
  </div>`)

}
$.fn.getTotalDays = (month)=>{

  let days        = 31
  let DayMonths = [3,5,8,10]
  let febIndex    =  1

  if ((new Date()).getFullYear() %4==0 && month==1){
    days = 29
  }else if(month==1){
    days = 28

  }else if(DayMonths.indexOf(month) >-1){
    days = 30
  }
   return days
}
$.fn.getRepeatString = (repeat)=>{

  let repeatVal    = repeat?parseInt(repeat):0;
  let repeatString = "No";
  
  if  (repeatVal == (3600 *24 *30*12)){
  
       repeatVal = 'yearly';
   
  }else if(repeatVal == 3600 *24 *30*3){
  
    repeatString = 'quarterly';
  
  }else if(repeatVal == 3600 *24 *30){
  
    repeatString = 'monthly';
    
  }else if(repeatVal == 3600 *24 *7*2){
    repeatString = 'bi-weekly';
  }else if(repeatVal == 3600 *24 *7){
    repeatString = 'weekly'
  }else if(repeatVal == 3600 *24){
    repeatString = 'daily';
  }else if(repeatVal == 3600){
    repeatString = 'hourly';
  }else{
       repeatString="No";
  }

   return repeatString

}
$.fn.isValidDate = (element,submitBttn, siblings)=>{
 
    let startTime = $(element).val();
   // console.log(startTime)
    let startDate = startTime.length>0?  new Date(startTime):null;

    if(startDate){

      //console.log(new Date().getTime()  - startDate.getTime())
    }
    
 
    if(!startTime  ||  ( startDate && (new Date().getTime()  - startDate.getTime()) ) > 0){
   
      $(element).addClass('is-invalid')
    }else{
 
      let classList =  $(element).attr('class')
      if (classList.indexOf('is-invalid')> -1){
         $(element).removeClass('is-invalid')
      }
      for (let sibling of siblings){
        sibling = '#'+sibling;
        $.fn.isFieldValid(sibling, submitBttn, siblings) 

      }

 
    }
 
}
$.fn.highlightNavHeader = (currentHeading) => {
    let headers = document.querySelectorAll('li.nav-item.d-none.d-sm-inline-block')
   
    headers.forEach((header) => {
    
      if (header.children[0].innerHTML.toLowerCase().trim()== currentHeading.trim().toLowerCase()) {
       
         header.children[0].classList.add('active')
      } else {
        header.children[0].classList.remove('active');
      }

    })
  
  } 

$.fn.showImagePrompt = (imageURl) => {
  let imageProps = tableMap['Images'] ? tableMap['Images'].find({ 'google_url': imageURl }) : null
  imageProps = imageProps && imageProps.length >= 1 ? imageProps[0] : imageProps
  if (imageProps) { 
    $.fn.displayImage(imageProps.image_id)
  }

}
$.fn.displayImage = (imageID) => {
  let modalOptions = {
    keyboard: false,
    focus: true,
    backdrop: 'static'
  }
  let imageProps = tableMap['Images'] ? tableMap['Images'].find({ 'image_id': imageID }) : null
  imageProps = imageProps && imageProps.length >= 1 ? imageProps[0] : imageProps
  //console.log(imageProps);
  $('#modal-content').css('width', "60em");
  
  if (imageProps) {
    $('#modal-content').html(`
   <form id="image-display-form">
  <div class="card card-primary" id="image-display">
    <div class= "card-header">
       <h3 class="card-title text-center" id="image-name">Image ID: ${imageProps.image_id ? imageProps.image_id : ''}</h3>
   </div >
 
    <div class="card-body">
      <div class="form-group row">
        <label for="report-name-id" class="form-label col-sm-2">Photo</label>
		        <img  class="col-sm-10 img-fluid" style="height:auto;max-width:100%"  src="${$.fn.getGoogleUrl(imageProps.google_url)}" alt="${imageProps.file_name ? imageProps.file_name : ''}" />
        <input type="hidden" name="google_url" class="form-control" id="google-url" placeholder="" value="${$.fn.getGoogleUrl(imageProps.google_url)}">
      </div>
      <div class="form-group row">
        <label for="file-name" class="form-label col-sm-2">Name</label>
        <input type="text" class="form-control col-sm-10" id="file-name" value="${imageProps.file_name ? imageProps.file_name : ''}" disabled="disabled">
      </div>
      <div class="form-group row">
        <label for="file-size" class="form-label col-sm-2">Size</label>
        <input type="text" class="form-control col-sm-10" id="file-size" value="${imageProps.file_size ? imageProps.file_size : ''} KB" disabled="disabled">
      </div>
      <div class="form-group row">
        <label for="image-dimensions" class="form-label col-sm-2">Dimensions</label>
        <textarea name="image_dimensions" class="form-control col-sm-10" id="image-dimensions"   disabled="disabled" style="resize:none">${imageProps.image_dimensions ? imageProps.image_dimensions.replaceAll('\n','').replaceAll('\s','') : ''}</textarea>
        </div>

      <div class="form-group row">
        <label for="image-format" class="form-label col-sm-2" >Format</label>
        <input type="text" class="form-control col-sm-10" id="image-format" value="${imageProps.image_format ? imageProps.image_format : ''}" disabled="disabled">
      </div>

      <div class="form-group row">
        <label for="image-date" class="form-label col-sm-2">Date</label>
        <input type="text" class="form-control col-sm-10" id="image-date" value="${imageProps.created_datetime ? imageProps.created_datetime : ''}" disabled="disabled">
      </div>	  

    </div>
    <div class="card-footer">
      <div class="row"> <div class="col-sm-6 text-left"> </div>
          <div class="col-sm-6 text-right">
              <button  id="display-cancel-bttn" onclick="$.fn.cancelDialog()"  class="btn btn-secondary">Close</button>
          </div>
      </div>
    </div>
  </div>
</form>
  `);
    $('#myModal').modal(modalOptions);
    $('#myModal').show();
  } else { 

    $.fn.showAlert(`Image:${imageID} could not be loaded`,"warning","$.fn.cancelDialog()")
  }



};
$.fn.displayRecords= (title,objectType,idField, recordID) => {
  let modalOptions = {
    keyboard: false,
    focus: true,
    backdrop: 'static'
  }
  let temp ={}
  temp[idField] = recordID
  let recordInfo = tableMap[objectType] ? tableMap[objectType].find(temp) : null;
  recordInfo = recordInfo && recordInfo.length >= 1 ? recordInfo[0] : recordInfo;
  objectType=objectType.toLowerCase()

  $('#modal-content').css('width', "60em");
  
  let recordDetails = [];
  
    Object.keys(recordInfo).filter((field)=>!['$loki','_id','_cls','meta'].includes(field)).forEach((field) => {
      
      if ($.fn.getObjectType(recordInfo[field]) == "object") { 
              let info =''
        if (field == "template") {
          let tempRecords = Object.keys(window.tableMap).includes('MailTemplates') && window.tableMap['MailTemplates'].data.length > 0 ? window.tableMap['MailTemplates'].data : [];
          let tempRecord = tempRecords.length > 0 ? tempRecords.filter((temp) => recordInfo[field]['$oid'] == temp._id)[0] : [];
          ['$loki', '_id', '_cls', 'meta'].forEach((field) => {

            delete tempRecord[field];
          })
          info = JSON.stringify(tempRecord);
        } else if (field == "startTime") {
          info=$.fn.displayDate(tempRecord[field])
                
        }

        recordDetails.push(`
              <div class="form-group row">
                  <label for="${field}-id" class="form-label col-sm-2">${field.split("_").map((word) => $.fn.capitalize(word)).join(" ")}</label>
                  <div class="col-sm-10">
                      <textarea rows="8" name="${field}" class="form-control" id="${field.replaceAll("_", "-")}"  disabled="disabled">${info}</textarea>
                  </div>
               </div> `)

      }else{ 
        recordDetails.push(`
        <div class="form-group row">
          <label for="${field}-id" class="form-label col-sm-2">${field.split("_").map((word) => $.fn.capitalize(word)).join(" ")}</label>
          <div class="col-sm-10"><input type="text" name="${field}" class="form-control" id="${field.replaceAll("_", "-")}" placeholder="${field}" value="${recordInfo[field]}" disabled /></div>
        </div>
      `)
      
      }
      
       });
  
  
  if (recordDetails.length>0) {
    $('#modal-content').html(`
   <form id="${objectType}-display-form">
  <div class="card card-primary" id="${objectType}-display">
    <div class= "card-header">
       <h3 class="card-title text-center" id="${objectType}-name">${title}</h3>
   </div >
 
    <div class="card-body">
			${recordDetails.join('')}
    </div>
    <div class="card-footer">
      <div class="row"> <div class="col-sm-6 text-left"> </div>
          <div class="col-sm-6 text-right">
              <button  id="display-cancel-bttn" onclick="$.fn.cancelDialog()"  class="btn btn-secondary">Close</button>
          </div>
      </div>
    </div>
  </div>
</form>
  `);
    $('#myModal').modal(modalOptions);
    $('#myModal').show();
  } else { 

    $.fn.showAlert(`${$.fn.capitalize(objectType)} with id ${recordID} could not be displayed`,"warning","$.fn.cancelDialog()")
  }


};
$.fn.showDataTable = (tableID) => {

  if (!DataTable.isDataTable(`#${tableID}`)) {
    try {
      mapperTable = $(`#${tableID}`).DataTable({
        "paging": true,
        "lengthChange": true,
        "searching": true,
        "ordering": true,
        "info": false,
        //   "autoWidth": true,
        "responsive": true
      });
    } catch { 

    }

  }
  
}
$.fn.updateEventStatus = (eventID) => {
  const objectType = "events";
    let modalOptions = {
      keyboard: false,
      focus: true,
      backdrop: 'static'
  }
  let recordSelect = {}

  recordSelect['event_id']=eventID
  let eventData = window.tableMap['Events'].find(recordSelect)
  let eventInfo = Array.isArray(eventData) ? eventData[0] : null;
   let titlePrefix = eventInfo ? 'Edit' : 'New';
  $('#modal-content').html(`
  <div class="card card-primary" id="event-header">
    <div class= "card-header">
    <h3 class="card-title" id="event-title" > Event ${eventInfo.event_id}: Status Update</h3>
              </div >
  <form id="event-update-form">
    <div class="card-body">
      <div class="form-group">
        <label for="event-status">Event Status</label>
		 <select name="event_status" id="event-status" class="form-control select2" style="width: 100%;">
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
				  <option value="MUTED">MUTED</option>
                </select></div>
      </div>
    
    </div>
    <div class="card-footer">
      <div class="row">
          <div class="col-6" align="left">
              <button  id="update-cancel-bttn" onclick="$.fn.cancelDialog()"  class="btn btn-secondary">Cancel</button>
          </div>
          <div class="col-6" align="right">
              <button id="event-update-bttn" class="btn btn-primary">Update</button>
          </div>
      </div>
    </div>
  </form>
  </div>`);
$('#myModal').modal(modalOptions);
$('#myModal').show();
$("#event-status option[value=" + eventInfo.event_status + "]").attr('selected', 'selected'); 
$("#event-status option[value=" + eventInfo.event_status + "]").attr('value', eventInfo.event_status)

  $('#event-update-bttn').on('click',(e)=>{
	  e.preventDefault();
      let eventStatus      =  $('#event-status').val();
      const formData = new FormData();
      formData.append("mode", titlePrefix.toLowerCase());
      formData.append("event_id",eventID)
      formData.append("event_status", eventStatus);
      formData.append("acky", currentUser.acky);
    
      $.ajax({
        url: "/cpanel/add/events",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        //async: true,
        crossDomain: true,
          success: (result) => {
             $.fn.showUpdatedTable(result, objectType)
          },
          error: (e) => {
            
            $.fn.showAlert('Events Update Failed', 'danger',() => { $.fn.showTableRecords(objectType) })

          }


          });

 

  })

}
$.fn.show404Error =() =>{
	  $('#contentwrapper-node').html(`
	      <!-- Content Header (Page header) -->
    <section class="content-header">
      <div class="container-fluid">
        <div class="row mb-2">
          <div class="col-sm-6">
            <h1>404 Error Page</h1>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-right">
              <li class="breadcrumb-item"><a href="#">Home</a></li>
              <li class="breadcrumb-item active">404 Error Page</li>
            </ol>
          </div>
        </div>
      </div><!-- /.container-fluid -->
    </section>

    <!-- Main content -->
    <section class="content">
      <div class="error-page">
        <h2 class="headline text-warning"> 404</h2>

        <div class="error-content">
          <h3><i class="fas fa-exclamation-triangle text-warning"></i> Oops! Page not found.</h3>

          <p>
            We could not find the page you were looking for.
            Meanwhile, you may <a href="../../index.html">return to dashboard</a> or try using the search form.
          </p>

          <form class="search-form">
            <div class="input-group">
              <input type="text" name="search" class="form-control" placeholder="Search">

              <div class="input-group-append">
                <button type="submit" name="submit" class="btn btn-warning"><i class="fas fa-search"></i>
                </button>
              </div>
            </div>
            <!-- /.input-group -->
          </form>
        </div>
        <!-- /.error-content -->
      </div>
      <!-- /.error-page -->
    </section>
    <!-- /.content -->
	  
	  `)
}
$.fn.show50xError =  (error=null, message= null)=>{
  $('#contentwrapper-node').html(`
     <section class="content-header">
      <div class="container-fluid">
        <div class="row mb-2">
          <div class="col-sm-6">
            <h1>500 Error Page</h1>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-right">
              <li class="breadcrumb-item"><a href="#">Home</a></li>
              <li class="breadcrumb-item active">500 Error Page</li>
            </ol>
          </div>
        </div>
      </div><!-- /.container-fluid -->
    </section>

    <!-- Main content -->
    <section class="content">
      <div class="error-page">
        <h2 class="headline text-danger">500</h2>

        <div class="error-content">
          <h3><i class="fas fa-exclamation-triangle text-danger"></i> Oops! Something went wrong: ${message}</h3>

          <p>
            We will work on fixing that right away.
            Meanwhile, you may <a href="../../index.html">return to dashboard</a> or try using the search form.
          </p>

          <form class="search-form">
            <div class="input-group">
              <input type="text" name="search" class="form-control" placeholder="Search">

              <div class="input-group-append">
                <button type="submit" name="submit" class="btn btn-danger"><i class="fas fa-search"></i>
                </button>
              </div>
            </div>
            <!-- /.input-group -->
          </form>
        </div>
      </div>
      <!-- /.error-page -->

   </section>

 `)

}
$.fn.removeMapRecord = (id, rowNumber,columnCount) => {
  const mapperTable = $(`#${id}-table`).DataTable();
  let rowIdx = -1;
  const columnData = mapperTable.column(columnCount).data();
   for(let  key of Object.keys(columnData)){ 
    let rowData = columnData[key];
    if (rowData.toString().indexOf(`id="${id}-${rowNumber}-rmv-bttn"`) > -1) { 
      rowIdx = key;
      break;
    }

  }
  mapperTable.row(rowIdx).remove();
  mapperTable.draw()

} 
$.fn.addObjectMapperRow = (fieldList) => {
  
  let id = null, fieldMap = {}, props = null;
  let defaults = {}
  let placeholders = {}
  for (let fieldInfo of fieldList) { 
    if (typeof fieldInfo == 'object') { 
      
      let fieldKey = Object.keys(fieldInfo)[0];
      let fieldValue = fieldInfo[fieldKey];
      if (fieldKey == 'id') {
        id = fieldInfo[fieldKey]
      } else if (fieldKey == 'props') {

        props = fieldInfo[fieldKey]
      } else {
        fieldMap[fieldInfo[fieldKey]] = fieldKey; 
         if (Object.keys(fieldInfo).includes('default')) { 
            defaults[fieldValue]=fieldInfo['default']
        }
        if (Object.keys(fieldInfo).includes('placeholder')) { 
            placeholders[fieldValue]=fieldInfo['placeholder']
        }
      } 

    }

  }
  let mapperTable = null
  if (!DataTable.isDataTable(`#${id}-table`)) {
    
    mapperTable = $(`#${id}-table`).DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": false,
   //   "autoWidth": true,
      "responsive": true
    });

  } else { 
     mapperTable = $(`#${id}-table`).DataTable()

  }
  let rowNumber = mapperTable.rows().count();
  let tableBody =[]
  Object.keys(fieldMap).forEach((field) => {
      
    let value = '';
    let fieldType = fieldMap[field];
    field = field.replaceAll(' ', '-');    

    let placeholder = placeholders[field] ? placeholders[field] : '';
    value   = (value==null || value =="") && defaults[field] && defaults[field]!=""?defaults[field]:value

    if (fieldType == 'text') {
      tableBody.push(`<td> <input type="text" class="form-control" name="${id}_${field}_${rowNumber}" id="${id}-${field}-${rowNumber}" value="${value ? value : ''}" placeholder="${placeholder}"></td>`);
    } else if (fieldType == 'dictionary') {
      tableBody.push(`<td><textarea class="form-control" name="${id}_${field}_${rowNumber}" id="${id}-${field}-${rowNumber}" placeholder="${value}">${value}</textarea></td>`);
    }else if (fieldType == 'file') { 
                tableBody.push (`<td><input type="file" class="form-control-sm btn btn-dark"  id="${id}-${field}-${rowNumber}" name="${id}_${field}_${rowNumber}"></td>`)
      }
        
      
  });

  let columnCount = Object.keys(fieldMap).length;
        tableBody.push(`<td> <input class="btn btn-danger" type="button" id="${id}-${rowNumber}-rmv-bttn" value="remove" onclick="$.fn.removeMapRecord('${id}',${rowNumber},${columnCount} )" /></td>`);
        tableBody.push(`</tr>`);
   mapperTable.row
        .add(tableBody)
        .draw()
}
$.fn.getObjectFromMapper = (id) => { 

  let mappedPropsList = []
  const mapperTable = $(`#${id}-table`).DataTable();
  const rowCount = mapperTable.rows().count();
  const colCount = mapperTable.columns().count();

  for (let i = 0; i < rowCount; i++) { 

    let propName = null;
    let propVal = null;
    let rowData = mapperTable.rows(i).data();
    if (rowData && rowData[0].length > 0) {

      for (let i = 0; i < colCount; ++i) {

          let mappedProps = {};
          let fieldString = rowData[0][i];
          let startIndex = fieldString.indexOf(`name="`) + 6;
          let endIndex = fieldString.indexOf(`"`, startIndex);
          propName = fieldString.substring(startIndex, endIndex);
          startIndex = fieldString.indexOf(`id="`) + 4;
          endIndex = fieldString.indexOf(`"`, startIndex);
         // console.log("Line (1169): ", fieldString , startIndex, endIndex)
          let propID = fieldString.substring(startIndex, endIndex)
          propVal = propID ? $(`#${propID}`).val() : null;
          if (propName.indexOf("<input")< 0) {
            //propVal = valId ? $(`#${propID}`).val() : '';
            mappedProps[propID] =  propVal;
        }
       if (Object.keys(mappedProps).length>0 && !propID.endsWith("-rmv-bttn")) { 
          mappedPropsList.push(mappedProps);
        }
        
    }
    }
  }
  return mappedPropsList;

}
$.fn.getObjectMapper = (fieldList) => {

  let fieldID = null, fieldMap = {}, props = null;
  let tableHeaders = []
  let columns = []
  let defaults = {}
  let placeholders = {}
  for (let fieldInfo of fieldList) { 
    if (typeof fieldInfo == 'object') { 
      let fieldKey = Object.keys(fieldInfo)[0];
      let fieldValue = fieldInfo[fieldKey];
     
      if (fieldKey == 'id') {
        fieldID = fieldInfo[fieldKey]
      } else if (fieldKey == 'props') {

        props = fieldInfo[fieldKey];
       // tableHeaders.push(`<td>${fieldInfo[fieldKey]}</td>`)
      } else {
        columns.push(fieldValue)
        fieldMap[fieldValue] = fieldKey
        tableHeaders.push(`<td>${fieldValue}</td>`);

        if (Object.keys(fieldInfo).includes('default')) { 
            defaults[fieldValue]=fieldInfo['default']
        }
        if (Object.keys(fieldInfo).includes('placeholder')) { 
            placeholders[fieldValue]=fieldInfo['placeholder']
        }
      } 
      
    }

  }

  let colCount = columns.length;
  let parameters = JSON.stringify(fieldList).replaceAll('"', '\'');
  tableHeaders.push(`<td class="col-sm-1"><input type="button" class="btn btn-success" id="${fieldID}-add-bttn" value="Add" onclick="$.fn.addObjectMapperRow(${parameters})" /> </td>`)
  let tableBody = [];



  if (props.length > 0) {
    let rowIndex = 0;
    let colIndex = 0;
    let index = 0;
   tableBody.push(`<tr>`);

    
    //Object.entries creates tuples of fields and values i.e [(field,value), (field, value)]

    props.forEach((field) => {
    
       let id = Object.keys(field)[0];
  
       let name = id.replaceAll('-', '_');
       let value =  Object.values(field)[0];
       let fieldType = fieldMap[columns[colIndex]];

       let placeholder = placeholders[field] ? placeholders[field] : '';
       value   = (value==null || value =="") && defaults[field] && defaults[field]!=""?defaults[field]:value

      if (fieldType == 'text') {
        tableBody.push(`<td> <input type="text" class="form-control" id="${id}" name="${name}" value="${value ? value : ''}" placeholder="${placeholder}"></td>`);
      } else if (fieldType == 'dictionary') {
        tableBody.push(`<td><textarea class="form-control"  name="${name}" id="${id}"  placeholder="${value}">${value}</textarea></td>`);
      } else if (fieldType == 'file') {
        tableBody.push(`<td><input type="file" class="form-control-sm btn btn-dark" id="${id}" name="${name}" value="${value ? value : ''}"></td>`);
      }
      
      ++colIndex
    
       
       if (colIndex > 0 && (colIndex % columns.length) == 0) { 
          
        tableBody.push(`<td> <input class="btn btn-danger" type="button" id="${fieldID}-${rowIndex}-rmv-bttn" value="remove" onclick="$.fn.removeMapRecord('${fieldID}',${rowIndex},${colCount})" /></td>`);
        tableBody.push(`</tr><tr>`);
        ++rowIndex;
        colIndex = 0;
       }
          ++index;
    })
      tableBody.push(`<tr>`);
        

  }
	
	
  return (`<table class="col-sm-10" id="${fieldID}-table">
            	<thead>
                  <tr> 
                     ${tableHeaders.join('')}
                  </tr>
               </thead>
							 <tbody>${tableBody.join('')}</tbody>
						</table>`);
}
$.fn.checkMappedProps= (mapPropList, columnCheckParity)=>{
  let isReallyValid = [];
  if ((!mapPropList || mapPropList.length==0) && (columnCheckParity).reduce((a, b) => a + b, 0)> 0) { 
    isReallyValid.push(false)

  } else { 
        let index = 0;
    let isValid = false

    if ($.fn.getObjectType(mapPropList) == "string") { 

        mapPropList = JSON.parse(mapPropList);

    }
        mapPropList.forEach((record)=>{
          if (index>=columnCheckParity.length) { 

            index = 0
          }
        if (Object.keys(record).length > 0) {

          let field = Object.keys(record)[0];
          let value = record[field];

          if ((!value || value == "") && columnCheckParity[index] == 1) {

            isValid = false;
            

          } else if (columnCheckParity[index] == 4) {
 
            isValid = $.fn.isValidImage(field);

            if (isValid) { 
             
                 fileUploadTracker[field]={"file":$(`#${field}`).prop('files')[0], "path": $(`#${field}`).val()  }

             }

            
          } else if (columnCheckParity[index] == 3) {
            
            isValid = $.fn.isValidDate(field);

          } else if (columnCheckParity[index] == 2) {
            
                isValid = $.fn.isValidFile(field);

                if (isValid) { 
                    fileUploadTracker[field]={"file":$(`#${field}`).prop('files')[0], "path": $(`#${field}`).val()  }
                }

          }else {
            
              $(`#${field}`).removeClass('is-invalid');
              $(`#${field}`).addClass('is-valid');
              isValid = true;

          }
          //  console.log(field,": ",isValid )
          if (!isValid) {

            $(`#${field}`).addClass('is-invalid');

          } else { 

            $(`#${field}`).removeClass('is-invalid');
            $(`#${field}`).addClass('is-valid');

          }
          
          isReallyValid.push(isValid)
        } 
          ++index;
      });
  }
  isReallyValid = isReallyValid.length > 0 && isReallyValid.reduce((a,b)=>a&&b)
  return isReallyValid

}

$.fn.addObjectMapperRowOld = (id) =>{
    const mapperTable = $(`#${id}-table`).DataTable();
    let   rowNumber =  mapperTable.rows().count();

    let format = 'Text';
    const formatOptions = ['Text','Dictionary'].map((mode, key) => {
      let selected = "";
      if (format.toLowerCase()==mode.toLowerCase()) {
        selected = `selected="selected"`
      }
        return `<option value="${key}" ${selected}>${mode}</option>`;
    })
 
   mapperTable.row
        .add([
           `<input type="text" class="form-control" name="${id}_key_${rowNumber}" id="${id}-key-${rowNumber}" value="" placeholder="">`,
          `<input type="text" class="form-control" name="${id}_val_${rowNumber}" id="${id}-val-${rowNumber}" value="" placeholder="">`,
           `                          <select name="${id}_format" id="${id}-format" class="form-control" select2"">
                          ${formatOptions.join("")}
                          </select>`,
           `<input class="btn btn-danger" type="button" id="${id}-${rowNumber}-rmv-bttn" value="remove" onclick="$.fn.removeMapRecordOld('${id}',${rowNumber})" />`
        ])
        .draw()
}

$.fn.removeMapRecordOld = (id, rowNumber) => {
  const mapperTable = $(`#${id}-table`).DataTable();
  let rowIdx = -1;
  const columnData = mapperTable.column(3).data();
   for(let  key of Object.keys(columnData)){ 
    let rowData = columnData[key];
    if (rowData.toString().indexOf(`id="${id}-${rowNumber}-rmv-bttn"`) > -1) { 
      rowIdx = key;
      break;
    }

  }
  mapperTable.row(rowIdx).remove();
  mapperTable.draw()

} 
$.fn.getObjectMapperOld  = (id,field,value, props) =>{
     
  let tableBody = [];
  if($.fn.getObjectType(props) =="string" ){

    props = JSON.parse(props);
  }


	if ($.fn.getObjectType(props) == "object" && Object.keys(props).length >  0){
    tableBody = Object.keys(props).map((key, index) => {
        let format =  ['overrides','image_formats','image_types'].includes(key.toLowerCase())?'Dictionary':'Text';
        const formatOptions = ['Text','Dictionary'].map((mode, key) => {
            let selected = "";
            if (format.toLowerCase()==mode.toLowerCase()) {
              selected = `selected="selected"`
            }
              return `<option value="${key}" ${selected}>${mode}</option>`;
        })
        let value = props[key] ? props[key] : '';

      let valueHtml = format != 'Dictionary' ? `<input type="text" class="form-control" name="${id}_val_${index}" id="${id}-val-${index}" value="${value}" placeholder="${value}"></input>` :
        `<textarea class="form-control" name="${id}_val_${index}" id="${id}-val-${index}" placeholder="${value}">${value}</textarea>`
          return `<tr id="${id}-div-${index}"> <td> <input type="text" class="form-control" name="${id}_key_${index}" id="${id}-key-${index}" value="${key ? key : ''}" placeholder=""></td><td>${valueHtml}</td>
            
                                <td >
                          <select name="${id}_format" id="${id}-format" class="form-control" select2"">
                          ${formatOptions.join("")}
                          </select>
                        </td>
          <td> <input class="btn btn-danger" type="button" id="${id}-${index}-rmv-bttn" value="remove" onclick="removeMapRecordOld('${id}',${index})" /></td></tr>`
        })
	}
	
  return (`<table class="col-sm-10" id="${id}-table">
            	<thead>
                  <tr> 
                      <td class="col-sm-4" >${field}</td>
                      <td class="col-sm-2">${value}</td>
                       <td class="col-sm-2">format</td>
                      <td class="col-sm-2"><input type="button" class="btn btn-success" id="${id}-add-bttn" value="Add" onclick="$.fn.addObjectMapperRowOld('${id}')" /> </td> 
                  </tr>
               </thead>
							 <tbody>${tableBody.join('')}</tbody>
						</table>`);
}
$.fn.getObjectFromMapperOld = (id) => { 

  let mappedProps = {}
  const mapperTable = $(`#${id}-table`).DataTable();
  const rowCount = mapperTable.rows().count();
  for (let i = 0; i < rowCount; i++) { 
    let propName = null;
    let propVal = null;
    let rowData = mapperTable.rows(i).data()
    if (rowData && rowData[0].length > 0) {
        let keyString = rowData[0][0];
        let valString = rowData[0][1];
        let formatString = rowData[0][2];
        //console.log(keyString);
        //console.log(valString);
        let startIndex = keyString.indexOf(`id="`) + 4;
        let endIndex = keyString.indexOf(`"`, startIndex);
        let keyId = keyString.substring(startIndex, endIndex)
        startIndex = valString.indexOf(`id="`) + 4;
        endIndex = valString.indexOf(`"`, startIndex);
        let valId = valString.substring(startIndex, endIndex)
        propName = keyId ? $(`#${keyId}`).val() : null;
      // console.log("propName: ", propName);
      // console.log("propVal: ", propVal)
        if (propName) {
          propVal = valId ? $(`#${valId}`).val() : '';
          mappedProps[propName] = formatString.toLowerCase() != 'dictionary' ? propVal : JSON.stringify(propVal);
          //mappedProps[format] = formatString
        }
    }
  }
  return mappedProps;

}

$.fn.refreshLocalTables = () => { 

    db = new loki(dbName, { adapter: pa });
    db.loadDatabase({}, function (err) {
      $.fn.databaseInitialize();
    });
  
}

$.fn.getTableRecords =  (objectType, serverRecords) => {
 
  let records = []
  let columns = [{
    'orderable': false,
    'data': null,
    'defaultContent': 'No data available'
  }];
 
  if (objectType == 'admin') {
       objectType = 'users'
  }
  //if (currentUserRoleID == 1) {
  
      let dbRecords = serverRecords && (serverRecords.length> 0 || $.fn.getObjectType(serverRecords)=="object")? serverRecords : Object.keys(window.tableMap).includes($.fn.capitalize(objectType)) && window.tableMap[$.fn.capitalize(objectType)].data ? window.tableMap[$.fn.capitalize(objectType)].data : null;
      if (objectType        == 'sitesettings') {
            
                if (dbRecords && dbRecords.length > 0) {
                                  
                  records = dbRecords.map((row) => {
                      
                      //["social_media", "overrides", "sqlalchemy_track_modifications", "profile_image_dimensions", "admins", "languages", "ms_translator_key", "upload_extensions", "image_types", "image_formats", "excluded_file_formats", "sync_info"].forEach((r) => delete row[r])
                      //let deleteInfo = `\\'sitesettings,${row.user_id}\\'`;

                      row['created_datetime']   = $.fn.displayDate (row, 'created_datetime')
                      row['last_modified_date'] = $.fn.displayDate(row, 'last_modified_date') 
                
                      if (currentUserRoleID == 1) {
                        row['Actions'] = `<div class="row"><div class="col-md-6"><button class="btn btn-secondary btn-md" onClick="$.fn.editSettings({'settings_id': 1})">Edit</button></div><div class="col-md-6"></div>`;
                      }

                      return row;

                    });
                                
                }

      } else if (objectType == 'users') {
            
        if (dbRecords && dbRecords.length > 0) {
                          
          records = dbRecords.map((row) => {
            //console.log(row)
            let deleteInfo = `\\'users,${row.user_id}\\'`;
            if (currentUserRoleID == 1) {
              row['Actions'] = `<div class="row"><div class="col-md-6"><button class="btn btn-secondary btn-md" onClick="$.fn.editUser({'user_id': ${row.user_id}})">Edit</button></div><div class="col-md-6"><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete User', 'Are you sure that you want to delete the User with id: ${row.user_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button></div></div>`;
            }
            row['last_modified_date'] = $.fn.displayDate(row, 'last_modified_date')
            return row;

          })

                              
        }

      } else if (objectType == 'roles') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'roles,${row.role_id}\\'`
              
              return {
                ...row,
                'created_datetime':  $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date':  $.fn.displayDate(row, 'last_modified_date') 
              //  , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editRole({'role_id': ${row.role_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Role', 'Are you sure that you want to delete the Role with id: ${row.roles_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })                           
        }
      } else if (objectType == 'images') {
          
        if (dbRecords && dbRecords.length > 0) {
                              
          records = dbRecords.map((row) => {
            let deleteInfo = `\\'images,${row.image_id}\\'`;
            let fileName = row.image_url.split("/").pop();
            if (currentUserRoleID == 1) {
              return {
                ...row,
                'image_url': `<a href="${row.image_url}" onclick="{event.preventDefault(); $.fn.showImagePrompt('${row.image_url}')}">${fileName} </a>`,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editImage({'image_id': ${row.image_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Image', 'Are you sure that you want to delete the Image with id: ${row.image_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            } else { 
              return {
                ...row,
                'image_url': `<a href="${row.image_url}" onclick="{event.preventDefault(); $.fn.showImagePrompt('${row.image_url}')}">${fileName} </a>`,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
               }
            }
          })
                        
                          
        }
      } else if (objectType == 'files') {
          
        if (dbRecords && dbRecords.length > 0) {
                              
          records = dbRecords.map((row) => {
            let deleteInfo = `\\'files,${row.file_id}\\'`;
            let fileName = row.google_url.split("/").pop();
            if (currentUserRoleID == 1) {
              return {
                ...row,
                'google_url': `<a href="${row.google_url}">${fileName} </a>`,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editFile({'file_id': ${row.file_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete File', 'Are you sure that you want to delete the File with id: ${row.file_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            } else { 
              return {
                ...row,
                'google_url': `<a href="${row.google_url}">${fileName} </a>`,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
              }

              
            }
          })
                        
                          
        }
      } else if (objectType == 'pagetemplates') {
          
        if (dbRecords && dbRecords.length > 0) {                     
            records = dbRecords.map((row) => {
              let deleteInfo = `\\pagetemplates,${row.template_id}\\'`
              if (currentUserRoleID == 1) {
                return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date'),
                  'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editTemplate({'template_id': ${row.template_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Template', 'Are you sure that you want to delete the Template with id: ${row.template_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
                }
              } else { 

                 return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date'),
                }
              }
          })
                
        }
      } else if (objectType == 'pages') {
          
        if (dbRecords && dbRecords.length > 0) {                     
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'pages,${row.page_id}\\'`;
              
              //  delete row.parent_page;
              if (currentUserRoleID == 1) {
                return {
                  ...row
             
                  , 'comes_after': (row.comes_after != null ? dbRecords.filter((rec) => parseInt(rec.page_id) == parseInt(row.comes_after))[0]?.page_name : "")
                  , 'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                  , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editPage({'page_id': ${row.page_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Page', 'Are you sure that you want to delete the Page with id: ${row.page_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
                }
              } else { 
                return {
                  ...row
             
                  , 'comes_after': (row.comes_after != null ? dbRecords.filter((rec) => parseInt(rec.page_id) == parseInt(row.comes_after))[0]?.page_name : "")
                  , 'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                    }

              }
          })
                
        }
      } else if (objectType == 'sections') {
                  
         if (dbRecords && dbRecords.length > 0) {                     
            records = dbRecords.map((row) => {
            let deleteInfo = `\\'sections,${row.section_id}\\'`
            return {
              ...row,
              'pages': row.pages && window.tableMap['Pages']?row.pages.map((page)=>{
                
                let filteredPage =  window.tableMap['Pages'].data.filter((localPage)=> localPage._id == page["$oid"]);
                filteredPage = filteredPage && filteredPage.length >0? filteredPage[0]:null;
                if (filteredPage){

                    return filteredPage.page_name;
                }


              }):'',
              'created_datetime': $.fn.displayDate(row, 'created_datetime')
              , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
              , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editSection({'section_id': ${row.section_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Section', 'Are you sure that you want to delete the Section with id: ${row.section_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
            }
          })
                
        }
      } else if (objectType == 'mailtemplates') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'mailtemplates,${row.template_id}\\'`
              return {
                ...row,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editMailTemplate({'template_id': ${row.template_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete MailTemplate', 'Are you sure that you want to delete the Mail Template with id: ${row.mailtemplates_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })               
                          
        }
      } else if (objectType == 'clients') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'clients,${row.client_id}\\'`;
               let imageUrlInfo = window.tableMap['Images'].data.filter((image) => image._id == row.profile_image["$oid"])
              let imageUrl = imageUrlInfo.length == 1 ? $.fn.getGoogleUrl(imageUrlInfo[0].google_url) : '';


              return {
                ...row
                 ,'date_of_birth': $.fn.displayDate(row, 'date_of_birth')
                ,'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                ,'profile_image': `<img src="${imageUrl}" onclick="{event.preventDefault(); $.fn.showImagePrompt('${imageUrl}')}" alt="Profile Image" />`
                , 'password': '**********'
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editClient({'client_id': ${row.client_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Client', 'Are you sure that you want to delete the Client with id: ${row.clients_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })               
                          
        }
      } else if (objectType == 'partners') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'partners,${row.partner_id}\\'`
              return {
                ...row,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editPartner({'partner_id': ${row.partner_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Partner', 'Are you sure that you want to delete the Partner with id: ${row.partners_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })               
                          
        }
      } else if (objectType == 'services') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'services,${row.plan_id}\\'`
              return {
                ...row,
                 'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editService({'plan_id': ${row.plan_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Service', 'Are you sure that you want to delete the Service with id: ${row.service_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })               
                          
        }
      } else if (objectType == 'banners') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'banners,${row.banner_id}\\'`;
              let imageUrlInfo = window.tableMap['Images'].data.filter((image) => row.image &&  image._id == row.image["$oid"])
              let imageUrl = imageUrlInfo[0]?imageUrlInfo[0].google_url : '';
              let fileName = imageUrlInfo[0]?imageUrlInfo[0].file_name : '';
              if (currentUserRoleID == 1) {
                return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                  , "image": `<a href="${imageUrl}">${fileName} </a>`
                  , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editBanner({'banner_id': ${row.banner_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Banner', 'Are you sure that you want to delete the Banner with id: ${row.banners_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
                }
              } else { 
                return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                  , "image": `<a href="${imageUrl}">${fileName} </a>`
                 }

              }
              })               
                          
        }
      } else if (objectType == 'sliders') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'sliders,${row.slider_id}\\'`;
              let imageUrlInfo = window.tableMap['Images'].data.filter((image) => row.image &&  image._id == row.image["$oid"])
              let imageUrl = imageUrlInfo[0]?imageUrlInfo[0].google_url : '';
              let fileName = imageUrlInfo[0]?imageUrlInfo[0].file_name : '';
              if (currentUserRoleID == 1) {
                return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                  , "image": `<a href="${imageUrl}" onclick="{event.preventDefault(); $.fn.showImagePrompt('${imageUrl}')}">${fileName} </a>`
                  , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editSlider({'slider_id': ${row.slider_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Slider', 'Are you sure that you want to delete the Slider with id: ${row.sliders_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
                }
              } else { 
                return {
                  ...row,
                  'created_datetime': $.fn.displayDate(row, 'created_datetime')
                  , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                  , "image": `<a href="${imageUrl}" onclick="{event.preventDefault(); $.fn.showImagePrompt('${imageUrl}')}">${fileName} </a>`
               }

              }
              })               
                          
        }
      } else if (objectType == 'servicetypes') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'servicetypes,${row.type_id}\\'`
              return {
                ...row,
                 'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date')
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editServiceType({'type_id': ${row.type_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete ServiceType', 'Are you sure that you want to delete the ServiceType with id: ${row.type_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })               
                          
        }
      } else if (objectType == 'gmailaccounts') {
            
        if (dbRecords && dbRecords.length > 0) {
                          
            records = dbRecords.map((row) => {
              //console.log(row)
              
              let deleteInfo = `\\'GMailAccounts,${row.account_id}\\'`;
              row['api_key'] =  '***************'
              row['Actions'] = `<div class="row"><div class="col-md-6"><button class="btn btn-secondary btn-md" onClick="$.fn.editGmailBox({'account_id': ${row.account_id}})">Edit</button></div><div class="col-md-6"><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete GMail Account', 'Are you sure that you want to delete the User with id: ${row.account_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button></div></div>`;
              row['created_datetime'] =$.fn.displayDate(row, 'created_datetime')
              row['last_modified_date'] = $.fn.displayDate(row, 'last_modified_date')
              return row;

            })

                              
        }

      }else if (objectType  == 'imapaccounts') {
            
        if (dbRecords && dbRecords.length > 0) {
                          
            records = dbRecords.map((row) => {
              //console.log(row)
              
              let deleteInfo = `\\'IMAPAccounts,${row.account_id}\\'`;
              row['password'] =  '***************'
              row['Actions'] = `<div class="row"><div class="col-md-6"><button class="btn btn-secondary btn-md" onClick="$.fn.editMailBox({'account_id': ${row.account_id}})">Edit</button></div><div class="col-md-6"><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Imap Account', 'Are you sure that you want to delete the User with id: ${row.account_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button></div></div>`;
              row['created_datetime'] =$.fn.displayDate(row, 'created_datetime')
              row['last_modified_date'] = $.fn.displayDate(row, 'last_modified_date')
              return row;

            })

                              
        }

      } else if (objectType == 'eventtypes') {
          
          if (dbRecords && dbRecords.length > 0) {
                 const   mailTemplates    = Object.keys(window.tableMap).includes('MailTemplates') && window.tableMap['MailTemplates'].data.length > 0 ? window.tableMap['MailTemplates'].data : [];
                  
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'eventtypes,${row.type_id}\\'`;
              		   
              return {
                ...row,
                'created_datetime': $.fn.displayDate(row, 'created_datetime')
                , 'template': mailTemplates.length > 0 && Object.keys(row).includes("template") && row.template != null ? mailTemplates.filter((temp) => row.template['$oid'] == temp._id)[0]?.name : ''
                , 'last_modified_date':  $.fn.displayDate(row, 'last_modified_date') 
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editEventType({'type_id': ${row.type_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Event Type', 'Are you sure that you want to delete the Event Type with id: ${row.type_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })                           
        }
      } else if (objectType == 'events') {
          
        if (dbRecords && dbRecords.length > 0) {
          const eventTypes = Object.keys(window.tableMap).includes('EventTypes') && window.tableMap['EventTypes'].data.length > 0 ? window.tableMap['EventTypes'].data : [];
          const mailTemplates = Object.keys(window.tableMap).includes('MailTemplates') && window.tableMap['MailTemplates'].data.length > 0 ? window.tableMap['MailTemplates'].data : [];
          const jobs = Object.keys(window.tableMap).includes('Jobs') && window.tableMap['Jobs'].data.length > 0 ? window.tableMap['Jobs'].data : [];
                                
            records = dbRecords.map((row) => {
             // let deleteInfo = `\\'events,${row.event_id}\\'`
              return {
                ...row,
                'event_type': eventTypes.length > 0 && Object.keys(row).includes("event_type") && row.event_type != null ? `<a href="#" onClick="$.fn.displayRecords('Event Type Information','EventTypes', '_id','${row.event_type['$oid']}')">${eventTypes.filter((temp) => row.event_type['$oid'] == temp._id)[0]?.type_name}</a>` : ''
                , 'parameters': JSON.stringify(row.parameters)
                , 'mail_template': mailTemplates.length > 0 && Object.keys(row).includes("mail_template") && row.mail_template != null ? `<a href="#" onClick="$.fn.displayRecords('Mail Template Information','MailTemplates', '_id','${row.mail_template['$oid']}')">${mailTemplates.filter((temp) => row.mail_template['$oid'] == temp._id)[0]?.name}</a>` : ''
                ,  'job': jobs.length > 0 && Object.keys(row).includes("job") && row.job != null ? `<a href="#" onClick="$.fn.displayRecords('Job Details','Jobs', '_id','${row.job['$oid']}')">${jobs.filter((temp) => row.job['$oid'] == temp._id)[0]?.name}</a>` : ''
                ,'created_datetime':  $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date':  $.fn.displayDate(row, 'last_modified_date') 
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.updateEventStatus(${row.event_id})">Update Status</button>`
              }
            })                           
        }
      }else if (objectType  == 'schedules') {
          
          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {
              let deleteInfo = `\\'schedules,${row.schedule_id}\\'`
              return {
                ...row,
                'startTime':  $.fn.displayDate(row, 'startTime'),
                'created_datetime':  $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date':  $.fn.displayDate(row, 'last_modified_date') 
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editSchedule({'schedule_id': ${row.schedule_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Schedule', 'Are you sure that you want to delete the Schedule with id: ${row.schedule_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })                           
        }
      }else if (objectType  == 'eventtriggers') {
             const   eventTypes   = Object.keys(window.tableMap).includes('EventTypes') && window.tableMap['EventTypes'].data.length > 0 ? window.tableMap['EventTypes'].data: [];
              const   schedules    = Object.keys(window.tableMap).includes('Schedules') && window.tableMap['Schedules'].data.length > 0 ? window.tableMap['Schedules'].data : [];

          if (dbRecords && dbRecords.length > 0) {
                                
            records = dbRecords.map((row) => {

              let deleteInfo       = `\\'schedules,${row.trigger_id}\\'`;

              delete row['trigger_history']
              return {
                ...row,
                'parameters': JSON.stringify(row.parameters)
                ,'created_datetime':  $.fn.displayDate(row, 'created_datetime')
                , 'last_modified_date': $.fn.displayDate(row, 'last_modified_date') 
                , 'event_type': eventTypes.length > 0 ? eventTypes.filter((evt) => row.event_type['$oid'] == evt._id)[0]?.type_name : ''
                ,'schedule': schedules.length > 0? schedules.filter((sch)=> row.schedule['$oid'] == sch._id)[0]?.name:''
                , 'Actions': `<button class="btn btn-secondary btn-md" onClick="$.fn.editEventTrigger({'trigger_id': ${row.trigger_id}})">Edit</button><button class="btn btn-danger btn-md" onClick="$.fn.showConfirmDialog('Delete Event Trigger', 'Are you sure that you want to delete the Event Trigger with id: ${row.trigger_id}?', '$.fn.removeRecord(${deleteInfo})' )">Delete</button>`
              }
            })                           
        }
      }

      return { 'records': records, 'columns': columns }


}

$.fn.selectImage = (context) => {
    let modalOptions = {
      keyboard: false,
      focus: true,
      backdrop: 'static'
  }
  let imageInfo = $.fn.imageData && $.fn.imageData.length > 0 ?$.fn.getGoogleUrl( $.fn.imageData[0]["google_url"]): '';
	let  previewImageHtml = `<div id="preview-div" class="text-center"><img class="img-fluid" style="height:auto;max-width:100%"  id="preview-image" src="${imageInfo}" alt="logo preview"/> </div>`;
  const imageNameMap = $.fn.imageData && Object.keys($.fn.imageData).length > 0 ? $.fn.imageData.map(( image,i) => { 

      let selected = "";
          if (i==0) {

            selected = `selected="selected"`;
          }
        
              return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

      }):[]
	  
	
  $('#modal-content').html(`
  <div class="card card-primary" id="image-header">
    <div class= "card-header">
			<h3 class="card-title" id="image-title" >Select Image</h3>
    </div >
  <form id="image-select-form">
    <div class="card-body">
    <div class="form-group row">
     <label class="col-md-2" for="selected-image">Current</label>
    <div class="col-md-10 text-center">
    ${previewImageHtml}
    </div>
    </div>
    <div class="form-group row">
					<div class="col-md-2">  <label for="selected-image">Image</label> 
					</div>
						 
						<select  name="selected_image" id="selected-image"  class="col-md-10 form-control select2" style="width: 100%;">
							${imageNameMap.join('')}
						</select>
						
					</div>
				</div
      </div>
    </div>
    <div class="card-footer">
      <div class="row">
          <div class="col-6" align="left">
              <button  id="select-cancel-bttn" onclick="$.fn.cancelDialog()"  class="btn btn-secondary">Cancel</button>
          </div>
          <div class="col-6" align="right">
              <button id="image-select-bttn" class="btn btn-primary">Insert</button>
          </div>
      </div>
    </div>
  </form>
  </div>`);
  $('#myModal').modal(modalOptions);
  $('#myModal').show();
  $('.select2').select2()
  $('#selected-image').on('change', (e) => {

	  $("#preview-image").attr("src",e.target.value)
	  
  });

  $("#image-select-bttn").on('click', (e) => {
    let imageUrl = $('#selected-image').val()
    let images = $.fn.imageData.filter((image)=> image.google_url== imageUrl)
    context.invoke('editor.insertImage',imageUrl ,images[0].image_name);
		 $.fn.cancelDialog();
	  
  })
 

}
$.fn.selectPlaceholder= (context) => {
    let modalOptions = {
      keyboard: false,
      focus: true,
      backdrop: 'static'
  }
	
	const placeholderTypes = ['Users','Clients', 'Images', 'Files'];
	
	const placeholderOptions=  placeholderTypes.map((type, i) => { 
       let selected = "";
       return `<option value="${type}" ${selected}>${type}</option>`

      })
	
	
	const placeholderMap = {}
	
  placeholderTypes.forEach((placeholderType) => {
    const tableData = Object.keys(window.tableMap).includes(placeholderType) && window.tableMap[placeholderType].data ? window.tableMap[placeholderType].data : null;
		placeholderMap[placeholderType]= tableData && tableData.length > 0 && Object.keys(tableData[0]).length > 0 ? Object.keys(tableData[0]).filter((field)=>!(['_cls','_id','$loki','meta','current_version'].includes(field))).map(( field,i) => { 
				  
					   return `<option value="/${field.toUpperCase()}/" >${field.toUpperCase()}</option>`;

				  }):[];
  })

  //$('#modal-content').css('width', "80em");
  $('#modal-content').css('width', "60em");
  $('#modal-content').html(`
  <div class="card card-primary" id="placeholder-header">
    <div class= "card-header">
			<h3 class="card-title" id="placeholder-title" >Placeholders</h3>
    </div >
  <form id="placeholder-select-form">
    <div class="card-body">
	<div class="form-group row">
		<div class="col-md-2">Type</div>
		<div class="col-md-2">Field</div>
		<div class="col-md-8">Value</div>
	</div>
    <div class="form-group row">
					<div class="col-md-2"> 
						<select  name="selected_type" id="selected-type"  class="form-control select2">
							${placeholderOptions.join('')}
						</select>
					</div>
					<div class="col-md-2"> 
						<select  name="selected_field" id="selected-field"  class="form-control select2" >
						
						</select>
          	</div>
						<div class="col-md-8">
              <select  name="filter" id="filter"  class="form-control select2">

						</select>
						</div>
				
				</div
      </div>
    </div>
    <div class="card-footer">
      <div class="row">
          <div class="col-6" align="left">
              <button  id="select-cancel-bttn" onclick="$.fn.cancelDialog()"  class="btn btn-secondary">Cancel</button>
          </div>
          <div class="col-6" align="right">
              <button id="placeholder-select-bttn" class="btn btn-primary">Insert</button>
          </div>
      </div>
    </div>
  </form>
  </div>`);
  $('#myModal').modal(modalOptions);
  $('#myModal').show();


   var options = placeholderMap[ $('#selected-type').val()];
				$('#selected-field').empty();
				options.forEach( (opts) =>{
       $('#selected-field').append(opts);
        });
  
  
  // modified select options based on another select element
  $('#selected-type').on('change', (e) => {
	  
    var options = placeholderMap[e.target.value];
				$('#selected-field').empty();
				options.forEach( (opts) =>{
       $('#selected-field').append(opts);
				});
	  
  })

  const updateFieldOption = (e) => {
      $('#filter').empty();
      const table = $('#selected-type').val();
    let field = e?e.target.value.toLowerCase():$('#selected-field').val();//;
      let possibleValues=[]
      const tableData = Object.keys(window.tableMap).includes(table) && window.tableMap[table].data ? window.tableMap[table].data : null;
    if (tableData && tableData.length > 0) { 
       // const regPat = /<<@(.+)>>/
      //field = field && field.length > 0?field[1]:field
      field = field.replaceAll("/", "");

      possibleValues = tableData.map((record) => { 

          return record[field];
        })
       
      }
      const possibleOptions = possibleValues.map(( field,i) => { 
			
					   return `<option value="${field}" >${field}</option>`;

      })

    $('#filter').empty();

    $('#filter').append(`<option value="@DYNAMIC_PLACEHOLDER">DYNAMIC</option>`);

				possibleOptions.forEach( (opts) =>{
           $('#filter').append(opts);
				});  
    
   }

  $('#selected-field').on('change', (e) => { 
       updateFieldOption(e)
    
  })
      
  

  $('.select2').select2();
  $('#selected-type').val(placeholderTypes[0])
  $("#placeholder-select-bttn").on('click', (e) => {
    let placeholderType = $('#selected-type').val().toUpperCase();
    let placeholder = $('#selected-field').val();
    let placeholderValue = $("#filter").val();
    //console.log("placeholder: ",placeholder.replaceAll("/","").toLowerCase())
     if(['file_url','file_path'].includes(placeholder.replaceAll("/","").toLowerCase()) ){
          context.invoke('editor.insertText',`<a href="${placeholderValue}">${placeholder.replaceAll("/","")} </a>`);
      }else if(['image_url', 'google_url'].includes(placeholder.replaceAll("/","").toLowerCase()) ){
          context.invoke('editor.insertText',`<img src="${placeholderValue}" alt="${placeholder.replaceAll('/','')} image"/>`);
      }else  if( placeholderValue!=="@DYNAMIC_PLACEHOLDER"){
          context.invoke('editor.insertText',placeholderValue);
      } else{
        context.invoke('editor.insertText',`[${placeholderType}${placeholder}${placeholderValue}_FOR_${placeholderType}]`); 
      }
      $.fn.cancelDialog();
	  
  })
  updateFieldOption({ "target": {"value":"Active"} });
 

}       
$.fn.displayDate = (row, column) => { 
   return  Object.keys(row).indexOf(column) > -1 && Object.keys(row[column]).indexOf('$date') > -1 ? new Date(row[column]['$date']).toString() : row[column]
}
$.fn.getObjectIcon = (objectType)=>{
    const iconMap = {
        "images": "fas fa-image"
        ,"files": "fas fa-file-alt"
        ,"banners": "fa fa-flag"
        ,"sliders": "fas fa-photo-video"
        ,"pagetemplates": "fas fa-file-invoice"
        ,"pages": "fas fa-book-open"
        ,"sitesettings":"fas fa-tools"
        , "roles": "far fa-id-badge"
        , "users": "fas fa-users"
        ,"audittrail": "fas fa-clipboard-list"
  }
  return Object.keys(iconMap).includes(objectType.toLowerCase()) ? iconMap[objectType] : 'fa fa-question-circle';
 

}

/**
 * =====================================================================================================================
 * 
 * This section is for functions that create tables on the Admin Panel
 * 
 * =======================================================================================================================
 */

$.fn.showUpdatedTable = (result, objectType) => {
     //$.fn.refreshLocalTables()
    if (result && result.message && result.message.toLowerCase() == 'invalid session information') {
        window.location = 'auth/logout';
    }
  $.fn.syncLokiCollection($.fn.capitalize(objectType), () => {  $.fn.showTableRecords(objectType) }) 
    let messageType = result.message.toLowerCase().indexOf('success') > -1 ? 'success' : 'danger';
	  $.fn.showAlert(result.message, messageType, () =>{ $.fn.showTableRecords(objectType) })

}

$.fn.getTable = (objectType, results, statsIcon = "fa fa-arrows-alt") => { 

  let loadingTableData = [];
    if(objectType == 'sitesettings'){
        let settingsTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editSettings({'settings_id': 1})">Site Settings</a>`, "statsIcon": `${$.fn.getObjectIcon('sitesettings')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
      $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${settingsTable}</div>`);
    

    }else if(objectType == 'users'){
        let usersTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editusers({'users_id': 1})">Site users</a>`, "statsIcon": `${$.fn.getObjectIcon('users')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
       $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${usersTable}</div>`);

    } else if(objectType == 'images') { 
        let imagesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editImage()">Images</a>`, "statsIcon": `${$.fn.getObjectIcon('images')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${imagesTable}</div>`);

    } else if(objectType == 'files') { 
        let filesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editFile()">Files</a>`, "statsIcon": `${$.fn.getObjectIcon('files')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${filesTable}</div>`);

    } else if(objectType == 'roles') { 

        let rolesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editRole)">Roles</a>`, "statsIcon": `${$.fn.getObjectIcon('roles')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${rolesTable}</div>`);

    }else if(objectType == 'pages') { 
       let pagesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editPage()">Pages</a>`, "statsIcon": `${$.fn.getObjectIcon('pages')}`, "tableData": [], "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${pagesTable}</div>`);
    }
    else if(objectType == 'sections') { 
        let sectionsTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editSection()">Sections</a>`, "statsIcon": "fas fa-user-secret", "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${sectionsTable}</div>`);
    } else if(objectType == 'mailtemplates') { 

        let mailtemplatesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editMailTemplate()">Templates</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${mailtemplatesTable}</div>`);

    }	else if(objectType == 'clients') { 

        let clientsTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editClient()">Clients</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${clientsTable}</div>`);

    }else if(objectType == 'pagetemplates') { 
              
              let pageTemplatesTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editTemplate()">Page Templates</a>`, "statsIcon": `${$.fn.getObjectIcon('pagetemplates')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${pageTemplatesTable}</div>`);

      } else if(objectType == 'banners') { 

              let bannersTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editBanner()">Banners</a>`, "statsIcon": `${$.fn.getObjectIcon('banners')}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${bannersTable}</div>`);

      }else if(objectType == 'eventtypes') { 

              let eventTypeTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editEventType()">Event Types</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${eventTypeTable}</div>`);

      } else if(objectType == 'events') { 

              let eventTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editEvent()">Events</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${eventTable}</div>`);

      }  else if(objectType == 'schedules') { 

              let scheduleTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editSchedule()">Schedules</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${scheduleTable}</div>`);

        }  else if(objectType == 'eventtriggers') { 

              let  triggerTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editEventTrigger()">Event Trigger</a>`, "statsIcon": `"${statsIcon}"`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${triggerTable}</div>`);

        }  else if(objectType == 'sliders') { 

              let  sliderTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editEventTrigger()">Sliders(Carousels)</a>`, "statsIcon": `${statsIcon}`, "tableData": loadingTableData, "id": objectType, "statsClass": "secondary" });
              $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${sliderTable}</div>`);

        }



  const tableData = $.fn.getTableRecords(objectType,results[objectType]);
  const records = tableData['records'];
  let columns = [];
  // localStorage.setItem('store_name', 'data_name'); 
  // console.log(window.columnOrder);
  if (!Object.keys(window.columnOrder).includes(objectType)){
       $.ajax({
            url: `/cpanel/columns/${objectType}?acky=${currentUser.acky}`,
            type: "GET",
            processData: false,
            contentType: false,
            crossDomain: true,
         success: (results) => {
                if (Object.keys(results).includes("message") && results["message"] == "Invalid session information" || !results.columnOrder) { 
                    window.location = 'auth/logout';
                }
               window.columnOrder[objectType]  = results;
               window.columnOrder[objectType].columnOrder.forEach((column) => { if (!excludedLokiFields.includes(column.toLowerCase())) { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }) } }) 
              $('#loading-row').remove();
              $(`#${objectType}`).DataTable({
              "aaData": records
              , "columns": columns,
              "paging": true,
              "lengthChange": true,
              "searching": true,
              "ordering": true,
              "info": false,
              "autoWidth": true,
              "responsive": true
              })

    
            },
            error: (e) => {         
                  $.fn.showAlert('Column Order Check Failed', 'danger', '$.fn.closeDialog()')
            }
            })

  } else{ 
    window.columnOrder[objectType].columnOrder.forEach((column) => { if (!excludedLokiFields.includes(column.toLowerCase())) { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }) } });
  
          $('#loading-row').remove();
          $(`#${objectType}`).DataTable({
          "aaData": records
          , "columns": columns,
          "paging": true,
          "lengthChange": true,
          "searching": true,
          "ordering": true,
          "info": false,
          "autoWidth": true,
          "responsive": true
          })

  }
  


}

 $.fn.displayTable =  (objectType,records, tableID)=> { 
   let columns = [];

	  if (!Object.keys(window.columnOrder).includes(objectType)){
		   $.ajax({
				url: `/cpanel/columns/${objectType}?acky=${currentUser.acky}`,
				type: "GET",
				processData: false,
				contentType: false,
				crossDomain: true,
				success: (results) => {
            window.columnOrder[objectType] = results;			  
            window.columnOrder[objectType].columnOrder.forEach((column) => { if (!excludedLokiFields.includes(column.toLowerCase())) { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }) } }) 


            $(`#${tableID}`).DataTable({
                "aaData": records,
                "columns": columns,
                "paging": true,
                "lengthChange": true,
                "searching": true,
                "ordering": true,
                "info": false,
                "autoWidth": true,
                "responsive": true
				  })

		
				},
				error: (e) => {
					  
					  $.fn.showAlert('Column Order Check Failed', 'danger', '$.fn.closeDialog()')

				}
				})


	  } else{ 
			window.columnOrder[objectType].columnOrder.forEach((column) => { if (!excludedLokiFields.includes(column.toLowerCase())) { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }) } }) 
			  //$('#loading-row').remove();
			  $(`#${tableID}`).DataTable({
			  "aaData": records
			  , "columns": columns,
			  "paging": true,
			  "lengthChange": true,
			  "searching": true,
			  "ordering": true,
			  "info": false,
			  "autoWidth": true,
			  "responsive": true
			  })

	  }
  
 }


$.fn.drawMailTable = (results) => { 

      let imapAccounts  =  $.fn.getTableRecords('imapaccounts', results['imapaccounts']);
      let gmailAccounts = $.fn.getTableRecords('gmailaccounts', results['gmailaccounts']);
      let imapTable  = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editMailBox()">Mail Accounts</a>`, "statsIcon": "fa fa-envelope", "tableData":[] , "id": "imap-accounts", "statsClass": "primary" })
      let gmailTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editGmailBox()">Gmail Accounts</a>`, "statsIcon": "fa fa-envelope", "tableData": gmailAccounts, "id": "gmail-accounts", "statsClass": "danger" })
      $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${imapTable}</div>
      <div class="row">${gmailTable}</div></div>`);
        
      $.fn.displayTable('ImapAccounts',  imapAccounts['records'] ,'imap-accounts'); 
      $.fn.displayTable('GmailAccounts',   gmailAccounts['records'],'gmail-accounts');

}

$.fn.drawAuditTrailTable = (results) => { 
       
        let audittrail = results['audittrail'];
        let tableText  = DashboardTable({ "statsTitle": "AuditTrail", "statsIcon": `${$.fn.getObjectIcon('audittrail')}`, "statsClass": "secondary", "tableData": [], "id": "audittrail" })
        $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${tableText}</div></div>`)
        let columns = [{
          'orderable': false,
          'data': null,
          'defaultContent': 'No Data Available'
        }]
        let newRecords = []
        if (audittrail && audittrail.length > 0) {

          let columnNames = [];
          columns.push({ 'sTitle': 'Trail ID', 'data': 'trail_id', 'defaultContent': '' })
          $.fn.getColumns(audittrail).filter((column) => !['trail_id', '$loki', 'meta','current_version'].includes(column)).forEach((column) => { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }); columnNames.push(column) })
          columns[0]['defaultContent'] = '';
          newRecords = audittrail.map((record) => {

            return ({
              ...record, 'oldData': JSON.stringify(record['oldData'])
              , 'newData': JSON.stringify(record['newData'])
            ,'changeTime':  new Date(record['changeTime']["$date"])
            })
          })
        } 
        $('#loading-row').remove();
        $('#audittrail').DataTable({
          "aaData": newRecords
          , "columns": columns,
          "paging": true,
          "lengthChange": true,
          "searching": true,
          "ordering": true,
          "info": false,
          "autoWidth": true,
          "responsive": true
        })
}
$.fn.drawJobsTable = (results) => {

  let jobs = results['jobs'];
  let tableText = DashboardTable({ "statsTitle": "Job", "statsIcon": "fa fa-bolt", "statsClass": "secondary", "tableData": [], "id": "jobs" })
  $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">${tableText}</div></div>`)
  let columns = [{
    'orderable': false,
    'data': null,
    'defaultContent': 'No Data Available'
  }]
  let newRecords = []
  if (jobs && jobs.length > 0) {
    let columnNames = [];
    columns.push({ 'sTitle': 'Job ID', 'data': 'job_id', 'defaultContent': '' })
    $.fn.getColumns(jobs).filter((column) => !['job_id', '$loki', 'meta'].includes(column)).forEach((column) => { let col = column.split('_').map((str) => { return $.fn.capitalize(str) }).join(' '); columns.push({ 'sTitle': col, 'data': column, 'defaultContent': '' }); columnNames.push(column) })
    columns[0]['defaultContent'] = '';
    newRecords = jobs.map((record) => {

      record['startTime'] = Object.keys(record).indexOf('startTime') > -1 ? new Date(record['startTime']['$date']).toString() : '';
      record['endTime'] = Object.keys(record).indexOf('endTime') > -1 ? new Date(record['endTime']['$date']).toString() : '';
      record['info'] = Object.keys(record).indexOf('info') > -1 ? JSON.stringify(record['info']) : '';
      record['errors'] = Object.keys(record).indexOf('errors') > -1 ? JSON.stringify(record['errors']) : '';
      let rowColumns = Object.keys(record)
      let missingColumns = columnNames.filter(x => !rowColumns.includes(x));
      missingColumns.forEach((column) => {
        record[column] = '';
      })
      return record;
    })
  }
  $('#loading-row').remove();
  $('#jobs').DataTable({
    "aaData": newRecords
    , "columns": columns,
    "paging": true,
    "lengthChange": true,
    "searching": true,
    "ordering": true,
    "info": false,
    "autoWidth": true,
    "responsive": true
  })
}


/**
 * =====================================================================================================================
 * 
 * This section is for functions that perform sidebar actions 
 * 
 * =======================================================================================================================
 */


$.fn.showTableRecords = (objectType) => {
    //$.fn.refreshLocalTables();
    $.fn.highlightSidebar(objectType)
    DisplayManager.lastRunFunction   = `$.fn.showTableRecords('${objectType}')`;
    DisplayManager.lastObjectType = objectType;
  
    if (document.getElementsByTagName('head')[0].lastChild.href  && document.getElementsByTagName('head')[0].lastChild.href == "http://localhost:8488/static/css/style.css") { 
       document.getElementsByTagName('head')[0].lastChild.remove()
       document.getElementsByTagName('body')[0].lastChild.remove()
    }

  if (objectType.toLowerCase() != 'mailaccounts') {
      
			  let records = Object.keys(window.tableMap).includes($.fn.capitalize(objectType)) && window.tableMap[$.fn.capitalize(objectType)]!=null &&  Object.keys(window.tableMap[$.fn.capitalize(objectType)]).includes('data') ? window.tableMap[$.fn.capitalize(objectType)]?.data : null;

      if (!forceOnlineFetch && (records && records.length > 0)) {
            console.log("Fetching settings: ", records.length)
            $.fn.getTable(objectType, { 'records': records });
        
			  } else {
				$.ajax({
				  url: `/cpanel/data/${objectType}?${objectType}={}&acky=${currentUser.acky}`,
				  type: "GET",
				  processData: false,
				  contentType: false,
				  crossDomain: true,
          success: (results) => {
            
					    $.fn.getTable(objectType, results);
				  }
				  , error: (err) => {
					  
					  let recordType = objectType;
            if (objectType == 'sitesettings') {
						  
              recordType = 'Site Settings';
						  
            } else if (objectType == 'teammembers') {
						 
              recordType = 'Team Members';
						  
            } else if (objectType == 'servicetypes') {

                recordType = 'Service Types'
             }

					     $.fn.showAlert(`${recordType} could not be displayed`, 'danger','$.fn.closeDialog()')
					
				  }


				});
			  }

		}else{

			  $('.page-title').text('Email Accounts')
			  let imap = window.tableMap['IMAPAccounts'] && window.tableMap['IMAPAccounts'].data ? window.tableMap['IMAPAccounts'].data : null;;
			  let gmail = window.tableMap['GMailAccounts'] && window.tableMap['GMailAccounts'].data ? window.tableMap['GMailAccounts'].data : null;
			  if (!forceOnlineFetch && (imap && imap.length > 0) && (gmail && gmail.length > 0)) {
				             $.fn.drawMailTable({ 'imapaccounts': imap, 'gmailaccounts': gmail })
			  } else {
				$.ajax({
				  url: `/cpanel/data/ImapAccounts+GmailAccounts?imapaccounts={}&gmailaccounts={}&acky=${currentUser.acky}`,
				  type: "GET",
				  processData: false,
				  contentType: false,
				  crossDomain: true,
				  success: (results) => {
					    $.fn.drawMailTable(results);
				  },
				  error: (e) => {
           
					  $.fn.showAlert('Email Accounts could not be displayed', 'danger', '$.fn.closeDialog()')
					  console.log(e)

				  }
				});
			  }
			
			
		}

}

$.fn.showSettings= () => {
  const objectType = 'sitesettings';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.showSettings()`;
  DisplayManager.lastObjectType = objectType;
  
  let sitesettings = Object.keys(window.tableMap).includes($.fn.capitalize(objectType)) && window.tableMap[$.fn.capitalize(objectType)].data ? window.tableMap[$.fn.capitalize(objectType)].data : null;
 
  if (!forceOnlineFetch && ( sitesettings && sitesettings.length > 0)) {
    //  $.fn.drawSettingsTable({'sitesettings':sitesettings})
      $.fn.getTable(objectType, {'sitesettings':sitesettings})
  } else {
    $.ajax({
      url: `/cpanel/data/${objectType}?${objectType}={}&acky=${currentUser.acky}`,
      type: "GET",
      processData: false,
      contentType: false,
      crossDomain: true,
      success: (results) => {
       // $.fn.drawSettingsTable(results);
        $.fn.getTable(objectType, results);
      }
      , error: (err) => {

        $.fn.showAlert('Settings could not be displayed', 'danger','$.fn.closeDialog()')
      }


    });
  }

}

$.fn.showImages= () => {
  const objectType = 'images';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.showImages()`;
  DisplayManager.lastObjectType = objectType;
  
  let images = Object.keys(window.tableMap).includes($.fn.capitalize(objectType)) && window.tableMap[$.fn.capitalize(objectType)].data ? window.tableMap[$.fn.capitalize(objectType)].data : null;
 
  if (!forceOnlineFetch && ( images && images.length > 0)) {
    //  $.fn.drawImageTable({'images':images})
    $.fn.getTable(objectType, {'images':images})
    
  } else {
    $.ajax({
      url: `/cpanel/data/${objectType}?${objectType}={}&acky=${currentUser.acky}`,
      type: "GET",
      processData: false,
      contentType: false,
      crossDomain: true,
      success: (results) => {
        $.fn.getTable(objectType, results);
        
      }
      , error: (err) => {

        $.fn.showAlert('Images could not be displayed', 'danger','$.fn.closeDialog()')
      }


    });
  }

}


$.fn.showAuditTrail = () => {
  const objectType = 'audittrail';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.showAuditTrail()`;
  DisplayManager.lastObjectType = objectType;

  $('.page-title').text('AuditTrail')
  let trails = Object.keys(window.tableMap).includes('AuditTrail') ? window.tableMap['AuditTrail'].data : null;
  if (trails && trails.length > 0) {
   $.fn.drawAuditTrailTable ({ 'audittrail': trails })
  } else {
    $.ajax({
      url: `/cpanel/data/audittrail?audittrail={}&acky=${currentUser.acky}`,
      type: "GET",
      processData: false,
      contentType: false,
      crossDomain: true,
      success: (results) => {
            $.fn.drawAuditTrailTable(results)
      },
      error: (e) => {
           $.fn.showAlert('AuditTrail could not be displayed', 'danger','$.fn.closeDialog()')
      }
    });
  }
}


$.fn.showJobs = () => {
  const objectType = 'jobs';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.showJobs()`;
  DisplayManager.lastObjectType = objectType;

  $('.page-title').text('Jobs')
  let jobs = Object.keys(window.tableMap).includes('Jobs') ? window.tableMap['Jobs'].data : null;
  if (jobs && jobs.length > 0) {
    $.fn.drawJobsTable({ 'jobs': jobs })
  } else {
    $.ajax({
      url: `/cpanel/data/jobs?jobs={}&acky=${currentUser.acky}`,
      type: "GET",
      processData: false,
      contentType: false,
      crossDomain: true,
      success: (results) => {
        $.fn.drawJobsTable(results)
      },
      error: (e) => {
        $.fn.showAlert('Jobs could not be displayed', 'danger')
      }
    });
  }
  //$('#sidebarnav-node-' + position + '-link').addClass("active");
}

/**
 * =====================================================================================================================
 * 
 * This section is for functions that manage objects
 * 
 * =======================================================================================================================
 */

$.fn.postFormData = (objectType,formData,errorHeader) => { 

          $.ajax({
              url: `/cpanel/add/${objectType}`,
              type: "POST",
              data: formData,
              processData: false,
              contentType: false,
              crossDomain: true,
            success: (result) => {
                
                $.fn.showUpdatedTable(result, objectType)
              },
              error: (e) => {
                    
                $.fn.showAlert(errorHeader, 'danger', () => { $.fn.showTableRecords(objectType) });

              }
          })

}
$.fn.editComponent = (
            objectType, 
			      requiredTables,  
			      queryMap,
			      handleSuccess,
            handleError=(e)=> {
                console.log(e)

              }  
		          ) => {
				
                  $.fn.highlightSidebar(objectType);
                  DisplayManager.lastRunFunction = `$.fn.editComponent('${objectType}',${JSON.stringify(requiredTables)},${JSON.stringify(queryMap)})`;
                  DisplayManager.lastObjectType = objectType;
                  let query = Object.keys(queryMap).includes(objectType)&& queryMap[objectType]!={}?queryMap[objectType]:'none'
                  if($.fn.getObjectType(requiredTables)=="string"){
                    requiredTables = JSON.parse(requiredTables) 
                  }
                  if($.fn.getObjectType(queryMap)=="string"){
                    queryMap = JSON.parse(queryMap) 
                  }
                  
                  const tables = requiredTables.map((table)=> table.toLowerCase()).join('+');
                  let filters = `${objectType}=${JSON.stringify(query)}&`;
                  
                  if(queryMap && Object.keys(queryMap).length >0){  
                  
                    Object.keys(queryMap).filter((tab)=>tab.toLowerCase() !=objectType.toLowerCase()).forEach((tab)=>{
                      let query = queryMap[tab]
                      filters+=`${tab}=${JSON.stringify(query)}&`  
                    })
                    
                    requiredTables.filter((table)=> {
                      let exists = false;
                      for(let tab in Object.keys(queryMap)){
                        if(tab.toLowerCase() == table.toLowerCase()){
                          exists=true;
                          break;
                        }   
                      }
                      return !exists;
                      
                      }).forEach((tab)=>{
                    
                      filters+=`${tab.toLowerCase()}={}&`  
                    });

                  }else{
                    
                    requiredTables.forEach((tab)=>{
                      filters+=`${tab.toLowerCase()}={}&`  
                    });
                    
                  }
                  
                  
                  let url =  `/cpanel/data/${tables}?${filters}acky=${currentUser.acky}`;
                  
                  $.ajax({
                  url: url,
                  type: "GET",
                  processData: false,
                  contentType: false,
                  crossDomain: true,
                  success: (results) => {
                    handleSuccess(results);

                    },
                    error: (e) => {
                      handleError(e);

                    }
                  })

}
$.fn.editSettings = (query = 'none') => {
  
  const objectType = 'sitesettings';
  $.fn.highlightSidebar(objectType);
  DisplayManager.lastRunFunction = `$.fn.editSettings(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  //let pages = Object.keys(window.tableMap).includes('Pages') && window.tableMap['Pages'] != null && Object.keys(window.tableMap['Pages']).includes('data') ? window.tableMap['Pages'].data : null; 

  $.ajax({
   url: `/cpanel/data/${objectType}+images+gmailaccounts+imapaccounts+pages?${objectType}=` + JSON.stringify(query)+`&images={}&gmailaccounts={}&imapaccounts={}&pages={}&acky=${currentUser.acky}`, 
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,
    success: (results) => {
      
      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
     // console.log(record)
      let titlePrefix = "Edit"
      let button = record ? 'Update' : 'Add';
      let disabled = record ? 'disabled="disabled"' : '';
      $('.page-title').text(titlePrefix + ' Settings');
		
      const syncModes = ['LOCAL','ONLINE'].map((mode, key) => {
              let selected = "";
              if (mode=='ONLINE') {
                selected = `selected="selected"`
              }
              return `<option value="${key}" ${selected}>${mode}</option>`
      })
      
      const images        = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [{ "name": "logo", "google_url": "/static/images/placeholder.png","image_type": "logo"},{ "name": "icon_image", "google_url": "/static/images/placeholder.png","image_type": "icon"},{ "name": "login_image", "google_url": "/static/images/placeholder.png","image_type": "login"}]
      const gmailAccounts = Object.keys(results).includes('gmailaccounts') && results['gmailaccounts'].length > 0 ? results['gmailaccounts'] : []
      const imapAccounts  = Object.keys(results).includes('imapaccounts') && results['imapaccounts'].length > 0 ? results['imapaccounts'] : [];
      const pages         = Object.keys(results).includes('pages') && results['pages'].length > 0 ? results['pages'] : [];
      const logoImages    = images && images.length > 0 ? images.filter((image) => image.image_type.toLowerCase() == "logo") : null;
      console.log(logoImages)
      let imagePreview    = logoImages && logoImages.length>0?logoImages[0].google_url:'/static/images/placeholder.png';
      const imageOptions  = logoImages.map((image) => {
      let selected        = "";
            
          if (record && record?.site_logo && image.google_url == record.site_logo) {

            selected = `selected="selected"`;
            imagePreview = $.fn.getGoogleUrl(image.google_url);
          }
  
        return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

      });

      let mailOptions = [];

      gmailAccounts.forEach((account) => {
        let selected = "";

   
        if (record && record?.default_mailing_account) {
          if (record.default_mailing_account && record?.default_mailing_account.length != "") { 
            let accountID = record.default_mailing_account.split(",")[1];
            if (account.account_id == accountID) { 

              selected = `selected="selected"`;
            }

          }
             
          }
        mailOptions.push(`<option value="gmail,${account.account_id}" ${selected}>${account.account_name}</option>`)

      });

      imapAccounts.forEach((account) => {
        let selected = "";

   
        if (record && record?.default_mailing_account) {
          if (record.default_mailing_account && record?.default_mailing_account.length != "") { 
            let accountID = record.default_mailing_account.split(",")[1];
            if (account.account_id == accountID) { 

              selected = `selected="selected"`;
            }

          }
             
          }
        mailOptions.push(`<option value="imap,${account.account_id}" ${selected}>${account.account_name}</option>`)

      });


      const iconImages = images ? images.filter((image) => image.image_type.toLowerCase() == "icons") : null;
      let iconImagePreview = iconImages && iconImages.length>0?iconImages[0].google_url:'/static/images/placeholder.png';
      const iconImageOptions = iconImages.map((image) => { 
                let selected = "";
                    
                  if (record && record?.site_icon && image.google_url.trim()== record.site_icon.trim()) {

                    selected = `selected="selected"`;
                    iconImagePreview = $.fn.getGoogleUrl(image.google_url);
                  }
                  
              return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`;

            });
      const loginImages = images ? images.filter((image) => image.image_type.toLowerCase() == "login") : null;
      let loginImagePreview = loginImages && loginImages.length>0?loginImages[0].google_url:'/static/images/placeholder.png';
     
      const loginImageOptions = loginImages.map((image) => {
        let selected = "";
      
        if (record && record?.login_image && image.google_url.trim() == record.login_image.trim()) {

          selected = `selected="selected"`;
          loginImagePreview = $.fn.getGoogleUrl(image.google_url);
        }
              
        return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`;

      });

         let isHomePageOptions = pages && pages.length > 0 ? pages.map((page) => {
            let selected = "";
            if (record && parseInt(record.home_page_id) == parseInt(page.page_id)){
              selected = `selected="selected"`
            }
            return `<option value="${page.page_id}" ${selected}>${page.page_name}</option>`
          }) : [];
	   
     
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
         <h3 class="card-title"> <i class="${$.fn.getObjectIcon('sitesettings')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} Settings</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">   
          <div class="form-group row">
              <label for="site-name" class="col-sm-2 col-form-label">Site Name</label>
            <div class="col-sm-10">
            <input type="text"   class="form-control"  id="site-name" name="site_name"  value="${record?.site_name ? record.site_name : ''}">
            </div>
          </div>
          <div class="form-group row">
              <label for="site-title" class="col-sm-2 col-form-label">Site Title</label>
            <div class="col-sm-10">
            <input type="text"   class="form-control"  id="site-title" name="site_title"  value="${record?.site_title ? record.site_title : ''}">
            </div>
          </div>
          <div class="form-group row">
              <label for="site-id" class="col-sm-2 col-form-label">Site ID</label>
            <div class="col-sm-10">
            <input type="text"   class="form-control"  id="site-id" name="site_id"  value="${record?.site_id ? record.site_id : ''}">
            </div>
          </div>
          <div class="form-group row">
              <label for="site-description" class="col-sm-2 col-form-label">Site Description</label>
            <div class="col-sm-10">
            <input type="text"   class="form-control"  id="site-description" name="site_description"  value="${record?.site_description ? record.site_description : ''}">
            </div>
          </div>

          <div class="form-group row">
          <label  for="site-logo-img" class="col-md-2">Site Logo</label>
          <div class="col-md-10"> 
          <div id="image-preview" class="text-center"><img  class="img-fluid" style="height:auto;max-width:100%"  id="preview-image" src="${imagePreview}" alt="logo preview"/> </div>
          <select name="site_logo" id="site-logo-img" class="form-control select2" style="width: 100%;">
              ${imageOptions}
          </select>
            
          </div>
          </div>
                    <div class="form-group row">
          <label  for="site-icon" class="col-md-2">Site icon</label>
          <div class="col-md-10"> 
          <div id="image-preview" class="text-center"><img  class="img-fluid" style="height:auto;max-width:100%"  id="icon-preview-image" src="${iconImagePreview}" alt="icon preview"/> </div>
          <select name="site_icon" id="site-icon" class="form-control select2" style="width: 100%;">
              ${iconImageOptions}
          </select>
            
          </div>
          </div>

            <div class="form-group row">
          <label  for="login-image" class="col-md-2">Login Image</label>
          <div class="col-md-10"> 
                <div id="image-preview" class="text-center"><img   class="img-fluid" style="height:auto;max-width:100%"  id="login-preview-image" src="${loginImagePreview}" alt="login preview"/> </div>
                <select name="login_mage" id="login-image" class="form-control select2" style="width: 100%;">
                    ${loginImageOptions}
                </select>
            
          </div>
        </div>
               <div class="form-group row">
          <label  for="mailing-account" class="col-md-2">Default Mailing Account</label>
          <div class="col-md-10"> 
          
          <select name="mailing_account" id="mailing-account" class="form-control select2" style="width: 100%;">
              ${mailOptions}
          </select>
            
          </div>
          </div>
	   		  <div class="form-group row">
			<label  for="hopme-page" class="col-md-2">Is Home Page</label>
			<div class="col-md-10"> 
				<select name="home_page" id="home-page" class="form-control select2" style="width: 100%;">
					${isHomePageOptions}
				</select>
			</div>
		</div>
		  <div class="form-group row">
                <label for="site-keywords" class="col-sm-2 col-form-label">Site Keywords</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="site-keywords" name="site_keywords"  value="${record?.site_keywords ? record.site_keywords : ''}">
              </div>
          </div>
		  <div class="form-group row">
                <label for="startup-message" class="col-sm-2 col-form-label">Startup Message</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="startup-message" name="startup_message"  value="${record?.startup_message ? record.startup_message : ''}">
              </div>
          </div>	
		  <div class="form-group row">
                <label for="address" class="col-sm-2 col-form-label">Address</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="address" name="address"  value="${record?.address ? record.address : ''}">
              </div>
          </div>	
		  <div class="form-group row">
                <label for="email" class="col-sm-2 col-form-label">Email</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="email" name="email"  value="${record?.email ? record.email : ''}">
              </div>
          </div>	
		  <div class="form-group row">
                <label for="phone-number" class="col-sm-2 col-form-label">Phone Number</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="phone-number" name="phone_number"  value="${record?.phone_number ? record.phone_number : ''}">
              </div>
          </div>
                <div class="form-group row">
              <label for="contact-us-message" class="col-sm-2 col-form-label">Contact Us Message</label>
            <div class="col-sm-10">
            <textarea   class="form-control"  id="contact-us-message" name="contact_us_message"  value="${record?.contact_us_message ? record.contact_us_message : ''}">
                 ${record?.contact_us_message ? record.contact_us_message : ''}
            </textarea>
            </div>
          </div>
		  <div class="form-group row">
                <label for="google-map" class="col-sm-2 col-form-label">Map Location</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="google-map" name="google_map"  value="${record?.google_map ? record.google_map : ''}">
              </div>
          </div>			  
		  	  <div class="form-group row">
                <label for="secret-key" class="col-sm-2 col-form-label">Secret Key</label>
              <div class="col-sm-10">
                 <input type="password"   class="form-control"  id="secret-key" name="secret_key"  value="${record?.secret_key ? record.secret_key : ''}">
              </div>
          </div>
						<div class="form-group row">
						<label  for="sync-mode" class="col-md-2">Sync Mode</label>
						<div class="col-md-10"> 
							<select name="sync_mode" id="sync-mode" class="form-control select2" style="width: 100%;">
								${syncModes}
							</select>
						</div>
					</div>
					<div class="form-group row">
                <label for="time-out" class="col-sm-2 col-form-label">Session Timeout (minutes)</label>
              <div class="col-sm-10">
              <input type="text"   class="form-control"  id="time-out" name="time_out"  value="${record?.time_out_minutes ? record.time_out_minutes : ''}">
              </div>
          </div>
	
         <div class="form-group row">
							<label for="social-media" class="col-sm-2 col-form-label">Social Media</label>
							<div class="col-sm-10"> 
							${$.fn.getObjectMapperOld('social-media', 'Site', 'URL', record?.social_media)}
							</div>
						</div>	
						<div class="form-group row">
							<label for="overrides" class="col-sm-2 col-form-label">Overrides</label>
							<div class="col-sm-10">
								 	${$.fn.getObjectMapperOld('overrides', 'Parameter', 'Value', record?.overrides)}
							</div>
						</div>						
              <div class="form-group row">
                  <label for="role-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.getDateFromObject(record.created_datetime) : ''}" placeholder="" disabled>
                  </div>
                </div>
           <div class="form-group row">
                <label for="role-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.getDateFromObject(record.last_modified_date) : ''}" placeholder="" disabled>
                </div>
              </div>
         </div>
          <div class="card-footer">
          <button type="cancel" class="btn btn-default float-left" id="settings-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="settings-submit-btn">${button}</button>
          </div>
        </form>
      </div></div></div>`
      );
      $('#settings-cancel-btn').on('click', (e) => {
            e.preventDefault();
            $.fn.showTableRecords('sitesettings');
        })
       $('#social-media-table').DataTable();
       $('#overrides-table').DataTable();
        $('.select2').select2();
        //$('#site-name').on('change',    (e)   => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'site-title', 'site-title', 'site-description',  'startup-message', 'secret-key', 'address','email','phone-number','time-out']) })
        //$('#site-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', ['site-title', 'site-name',  'startup-message', 'secret-key', 'address', 'email', 'phone-number',  'time-out']) })
        //$('#site-title').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn',  ['site-name', 'site-title', 'site-description',  'startup-message', 'secret-key', 'address','email','phone-number', 'time-out']) }) 
        //$('#site-id').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [  'startup-message', 'secret-key', 'address', 'email', 'phone-number',  'time-out']) })
        $('#site-keywords').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message', 'secret-key', 'address', 'email', 'phone-number',  'time-out']) })
        $('#startup-message').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [  'secret-key', 'address', 'email', 'phone-number',  'time-out']) })
        $('#secret-key').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message',  'address', 'email', 'phone-number',  'time-out']) })
        $('#address').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message', 'secret-key',  'email', 'phone-number',  'time-out']) })
        $('#email').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message', 'secret-key', 'address',  'phone-number',  'time-out']) })
        $('#phone-number').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message', 'secret-key', 'address',  'email',  'time-out']) })
        $('#time-out').on('change', (e) => { $.fn.isFieldValid(e.target, 'settings-submit-btn', [ 'startup-message', 'secret-key', 'address', 'email', 'phone-number',  'contact-us-message']) })
        $('#contact-us-message,#site-description,#site-title,#site-name,#site-id,#site-keywords').on('change', (e) => {
           console.log(e.target.value)
          let message = e.target.value
            if (message && message == "") {
              if (!$(this).hasClass('is-invalid')) {
                $(this).addClass('is-invalid')
              }

            } else {

              if ($(this).hasClass('is-invalid')) {
                $(this).removeClass('is-invalid');
              }
            }
      });

      
        $('#site-logo-img').on('change', (e) => {
          let imageUrl = $.fn.getGoogleUrl(e.target.value);
          $("#preview-image").attr("src", imageUrl);
          $("#site-logo").val(imageUrl)
	  
        });

        $('#site-icon').on('change', (e) => {
          let imageUrl = $.fn.getGoogleUrl(e.target.value);
          $("#icon-preview-image").attr("src",imageUrl);
           $("#sidebar-logo").attr("src",imageUrl)
	  
        });

              $('#login-image').on('change', (e) => {
          let imageUrl = $.fn.getGoogleUrl(e.target.value);
          $("#login-preview-image").attr("src",imageUrl);
            $("#preloader-image").attr("src",imageUrl)
	  
        });
        
       $('#google-map').on('change', (e) => {

              if ($.fn.isValidURL(e.target.value.trim())) {
                          if (!$(this).hasClass('is-invalid')) {
                            $(this).addClass('is-invalid')
                          }
                          $('#settings-submit-btn').attr('disabled', 'disabled')
                            
              } else {
                if ($(this).hasClass('is-invalid')) {
                  $(this).removeClass('is-invalid');
                            }
                            $('#settings-submit-btn').removeAttr('disabled')
            }
       })
      
          $('#settings-submit-btn').on('click', (e) => { 
            e.preventDefault();
            let siteName         = $('#site-name').val();
            let description      = $('#site-description').val();
            let siteID           = $('#site-id').val();
            let siteLogo         = $('#site-logo-img').val()
            let siteIcon         = $('#site-icon').val()
            let keywords         = $('#site-keywords').val();
            let siteTitle        = $('#site-title').val()
            let startupMessage   = $('#startup-message').val()
            let secretKey        = $('#secret-key').val()
            let address          = $('#address').val()
            let email            = $('#email').val()
            let phoneNumber      = $('#phone-number').val()
            let googleMap        = $('#google-map').val();
            let homePageID       = $('#home-page').val()
            let socialMedia      = JSON.stringify($.fn.getObjectFromMapperOld('social-media'))
            let syncMode         = $('#sync-mode').val()
            let timeOut          = $('#time-out').val()
            let contactUsMessage = $('#contact-us-message').val()
            let overrides        = JSON.stringify($.fn.getObjectFromMapperOld('overrides'))
            let loginImage       = $('#login-image').val();
            let mailingAccount   = $('#mailing-account').val();
            // Object.keys(overrides).forEach((entry)=> console.log(entry, overrides[entry]))
 		 let validCount = 0;
		 ['contact-us-message','site-description','site-title','site-name','site-id','site-keywords'].forEach((id)=>{
            
              let message = $("#"+id).val()
                    if (message && message == "") {
                      if (!$("#"+id).hasClass('is-invalid')) {
                      $("#"+id).addClass('is-invalid')
                      }

                    } else {

                      if ($("#"+id).hasClass('is-invalid')) {
                        $("#"+id).removeClass('is-invalid');
                      }
                validCount+=1;
                    }
            
            })
            let isValid =validCount ==6 && contactUsMessage.length > 0 && $.fn.areFieldsValid('settings-submit-btn', [ 'startup-message', 'secret-key', 'address', 'email', 'phone-number', 'time-out']) 
            
            if (isValid) {
                  
                  const formData = new FormData();
                  formData.append("mode", "edit");
                  formData.append("acky", currentUser.acky);
                  formData.append("site_name",siteName)
                  formData.append("site_id",siteID)
                  formData.append("site_title",siteTitle)
                  formData.append("site_description", description)
                  formData.append("site_logo", siteLogo);
                  formData.append("site_icon", siteIcon);
                  formData.append("site_keywords",keywords)
                  formData.append("startup_message",startupMessage)
                  formData.append("secret_key",secretKey)
                  formData.append("address",address)
                  formData.append("email",email)
                  formData.append("phone_number",phoneNumber)
                  formData.append("google_map",googleMap)
                  formData.append("sync_mode",syncMode)
                  formData.append("time_out_minutes", timeOut)
                  formData.append("overrides",overrides)
                  formData.append("social_media",socialMedia)
                  formData.append("contact_us_message", contactUsMessage);
                  formData.append("login_image", loginImage)
                  formData.append("default_mailing_account", mailingAccount)
                  formData.append("home_page_id",homePageID)
  
                  $.ajax({
                  url: `/cpanel/add/${objectType}`,
                  type: "POST",
                  data: formData,
                  processData: false,
                  contentType: false,
                  crossDomain: true,
                  success: (result) => {
                    $.fn.showUpdatedTable(result, objectType)
                  },
                  error: (e) => {
                        
                        $.fn.showAlert('Settings Update Failed', 'danger',() => { $.fn.showTableRecords(objectType) })

                  }
                  })

                    } else { 
                        $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()')
                    }

                    
                  })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editImage = (query = 'none') => {

  const objectType = 'images';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editImage(${query == 'none' ? query : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;

  $.ajax({
    url: `/cpanel/data/${objectType}?${objectType}=` + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {
    
      let record =  Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button      = record ? 'Update' : 'Add';
      let disabled    = record ? `disabled="disabled"` : ``;
      let imageLabel = record  ? record.file_name : 'New Image'
      let dimensions = record ? record.image_dimensions.replaceAll("\"", "'") : '';
      
      const imageTypes = $.fn.getObjectType(window.appConfig.image_types)!="object"?JSON.parse(window.appConfig.image_types): window.appConfig.image_types;

      const  typeOptions =  Object.keys(imageTypes).map((type) => { 
      let selected = "";
            
          if (record && record?.image_type && record.image_type == type) {

            selected = `selected="selected"`;
          }
        
              return `<option value="${type}" ${selected}>${type}</option>`

      })

      let imagePreview = '';
      let  previewImageHtml = `<div id="preview-div" class="text-center"><img  class="img-fluid" style="height:auto;max-width:100%"  id="preview-image" src="" alt="logo preview"/> </div>`;
      if (record && record?.google_url) { 
        imagePreview = $.fn.getGoogleUrl(record.google_url);
        let imgDimen = JSON.parse(record.image_dimensions.replaceAll("\'","\""))
        let width    = imgDimen.width
        let height   = imgDimen.height
        previewImageHtml = `<div id="preview-div" class="text-center"><img  class="img-fluid" style="height:auto;max-width:100%"  id="preview-image" src="${imagePreview}" width="${width}" height="${height}" alt="logo preview"/> </div>`;
      };

      let bgTransparentOptions = ['No','Yes'].map((opt, key) => {
            let selected = "";
            if (opt=='No' || (record  && record.background_transpatent?.toString().toLowerCase() ==  "true") ) {
              selected = `selected="selected"`
            }
            return `<option value="${key}" ${selected}>${opt}</option>`
      });
		  
      
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
        <h3 class="card-title"> <i class="${$.fn.getObjectIcon('images')}"></i>&nbsp;&nbsp;&nbsp; ${titlePrefix} Image</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">
         	
				<div class="form-group row">
						<label for="Image-id" class="form-label col-sm-2">Image ID</label>
  					<div class="col-sm-10">
						<input type="text" class="form-control" name="image_id" id="image-id" value="${record?.image_id ? record.image_id: ''}" placeholder="ID" disabled="disabled" >
					</div>
				</div>
				
        <div class="form-group row">
          <label class="col-sm-2" for="image-name">Image Name</label>
         <div class="col-sm-10"> <input type="text" name="image_name" class="form-control" id="image-name" placeholder="Image Name" value="${record?.image_name ? record.image_name: ''}" ${disabled}></div>
         </div>
     		<div class="form-group row">
						<label class="form-label col-md-2" for="image-type">Image Type</label>
					<div class="col-md-10">
						<select  name="image_type" id="image-type" class="form-control select2" style="width: 100%;"/>
							${typeOptions}
						</select>
					</div>
				</div>    
      		        <div class="form-group row">
			<label  for="background-transpatent" class="col-md-2">Transparent Background</label>
			<div class="col-md-10"> 
				<select name="background_transpatent" id="background-transpatent" class="form-control select2" style="width: 100%;">
					${bgTransparentOptions}
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
          ${previewImageHtml}
						<div class="input-group">
							<div class="custom-file">
								<input type="file" class="custom-file-input form-control-lg" accept="${acceptedFormats.join(",")}" id="image-file" name="image_file">
								<label class="custom-file-label" for="image-file" id="image-label">${imageLabel}</label>
							</div>
						</div>
					</div>
				</div>
          </div>
          <div class="card-footer">
            <button type="cancel" class="btn btn-default float-left" id="image-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="image-submit-btn">${button}</button>
          </div>
        </form>
      </div></div></div>`
      );
      $('#image-dimensions').attr('disabled', 'diabled="disabled"')
       $('#image-dimensions').val(JSON.stringify(imageTypes[Object.keys(imageTypes)[0]]));
      let imageUpdated = false;

          if (record) {
            
                $("#image-type option[value=" + record.image_type + "]").attr('selected', 'selected'); 
                $("#image-type option[value=" + record.image_type + "]").attr('value', record.image_type); 

                $("#image-format option[value=" + record.image_format + "]").attr('selected', 'selected'); 
                $("#image-format option[value=" + record.image_format + "]").attr('value', record.image_format); 
                
                if(record.image_type.toLowerCase() !='generic'){ 
                   $('#image-dimensions').attr('disabled', 'diabled="disabled"')

                  }
    

        
      }
      
        if (record && record?.google_url) {
          $('#preview-div').show()
        } else {
          $('#preview-div').hide()
        }


        $('#image-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'image-submit-btn', ['image-dimensions','image-file']) })
        // $('#image-dimension').on('change', (e) => { $.fn.isFieldValid(e.target, 'image-submit-btn', ['image-dimesion',  'image-name']) })
     
       $('#image-file').on('change', (e) => {
           imageUpdated = true;
           if (!$.fn.isValidImage('image-file')) {
              //console.log("Image is not valid o")
              $('#image-file').addClass('is-invalid')
              $('#image-file').val('')
             $('#preview-div').hide()
                              
          } else {
                                  
             $('#image-file').removeClass('is-invalid');
              const imgFile = e.target.files[0];
              
              let imageElement = document.getElementById('preview-image')  
              if (imgFile) {
                  
                  const fileReader = new FileReader();
                  fileReader.onload = event => {
                    imageElement.setAttribute('src', event.target.result);
                    
                    let dimensions = $('#image-dimensions').val()
                    if (dimensions && dimensions.length > 0) {
                      dimensions = JSON.parse(dimensions.replaceAll("\'","\""))
                      imageElement.style.height = `${dimensions.height}px`;
                      imageElement.style.width = `${dimensions.width}px`;
                       $('#image-label').html(imgFile.name)
                    } else if (event.target.result && event.target.result != "") {
                      var theImage = new Image();
                      theImage.src = event.target.result;
                      theImage.onload = function () {
                        let imageDimensions = { "width": `${theImage.width}px`, "height": `${theImage.height}px` }
                        $('#image-dimensions').val(JSON.stringify(imageDimensions))
                      }
                       $('#image-label').html(imgFile.name)
                
                    } else { 
                      $('#image-dimensions').val('')
                      $('#image-label').html('')
                    }
                  
                    $("#preview-div").show();
              }
              fileReader.readAsDataURL(imgFile);
              }
                        
        }

	    	});


      const updateImageSize = () => { 

        let dimensions = $('#image-dimensions').val()
        //console.log(dimensions.replaceAll("\'","\""))
            
            let validImage = $.fn.isValidJSON('#image-dimensions',dimensions.replaceAll("\'","\"") , '#image-submit-btn');
            
            if (validImage) { 
               
              let imageElement = document.getElementById('preview-image')  

                    if (dimensions && dimensions.length > 0) { 
                        dimensions = JSON.parse(dimensions.replaceAll("\'","\""))
                        
                        imageElement.height  = dimensions.height.toString().replace("px","");
                        imageElement.width = dimensions.width.toString().replace("px","");
                    }

            }
      }
      $('#image-dimensions').on('change', (e) => { 
          updateImageSize()
          }) 
      $('#image-type').on('change', (e) => {
            let imageType = e.target.value;
            if (imageType != 'generic') {
              $('#image-dimensions').val(JSON.stringify(imageTypes[imageType]));
              $('#image-dimensions').attr('disabled', 'diabled="disabled"')
              updateImageSize();
            } else { 
              $('#image-dimensions').removeAttr('disabled')
              $('#image-dimensions').val('')

            }
          })
      
            $('#image-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('images');
            })
             $('#image-submit-btn').on('submit click',(e) => { 
              
              e.preventDefault();
               
              let imageName        = $('#image-name').val();
              let imageType        = $('#image-type').val()
              let uploadedImage    = $('#image-file').val()
               let imageDimensions = $('#image-dimensions').val();
               let isBgTransparent = $('#background-transpatent').val()
               let imageElement    = document.getElementById("uploaded-image") 
               if (imageElement) { 
                   imageDimensions     = JSON.stringify({ 'width': imageElement.naturalWidth, 'height': imageElement.naturalHeight })
               }
              let isValid      = $.fn.areFieldsValid('image-submit-btn', [ 'image-name']) && $.fn.isValidJSON('#image-dimensions', imageDimensions.replaceAll("\'","\""), '#image-submit-btn');
              let isImageValid = imageUpdated ? $.fn.isValidImage('image-file') : true
                 
              if (isValid && isImageValid ) {
                 const formData = new FormData();
                 formData.append("mode", titlePrefix.toLowerCase());
                 if (titlePrefix.toLowerCase() == "edit") {
                   formData.append('image_id', record.image_id)
                 }
                formData.append("image_name", imageName);
                formData.append("image_type", imageType);
                // formData.append("image_format", imageFormat);
                formData.append("image_updated", imageUpdated);
                formData.append("image_dimensions", imageDimensions);
                formData.append("transparent_background", isBgTransparent)
                if (imageUpdated) {
                  formData.append("image_file", $('#image-file').prop('files')[0], uploadedImage);
                  let image = document.getElementById('image-file').files[0];
                  let fields = ["lastModified", "name", "size", "type", "webkitRelativePath"]
                  if (image) {
                    fields.forEach((field) => {
                      formData.append(field, image[field])
                    });
                  }
                }
                 
                 formData.append("acky", currentUser.acky);
                 $.ajax({
                   url: `cpanel/add/${objectType}`,
                   type: "POST",
                   data: formData,
                   processData: false,
                   contentType: false,
                   crossDomain: true,
                   success: (result) => {
                     
                    $.fn.showUpdatedTable(result, objectType)

                   },
                   error: (e) => {
                  
                       $.fn.showAlert('Image Creation Failed', 'danger',  () => { $.fn.showTableRecords(objectType) })
                     

                   }
                 });

 

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()')
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editFile = (query = 'none') => {

  const objectType = 'files';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editFile(${query == 'none' ? query : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
     
  $.ajax({
    url: `/cpanel/data/${objectType}?${objectType}=` + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record       = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix  = record ? 'Edit' : 'New';
      let button       = record ? 'Update' : 'Add';
      let disabled     = record ? `disabled="disabled"` : ``;
      let fileLabel    = record  ? record.file_name : 'New File'
      let fileTypes    = window.appConfig.file_formats;
      window.appConfig.image_formats.forEach((imgFormat) => {
            fileTypes.push(imgFormat);
      })
      //console.log(fileTypes);
	    const maxSize   = window.appConfig.max_content_length;
	  
      const  typeOptions =  fileTypes.map((type) => { 
          
          let selected = "";
          if (record && record?.file_type && record.file_type == type) {
            selected = `selected="selected"`;
          }
          return `<option value="${type}" ${selected}>${type}</option>`
      })
      
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
         <h3 class="card-title"> <i class="${$.fn.getObjectIcon('files')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} File</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">
         	
				<div class="form-group row">
						<label for="File-id" class="form-label col-sm-2">File ID</label>
  					<div class="col-sm-10">
						<input type="text" class="form-control" name="file_id" id="file-id" value="${record?.file_id ? record.file_id: ''}" placeholder="ID" disabled="disabled" >
					</div>
				</div>
				
        <div class="form-group row">
          <label class="col-sm-2" for="file-name">File Name</label>
         <div class="col-sm-10">
          <input type="text" name="file_name" class="form-control" id="file-name" placeholder="File Name" value="${record?.file_name ? record.file_name : ''}" ${disabled}>
          </div>
         </div> 
        <div class="form-group row">
          <label class="col-sm-2" for="file-name">File Link</label>
         <div class="col-sm-10">
          <a href="${record?.google_url ? $.fn.getGoogleUrl(record.google_url) : ''}">${record?.file_name ? record.file_name : ''}</a>
          </div>
         </div> 
				<div class="form-group row">
					<div class="col-md-2">  <label for="file-upload">File Upload</label> 
					</div>
					<div class="col-md-10"> 
						<div class="input-group">
							<div class="custom-file">
								<input type="file" class="custom-file-input form-control-lg" accept="${fileTypes.join(",")}" id="file-upload" name="file_upload">
								<label class="custom-file-label" for="file-upload" id="file-label">${fileLabel}</label>
							</div>
						</div>
					</div>
				</div>
          </div>
          <div class="card-footer">
            <button type="cancel" class="btn btn-default float-left" id="file-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="file-submit-btn">${button}</button>
          </div>
        </form>
      </div></div></div>`
      );
      let fileUpdated = false;

          if (record) {
            
                //$("#file-type option[value=" + record.file_type + "]").attr('selected', 'selected'); 
                //$("#file-type option[value=" + record.file_type + "]").attr('value', record.file_type); 
                
                if(record.file_type.toLowerCase() !='generic'){ 
                   $('#file-dimensions').attr('disabled', 'diabled="disabled"')
                 }
      }
      
        $('#file-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'file-submit-btn', ['file-dimensions','file-upload']) })
       //$('#file-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'file-submit-btn', ['file-name']) });
       $('#file-upload').on('change', (e) => {
         fileUpdated = true;
         if (!$.fn.isValidFile('file-upload')) {
             
                //console.log("File is not valid o")
                $('#file-upload').addClass('is-invalid');
                $('#file-upload').val('');
                              
          } else {
                                  
             $('#file-upload').removeClass('is-invalid');
              const uploadedFile = e.target.files[0];
              if (uploadedFile) {
                  
                  const fileReader = new FileReader();
                  fileReader.onload = event => {
                    
                  if (event.target.result && event.target.result != "") {

                      $('#file-label').html(uploadedFile.name);
                
                    } else { 

                      $('#file-dimensions').val('');
                      $('#file-label').html('');
                    
                    }
                  
                    $("#preview-div").show();
                    
                   }
                   fileReader.readAsDataURL(uploadedFile);
              }
                        
        }

	    	});


   
      $("#file-cancel-btn").on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('files');
            })
            $(".form-control").on('keydown', function (e) {
              
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                $('#file-submit-btn').click()
              }
            });
  
      
           $('#file-submit-btn').on('submit click',(e) => { 
              
              e.preventDefault();
               
              let fileName       = $('#file-name').val();
              let uploadedFile   = $('#file-upload').val()

               let fileElement   = document.getElementById("uploaded-file") 
               if (fileElement) { 
                   fileDimensions     = JSON.stringify({ 'width': fileElement.naturalWidth, 'height': fileElement.naturalHeight })
               }
               let isValid      = $.fn.areFieldsValid('file-submit-btn', [ 'file-name']);
               let isFileValid = fileUpdated ? $.fn.isValidFile('file-upload') : true;
                 
              if (isValid && isFileValid ) {
                 const formData = new FormData();
                 formData.append("mode", titlePrefix.toLowerCase());
                 if (titlePrefix.toLowerCase() == "edit") {
                   formData.append('file_id', record.file_id)
                 }
                formData.append("file_name", fileName);
                formData.append("file_updated", fileUpdated);
                if (fileUpdated) {
                  formData.append("uploaded_file", $('#file-upload').prop('files')[0], uploadedFile);
                  let file = document.getElementById('file-upload').files[0];
                  let fields = ["lastModified", "name", "size", "type", "webkitRelativePath"]
                  if (file) {
                    fields.forEach((field) => {
                      formData.append(field, file[field])
                    });
                  }
                }
                 
                 formData.append("acky", currentUser.acky);
                 $.ajax({
                   url: `cpanel/add/${objectType}`,
                   type: "POST",
                   data: formData,
                   processData: false,
                   contentType: false,
                   crossDomain: true,
                   success: (result) => {
                     
                    $.fn.showUpdatedTable(result, objectType)

                   },
                   error: (e) => {
                  
                       $.fn.showAlert('File Creation Failed', 'danger',  () => { $.fn.showTableRecords(objectType) })
                     

                   }
                 });



                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()')
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editTemplate = (query = 'none') => {

  const objectType               = 'pagetemplates';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editTemplate(${query == 'none' ? query : JSON.stringify(query)})`;
  DisplayManager.lastObjectType  = objectType;
     
  $.ajax({
    url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {
    
      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      $.fn.imageData = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
      //console.log($.fn.imageData)
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      let disabled = record ? `disabled="disabled"` : ``;
      
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
         <h3 class="card-title"> <i class="${$.fn.getObjectIcon('pagetemplates')}"></i>&nbsp;&nbsp;&nbsp; ${titlePrefix} Template</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">
         	
				<div class="form-group row">
						<label for="template-id" class="form-label col-sm-2">Template ID</label>
  					<div class="col-sm-10">
						<input type="text" class="form-control" name="template_id" id="template-id" value="${record?.template_id ? record.template_id: ''}" placeholder="ID" disabled="disabled" >
					</div>
				</div>
				
        <div class="form-group row">
          <label class="col-sm-2" for="template-name">Template Name</label>
         <div class="col-sm-10"> <input type="text" name="template_name" class="form-control" id="template-name" placeholder="Template Name" value="${record?.name ? record.name: ''}" ${disabled}></div>
         </div>
     		   
      
      <div class="form-group row">
        <label for="template-description" class="form-label col-sm-2">Template Description</label>
        <div class="col-sm-10"><input type="text" class="form-control " id="template-description" name="template_description" placeholder="" value="${record?.description ? record.description: ''}"></div>
      </div>
			
			
			  <div class="form-group row">
        <label for="template-contents" class="form-label col-sm-2">Template Contents</label>
			<div  class="col-sm-10"> 
			<textarea id="template-contents" rows="6" name="template_contents" value="">
                ${record?.contents ? record.contents: 'Place <em>some</em> <u>text</u> <strong>here</strong>'}
			</textarea>
			  </div>
			  
          </div>
          <div class="card-footer">
            <button type="cancel" class="btn btn-default float-left" id="template-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="template-submit-btn">${button}</button>
          </div>
        </form>
      </div></div></div>`
      );
      
      const ImageButton = function (context) {
        let ui = $.summernote.ui;
        var button = ui.button({
          contents: '<i class="fa fa-images"/> Image</i>',
          tooltip: 'Insert Image',
          click: function () {
            $.fn.selectImage(context)
          }
        });

      return button.render();  
      }

      $('#template-contents').summernote({

          height: 600,                 // set editor height
        minHeight: 600,             // set minimum height of editor
        maxHeight: null,             // set maximum height of editor
        focus: true,                // set focus to editable area after initializing summernote
        toolbar: [
             
              ['style', ['style']],
              ['font', ['bold', 'italic', 'underline', 'clear']],
              ['fontname', ['fontname']],
              ['color', ['color']],
              ['para', ['ul', 'ol', 'paragraph']],
              ['height', ['height']],
              ['table', ['table']],
              ['insert', ['link', 'image', 'hr']],
              ['view', ['fullscreen', 'codeview']],
              ['help', ['help']]
            ],
            buttons: {
                  image: ImageButton
                }
      });

        $('<link/>', {
            rel: 'stylesheet',
            type: 'text/css',
            href: '/static/css/style.css'
        }).appendTo('head');
      
      
        $('<script/>', {
            type: 'text/javascript',
            src: '/static/js/script.js'
        }).appendTo('body');

        // $.getScript( "/static/js/script.js", function( data1, textStatus1, jqxhr1 ) {

        // });


     $('#template-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'template-submit-btn', [ 'template-description']) })
     $('#template-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'template-submit-btn', [ 'template-name']) })  
	 
	 $('#template-cancel-btn').on('click', (e) => {
		e.preventDefault();
		$.fn.showTableRecords('pagetemplates');
   });

  $(".form-control").on('keydown', function (e) {
    
    if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
      $('#template-submit-btn').click()
      }
    });
      
	 $('#template-submit-btn').on('submit click',(e) => { 
              
              e.preventDefault();
               
              let templateName = $('#template-name').val();
              let templateDescription = $('#template-description').val()
              let contents            = $('#template-contents').val()
              let isValid             = contents.length > 0 && $.fn.areFieldsValid('template-submit-btn', [ 'template-name','template-description'])
                 
              if (isValid ) {
                 const formData = new FormData();
                 formData.append("mode", titlePrefix.toLowerCase());
                 if (titlePrefix.toLowerCase() == "edit") {
                   formData.append('template_id', record.template_id)
                 }
                formData.append("name", templateName);
                formData.append("description", templateDescription);
                formData.append("contents", contents);
           
                 
                 formData.append("acky", currentUser.acky);
                 $.ajax({
                   url: `cpanel/add/${objectType}`,
                   type: "POST",
                   data: formData,
                   processData: false,
                   contentType: false,
                   crossDomain: true,
                   success: (result) => {
                     
                      $.fn.showUpdatedTable(result, objectType)

                   },
                   error: (e) => {
                  
                     $.fn.showAlert('Template Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })

                   }
                 });

              } else { 
                  if (contents.length == 0) { 

                    $.fn.showAlert("The template contents should not be empty", 'warning','$.fn.closeDialog()');
                  } else{ 
                    $.fn.showAlert("Please correct the values in the highlighted fields", 'warning','$.fn.closeDialog()')
                  }
              }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editPage = (query = 'none') => {

  const objectType = 'pages';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editPage(${query == 'none' ? query : JSON.stringify(query)})`;
  DisplayManager.lastObjectType  = objectType;
  let banners = Object.keys(window.tableMap).includes('Banners') && window.tableMap['Banners']!=null &&  Object.keys(window.tableMap['Banners']).includes('data') ? window.tableMap['Banners'].data: null;
  let sliders = Object.keys(window.tableMap).includes('Sliders') && window.tableMap['Sliders']!=null &&  Object.keys(window.tableMap['Sliders']).includes('data') ? window.tableMap['Sliders'].data: null;
 
  let images = Object.keys(window.tableMap).includes('Images') && window.tableMap['Images'] != null && Object.keys(window.tableMap['Images']).includes('data') ? window.tableMap['Images'].data : null; 
  let templates = Object.keys(window.tableMap).includes('PageTemplates') && window.tableMap['PageTemplates'] != null && Object.keys(window.tableMap['PageTemplates']).includes('data') ? window.tableMap['PageTemplates'].data : null; 
  let pages = Object.keys(window.tableMap).includes('Pages') && window.tableMap['Pages'] != null && Object.keys(window.tableMap['Pages']).includes('data') ? window.tableMap['Pages'].data : null; 
  let searchObjects = `${objectType}`;
  let searchQuery = `${objectType}=${JSON.stringify(query)}`;
  let url = `/cpanel/data/${searchObjects}?${searchQuery}&acky=${currentUser.acky}`
 
  // console.log('clients:', clients)
      //let travelInformation = Object.keys(window.tableMap).includes("ClientPersonalInformation") && window.tableMap["ClientPersonalInformation"] != null && Object.keys(window.tableMap["ClientPersonalInformation"]).includes('data') ? window.tableMap["ClientPersonalInformation"]?.data : null;
      // let personalInformation = Object.keys(window.tableMap).includes("ClientTravelInformation") && window.tableMap["ClientTravelInformation"] != null && Object.keys(window.tableMap["ClientTravelInformation"]).includes('data') ? window.tableMap["ClientTravelInformation"]?.data : null;
  if (forceOnlineFetch) {
   
    url = `/cpanel/data/${objectType}+images+banners+sliders+templates?${objectType}=` + JSON.stringify(query) + `&images={}&banners={}&sliders={}&templates={}&acky=${currentUser.acky}`
 
 
  } else { 


    if (!banners || (banners && banners.length == 0)) { 
       
      searchObjects += '+banners'
      searchQuery+='&banners={}'

    }
    if (!sliders || (sliders && sliders.length == 0)) { 
       
      searchObjects += '+sliders'
      searchQuery+='&sliders={}'

    }

    if (!images || (images && images.length == 0)) { 
       
      searchObjects += '+images'
      searchQuery+='&images={}'


    }

   if (!templates || (templates && templates.length == 0)) { 
       
      searchObjects += '+templates'
      searchQuery+='&templates={}'


    }

    
  }

  url = `/cpanel/data/${searchObjects}?${searchQuery}&acky=${currentUser.acky}`
  $.ajax({
    url: url,
	  //url: `/cpanel/data/${objectType}+images+banners?${objectType}={}&images={}&banners={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {
     
      let record = Object.keys(results).includes('pages') ? results['pages'][0] : null;

      banners = Object.keys(results).includes('banners')   && results['banners'].length == 1 ? results['banners'] : banners;
      sliders = Object.keys(results).includes('sliders')   && results['sliders'].length >0 ? results['sliders'] : sliders;
      $.fn.imageData = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : images;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
	  
      let isChildOptions = ['No','Yes'].map((opt, key) => {
                  let selected = "";
                  if (opt=='No' || (record  && record.is_child?.toString().toLowerCase() ==  "true") ) {
                    selected = `selected="selected"`
                  }
                  return `<option value="${key}" ${selected}>${opt}</option>`
      })
      // let isRestrictedOptions = ['No','Yes'].map((opt, key) => {
      //       let selected = "";
      //       if (opt=='No' || (record  && record.is_restricted?.toString().toLowerCase() ==  "true") ) {
      //         selected = `selected="selected"`
      //       }
      //       return `<option value="${key}" ${selected}>${opt}</option>`
      // })
        let isNavOptions =  ['No','Yes'].map((opt, key) => {
              let selected = "";
              if (opt=='No' || (record  && record?.is_nav_page?.toString().toLowerCase() ==  "true" )) {
                selected = `selected="selected"`
              }
              return `<option value="${key}" ${selected}>${opt}</option>`
        })
     // pages.splice(0, 0, { 'page_id': 0, 'page_name': 'None' });
      
          let pageOrderOptions = pages && pages.length > 0 ? pages.map((page) => {
            let selected = "";
            if (record && record.comes_after == page.page_id) {
              selected = `selected="selected"`
            }
            return `<option value="${page.page_id}" ${selected}>${page.page_name}</option>`
          }) : [];
      // let isHomePageOptions = ['No', 'Yes'].map((opt, key) => {
      //   let selected = "";
      //   if (opt == 'No' || (record && record?.is_home_page?.toString().toLowerCase() == "true")) {
      //     selected = `selected="selected"`
      //   }
      //   return `<option value="${key}" ${selected}>${opt}</option>`
      // });
        // console.log("Pages: ", pages);
          let parentPageOptions =pages && pages.length> 0? pages.filter((page)=>page.page_name != record?.page_name).map((page) => {
          let selected = "";
            
          // console.log("page_name: ", page.page_name);
          // console.log("page_id: ", page._id);
          // console.log("parent_page: ", record.parent_page);

          if (record && record.parent_page && Object.keys(record.parent_page).includes("$oid") && record.parent_page["$oid"] == page._id) {
              selected = `selected="selected"`;
          }else  if (record && record.parent_page && Object.keys(record.parent_page).includes("_ref") && record.parent_page._ref["$id"]["$oid"] == page._id) {
            selected = `selected="selected"`;
          } else if(record && record.parent_page && record.parent_page == page.page_id ) { 
            selected = `selected="selected"`;
          }
            //console.log("selected: ", selected);
            return `<option value="${page.page_id}" ${selected}>${page.page_name}</option>`;
            
        }):[];
      
      
      let pageType = ['FREE_FORMAT', 'PREFORMATTED'].map((opt, key) => {
          let selected = "";
          if (opt=='FREE_FORMAT' ||(record  &&  record?.page_type == key )) {
          selected = `selected="selected"`
          }
          return `<option value="${key}" ${selected}>${opt}</option>`
      })
     let bannerType = ['NONE','STATIC', 'CAROUSEL'].map((opt, key) => {
          let selected = "";
          if (opt=='NONE' ||(record  &&  record?.banner_type == key )) {
             selected = `selected="selected"`
          }
          return `<option value="${key}" ${selected}>${opt}</option>`
     })
    //   let bannerPreview = '/static/images/placeholder.png';
    //  // let sliderPreview = '/static/images/placeholder.png';
    //   let  bannerOptions = banners && banners.length> 0? banners.map((banner) => {
    //             let selected = "";
    //             if ( record && record.banner  && record.banner['$oid']  ==  banner._id ) {
    //                   selected = `selected="selected"`;
    //                   let imageId = banner.image['$oid'];
    //                   let bannerImage = images.filter((image) => image._id == imageId)
    //                   if (bannerImage && bannerImage.length == 1) { 

    //                       bannerImage = bannerImage[0];
    //                   }

    //                   bannerPreview = $.fn.getGoogleUrl(bannerImage.google_url)
    //             }
    //             return `<option value="${banner.banner_id}" ${selected}>${banner.name}</option>`
    //   }) : [];

      // let  sliderOptions = sliders && sliders.length> 0? sliders.map((slider) => {
      //             let selected = "";
      //             if ( record && record.slider  && record.slider['$oid']  ==  slider._id ) {
      //                 selected = `selected="selected"`;
                    
      //                 let imageId = slider.image['$oid'];
      //                 let sliderImage = images.filter((image) => image._id == imageId)
      //                 if (sliderImage && sliderImage.length == 1) { 

      //                   sliderImage = sliderImage[0];
      //                 }

      //                   sliderPreview = $.fn.getGoogleUrl(sliderImage.google_url)
      //             }
      //             return `<option value="${slider.slider_id}" ${selected}>${slider.name}</option>`
      //   }) : [];

          let  templateOptions = templates && templates.length> 0? templates.map((template) => {
                let selected = "";
                if ( record && record.template  && record.template['$oid']  ==  template._id ) {
                  selected = `selected="selected"`
                }
                return `<option value="${template.name}" ${selected}>${template.name}</option>`
      }) : [];
      
        
    let recordContents =record && record.contents ? record.contents: 'Place <em>some</em> <u>text</u> <strong>here</strong>'
	  
	  $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
         <div class="card card-dark col-md-12 w-100">
         <div class="card-header">
         <h3 class="card-title"> <i class="${$.fn.getObjectIcon('pages')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} Page</h3>
         </div>
         <form class="form-horizontal">
         <div class="card-body">
         	
				<div class="form-group row">
						<label for="page-id" class="form-label col-sm-2">Page ID</label>
  					<div class="col-sm-10">
						<input type="text" class="form-control" name="page_id" id="page-id" value="${record?.page_id ? record.page_id: ''}" placeholder="ID" disabled="disabled" >
					</div>
				</div>
				
        <div class="form-group row">
            <label class="col-sm-2" for="page-name">Page Name</label>
          <div class="col-sm-10">
              <input type="text" name="page_name" class="form-control" id="page-name" placeholder="Page Name" value="${record?.page_name ? record.page_name : ''}" >
          </div>
         </div>
    		<div class="form-group row">
			<label  for="banner-type" class="col-md-2">banner Type</label>
			<div class="col-md-10"> 
				<select name="banner_type" id="banner-type" class="form-control select2" style="width: 100%;">
					${bannerType}
				</select>
			</div>
		</div>
		
       <div class="form-group row">
			<label  for="is-child" class="col-md-2">Is Child Page</label>
			<div class="col-md-10"> 
				<select name="is_child" id="is-child" class="form-control select2" style="width: 100%;">
					${isChildOptions}
				</select>
			</div>
		</div>	
	 <div class="form-group row">
			<label  for="is-nav-page" class="col-md-2">Is Navigation Page</label>
			<div class="col-md-10"> 
				<select name="is_nav_page" id="is-nav-page" class="form-control select2" style="width: 100%;">
					${isNavOptions}
				</select>
			</div>
		</div>

        <div class="form-group row">
			<label  for="comes-after" class="col-md-2">Comes After</label>
			<div class="col-md-10"> 
				<select name="comes_after" id="comes-after" class="form-control select2" style="width: 100%;">
         <option value="0" >None</option>
					${pageOrderOptions}
				</select>
			</div>
		</div>
		
	   <div class="form-group row">
          <label class="col-sm-2" for="page-href">Href</label>
         <div class="col-sm-10"> <input type="text" name="page_href" class="form-control" id="page-href" placeholder="page link" value="${record?.href ? record.href: ''}" ></div>
         </div>
		 
		 <div class="form-group row" id="parent-page-div" style="display:none">
			<label  for="parent-page-id" class="col-md-2">Parent Page</label>
			<div class="col-md-10"> 
				<select name="parent_page_id" id="parent-page-id" class="form-control select2" style="width: 100%;">
					${parentPageOptions}
				</select>
			</div>
		</div>
		
		<div class="form-group row">
			<label  for="page-type" class="col-md-2">Page Type</label>
			<div class="col-md-10"> 
				<select name="page_type" id="page-type" class="form-control select2" style="width: 100%;">
					${pageType}
				</select>
			</div>
		</div>

        <div class="form-group row" id="template-div" style="display:none">
			<label  for="template-id" class="col-md-2">Page Template</label>
			<div class="col-md-10"> 
				<select name="template_id" id="template-id" class="form-control select2" style="width: 100%;">
         <option value="None" >None</option>
					${templateOptions}
				</select>
			</div>
		</div>
		
		
			  <div class="form-group row">
        <label for="page-contents" class="form-label col-sm-2">Page Contents</label>
			<div  class="col-sm-10"> 
			<textarea id="page-contents" rows="6" hidden  name="page_contents" value="" >
        ${recordContents}
			</textarea>
			  </div>
			  
          </div>
          <div class="card-footer">
            <button type="cancel" class="btn btn-default float-left" id="page-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-info float-right" id="page-submit-btn">${button}</button>
          </div>
        </form>
      </div></div></div>`
      );
     
      if ($('#banner-type').val() == 1) {
        $('#banner-div').hide();
       }
      let isChild = $('#is-child').val()
      if (parseInt(isChild)!=0) {
           $('#parent-page-div').css('display', 'flex');
      } else {

        $('#parent-page-div').hide();
       }
      const ImageButton = function (context) {
        let ui = $.summernote.ui;
        var button = ui.button({
          contents: '<i class="fa fa-images"/> Image</i>',
          tooltip: 'Insert Image',
          click: function () {
            $.fn.selectImage(context)
          }
        });

      return button.render();  
      }

      $('#banner-type').on('change', (e) => { 
        let bannerType = e.target.value;
        if (parseInt(bannerType) == 0) {
          $('#banner-div').show()
           $('#slider-div').hide()

        } else if (parseInt(bannerType) == 1) { 
          
          $('#banner-div').hide()
           $('#slider-div').show()

        }
      })

        $('#page-type').on('change', (e) => { 
        let pageType = e.target.value;
        if (parseInt(pageType) == 0) {
           $('#template-div').hide()
        } else if (parseInt(pageType) == 1) { 
          
       		$('#template-div').show()

        }
        })
      
        // $('#banner-id').on('change', (e) => {

        //   let bannerID = e.target.value;
        //   let  bannerOptions = banners.filter((bnr) => bnr.banner_id == bannerID);
        //   let  banner 		  = null;
        //   if( bannerOptions && bannerOptions.length==1 ){
        //     banner =  bannerOptions[0];
        //     let bannerImageID = banner.image["$oid"];
        //     let bannerImage = null;
        //     let bannerImageOptions =  images.filter((img)=> img._id == bannerImageID)
        //     if( bannerImageOptions && bannerImageOptions.length==1 ){
        //       bannerImage = bannerImageOptions[0];
        //       let imageUrl = bannerImage.google_url;
        //       document.getElementById('banner-preview-image').src = $.fn.getGoogleUrl( imageUrl)	   
        //     }
        //   }
		
        // });

        // $('#slider-id').on('change', (e) => {

        //   let sliderID = e.target.value;
        //   let  sliderOptions = sliders.filter((bnr) => bnr.slider_id == sliderID);
        //   let  slider 		  = null;
        //   if( sliderOptions && sliderOptions.length==1 ){
        //     slider =  sliderOptions[0];
        //     let sliderImageID = slider.image["$oid"];
        //     let sliderImage = null;
        //     let sliderImageOptions =  images.filter((img)=> img._id == sliderImageID)
        //     if( sliderImageOptions && sliderImageOptions.length==1 ){
        //       sliderImage = sliderImageOptions[0];
        //       let imageUrl = sliderImage.google_url;
        //       document.getElementById('slider-preview-image').src = $.fn.getGoogleUrl( imageUrl)	   
        //     }
        //   }
		
        // });

      const convertToSummerNote = (id) => { 

        $("#"+id).summernote({

        height: 600,                 // set editor height
        minHeight: 600,             // set minimum height of editor
        maxHeight: null,             // set maximum height of editor
        focus: true,                // set focus to editable area after initializing summernote
        toolbar: [				 
				['style', ['style']],
				['font', ['bold', 'italic', 'underline', 'clear']],
				['fontname', ['fontname']],
				['color', ['color']],
				['para', ['ul', 'ol', 'paragraph']],
				['height', ['height']],
				['table', ['table']],
				['insert', ['link', 'image', 'hr']],
				['view', ['fullscreen', 'codeview']],
				['help', ['help']]
	  ],
	  buttons: {
			image: ImageButton
		  }
      })
      }

      convertToSummerNote('page-contents')

        $('<link/>', {
            rel: 'stylesheet',
            type: 'text/css',
            href: '/static/css/style.css'
        }).appendTo('head');
      
      
        $('<script/>', {
            type: 'text/javascript',
            src: '/static/js/script.js'
        }).appendTo('body'); 
      
      $('#page-name').on('change', (e) => {
        let pageName = $('#page-name').val();

        if (pageName && pageName.length > 0) {
            pageName = pageName.toLowerCase().replaceAll(' ', '_');
            let parentPage = null;
            let parentPageId =  parseInt($('#is-child').val())==1?$('#parent-page-id').val():null;
          //console.log("parentPageId: ",parentPageId)
            parentPage = parentPageId ? pages.filter((page) => page.page_id == parentPageId) : null;

          if (parentPageId!= 0 && parentPage && parentPage.length == 1) {
              parentPage = parentPage[0]
              $('#page-href').val(`/pages/${parentPage.page_name}/${pageName}`);

            } else {

               $('#page-href').val(`/pages/${pageName}`);
            
            }
            $.fn.isFieldValid(e.target, 'page-submit-btn', ['page-href'])
          }
    
      });
      
      $('#page-href').on('change', (e) => { $.fn.isFieldValid(e.target, 'page-submit-btn', ['page-name']) });

    
      $('#is-child').on('change', (e) => {
        let isChildPage = e.target.value == 1;
      
        if (isChildPage) {

          $('#parent-page-div').css('display', 'flex');
        } else {
          $('#parent-page-div').css('display', 'none');
           const possibleOptions =
             pages.map((field, i) => {
             // console.log(field)
              return field?`<option value="${field.page_id}" >${field.page_name}</option>`:'';
            });

          $('#comes-after').empty();
          possibleOptions.forEach( (opts) =>{
              $('#comes-after').append(opts);
          });

        }
   
      });

      $('#parent-page-id').on('change', (e) => {

        let currentPageId = e.target.value;
        let comesAfterId = $('#comes-after').val();

          const possibleOptions =
              pages.filter((page) => page.parent_page != currentPageId).map((field, i) => {
                  return comesAfterId==field.page_id?  `<option value="${field.page_id}" selected="selected">${field.page_name}</option>`:`<option value="${field.page_id}" >${field.page_name}</option>`;
              });

          $('#comes-after').empty();
          possibleOptions.forEach((opts) => {
              $('#comes-after').append(opts);
          });
        let pageName = $('#page-name').val();
        if (pageName && pageName.length > 0) {
            pageName = pageName.toLowerCase().replaceAll(' ', '_');
            let parentPage = null;
            let parentPageId = $('#parent-page-id').val();
            parentPage = parentPageId ? pages.filter((page) => page.page_id == parentPageId) : null;
          if (parentPageId!= 0 && parentPageId!= 0 && parentPage && parentPage.length == 1) {
            parentPage = parentPage[0]
            $('#page-href').val(`/pages/${parentPage.page_name}/${pageName}`);
          } else {

            $('#page-href').val(`/pages/${pageName}`);
          }
        }
      });

      $('#template-id').on('change', (e) => { 
        let templateName = e.target.value;

        let pageTemplate = templates.filter((template) => template.name == templateName)
      
          
        if (pageTemplate) { 
            pageTemplate = pageTemplate[0];
            $('#page-contents').summernote('destroy');  
            document.getElementById('page-contents').value=(pageTemplate.contents);
            convertToSummerNote('page-contents')

        }
      })

    $('#page-cancel-btn').on('click', (e) => {
        e.preventDefault();
        $.fn.showTableRecords('pages');
    })
    
     $(".form-control").on('keydown', function (e) {
      
       if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        $('#page-submit-btn').click()
       }
     });
	   $('#page-submit-btn').on('submit click',(e) => { 
              
      e.preventDefault();
                
      let pageName            = $('#page-name').val();
      //let pageContents        = $('#page-contents').summernote('code');
      let pageContents        = $('#page-contents').val();
      //let isParent            = $('#is-parent').val()
      let isChild             = $('#is-child').val()
      let isNavpage			      = $('#is-nav-page').val()
      let comesAfter          = $('#comes-after').val()
      let pageHref			      = $('#page-href').val()
     // let isHomePage          = $('#is-home-page').val();
      let parentPageid        = $('#parent-page-id').val()
      let pageType            = $('#page-type').val();
      //let bannerID            = $('#banner-id').val()
      let bannerType          = $("#banner-type").val();
     // let sliderID            = $("#slider-id").val();
      let templateName         = $('#template-id').val()
        
      let isValid             = pageContents.length > 0 && $.fn.areFieldsValid('page-submit-btn', [ 'page-name', 'page-href']);
      
       if (isValid) {
            pageContents = pageContents.replaceAll('="static', '="/static');
            const formData = new FormData();
            formData.append("mode", titlePrefix.toLowerCase());
            if (titlePrefix.toLowerCase() == "edit") {
            formData.append('page_id', record.page_id)
            }
            formData.append("page_name", pageName.toLowerCase().replaceAll(" ","_"));
            // formData.append("is_parent", isParent);         
            formData.append("is_child", isChild);
            formData.append("is_nav_page", isNavpage);
            formData.append("comes_after", comesAfter);
            formData.append("href", pageHref);
           // formData.append("is_home_page", isHomePage);
            if (`${isChild}` === "1") { 
                formData.append("parent_page_id", parentPageid);
            }        
            formData.append("page_type", pageType);
            formData.append("banner_type", bannerType);
            //formData.append("slider_id", sliderID)
            formData.append("template_name", templateName)
            formData.append("contents", pageContents.replaceAll('\n', '').trim());
            //formData.append("banner_id", bannerID)
            //formData.append("is_restricted", isRestricted);
            //formData.append("template", template);
    
            formData.append("acky", currentUser.acky);
            $.ajax({
              url: `cpanel/add/${objectType}`,
              type: "POST",
              data: formData,
              processData: false,
              contentType: false,
              crossDomain: true,
              success: (result) => {
                
                $.fn.showUpdatedTable(result, objectType)

              },
              error: (e) => {                
                  $.fn.showAlert('Page  Update or Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
              }
            });

      } else { 
            if (pageContents.length == 0) { 

              $.fn.showAlert("The page contents should not be empty", 'warning', '$.fn.closeDialog()');
            } else{ 
              $.fn.showAlert("Please correct the values in the highlighted fields", 'warning','$.fn.closeDialog()')
              }
      }
        
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editSection = (query = 'none') => {
  const objectType = 'sections';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editSection(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+pages?${objectType}=` + JSON.stringify(query)+`&pages={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

		  let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
		  let titlePrefix = record ? 'Edit' : 'New';
		  let button = record ? 'Update' : 'Add';
		  $('.page-title').text(titlePrefix + ' Section');
		  let pages = Object.keys(results).includes('pages') && results['pages'].length > 0 ? results['pages'] : [];
		  let pageOptions =pages && pages.length> 0? pages.map((page, key) => {
              let selected = "";
              
              let selectedPages =record&& record?.pages && record.pages.length > 0?record.pages.filter((recPage)=> recPage['$oid']==page._id): null;

              if (selectedPages && selectedPages.length >0){
                 // let selectedPage =  selectedPages[0];
                selected = `selected="selected"`;
                return `<option value="${page.page_id}" ${selected}>${page.page_name}</option>`;
                   
              }
                 

              return `<option value="${page.page_id}" >${page.page_name}</option>`
			}):[] 

		  $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Section</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="section-id" class="col-sm-2 form-label">Section ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="section_id" id="section-id" value="${record?.section_id ? record.section_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="section-name" class="col-sm-2 form-label">Section Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="section-name" value="${record?.name ? record.name : ''}" placeholder="Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="section-description" class="col-sm-2 form-label">Description</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="section-description" name="section_description"  value="${record?.description ? record.description : ''}">
                </div>
                </div>
                
               <div class="form-group row">
                  <label for="section-pages" class="col-sm-2 form-label">Multiple</label>
                  <div class="col-sm-10">
                      <select class="select2" name="section_pages" id="section-pages" multiple="multiple" data-placeholder="Pages in this section" style="width: 100%;">
                       ${pageOptions}
                      </select>
                  </div>
                </div>
                <div class="form-group row">
                  <label for="section-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime'): ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="section-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="section-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="section-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )

          if (record) {
            

          }
      
          $('#section-cancel-btn').on('click', (e) => {
                e.preventDefault();
               $.fn.showTableRecords('sections');
            })

        $('.select2').select2();
		    $('#section-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'section-submit-btn', ['section-name']) })
		    $('#section-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'section-submit-btn', ['section-name']) })

      $(".form-control").on('keydown', function (e) {
        
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          $('#section-submit-btn').click()
        }
      });

      $('#section-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let name = $('#section-name').val();
              let description = $('#section-description').val(); 
              let pages =  $('#section-pages').val()			  

              if (description.length == 0) {
                $('#section-description').addClass('is-invalid')
                $('#section-submit-btn').attr('disabled', 'disabled')
              }
              let isValid = $.fn.areFieldsValid('section-submit-btn', ['section-name',  'section-description'])

              if (isValid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('section_id', record.section_id)
                }
                formData.append("name", name);
                formData.append("description", description);
				        formData.append("pages", JSON.stringify(pages))
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                        $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Section Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning','$.fn.closeDialog()')
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editTeamMember = (query = 'none') => {
  const objectType = 'teammembers';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editTeamMember(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record          = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      const imageData     = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
      const profileImages = imageData ? imageData.filter((image) => image.image_type.toLowerCase() == "profile") : null;
      let imageUrl = '';
      if (record && Object.keys(record).includes("image")){ 
          let imageUrlInfo = window.tableMap['Images'].data.filter((image) => image._id == record.image["$oid"])
           imageUrl = imageUrlInfo.length == 1 ? $.fn.getGoogleUrl(imageUrlInfo[0].google_url) : '';

      }

      let imagePreview    = imageUrl; //profileImages ? profileImages[0].google_url:'';  
      const imageOptions = profileImages ? profileImages.map((image) => {
        let selected = "";
                                                                  
        if (record && record?.image && image.google_url == imageUrl) {
          selected = `selected="selected"`;
          //imagePreview = $.fn.getGoogleUrl(image.google_url)
        }
        return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

      }) : [];
	  
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Member');
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Member</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
			      <div class="form-group row">
						<label  for="profile-image" class="col-md-2">Profile Image</label>
						<div class="col-md-10"> 
							<div id="image-preview" class="text-center"><img  class="img-fluid" style="height:auto;max-width:100%" id="preview-image" src="${imagePreview}" alt="Profile Image"/> </div>
						 <select name="profile_image" id="profile-image" class="form-control select2" style="width: 100%;">
								${imageOptions}
						</select>
              
						</div>
					</div>
              <div class="form-group row">
                <label for="member-id" class="col-sm-2 form-label">Member ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="member_id" id="member-id" value="${record?.member_id ? record.member_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="member-name" class="col-sm-2 form-label">Member Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="member-name" value="${record?.name ? record.name : ''}" placeholder="Name">
                </div>
              </div>
              <div class="form-group row">
                <label for="role" class="col-sm-2 form-label">Role</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="role" id="role" value="${record?.role ? record.role : ''}" placeholder="role">
                </div>
              </div>
                <div class="form-group row">
                <label for="description" class="col-sm-2 form-label">Description</label>
					<div class="col-sm-10">
						<input type="text"   class="form-control"  id="description" name="description"  value="${record?.description ? record.description : ''}">
					</div>
                </div>
				
				  <div class="form-group row">
					<label for="social-media" class="col-sm-2 col-form-label">Social Media</label>
					<div class="col-sm-10"> 
						<textarea class="form-control" id="social-media" rows="6" placeholder="" style="resize: none;" value="${record?.social_media ? JSON.stringify(record.social_media) : ''}">${record?.social_media ? JSON.stringify(record.social_media) : ''}</textarea>
					</div>
				</div>	
                <div class="form-group row">
                  <label for="teammember-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="teammember-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ?$.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
       
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="teammember-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="teammember-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )
           $('.select2').select2();
           $('#teammember-cancel-btn').on('click', (e) => {
                e.preventDefault();
               $.fn.showTableRecords('teammembers');
            })
		   $('#profile-image').on('change', (e)=>{
        // console.log(e.target.value )
         document.getElementById('preview-image').src = $.fn.getGoogleUrl( e.target.value)
			    //$('#preview-image').attr("src", e.target.value)
			   
		   })

		   $('#member-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'teammember-submit-btn', ['description', 'role']) })
		   $('#description').on('change', (e) => { $.fn.isFieldValid(e.target, 'teammember-submit-btn', ['member-name','role']) })
		   $('#role').on('change', (e) => { $.fn.isFieldValid(e.target, 'teammember-submit-btn', ['member-name','description']) })
		   $('#social-media').on('change', (e) => { 
          let data = e.target.value;
          let element = e.target.id;
          element = '#' + element;
          $.fn.isValidJSON(element, data, '#settings-submit-btn');
			})

      
      $(".form-control").on('keydown', function (e) {
       
        if (e.key === 'Enter' || e.keyCode === 13) {
           e.preventDefault();
          $('#teammember-submit-btn').click()
        }
      });


       $('#teammember-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let name = $('#member-name').val();
              let description = $('#description').val(); 
              let role = $('#role').val()
              let image =  $('#profile-image').val()
              let socialMedia =  $('#social-media').val()

          
              let isValid = $.fn.areFieldsValid('teammember-submit-btn', ['member-name', 'description', 'role']) 

              if (isValid  && $.fn.isValidJSON('#social-media',socialMedia)) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('teammember_id', record.teammember_id)
                }
              
               
                formData.append("name", name);
                formData.append("description", description);
                formData.append("role", role);
                formData.append("social_media", socialMedia);
                formData.append("image", image);
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                        $.fn.showUpdatedTable(result, objectType);
                      },
                      error: (e) => {
                            $.fn.showAlert('TeamMember Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning','$.fn.closeDialog()')
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}

$.fn.editBanner = (query = 'none') => {
  const objectType = 'banners';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editBanner(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&`+`acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

        let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
        let titlePrefix = record ? 'Edit' : 'New';
        let button = record ? 'Update' : 'Add';
        $('.page-title').text(titlePrefix + ' Banner');

          let imageData     = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
          imageData = imageData.filter((img) => img.image_type == 'banner');
          let isActive = ['No', 'Yes'].map((opt, key) => {
                let selected = "";
                if (opt=='No' || (record  && record.is_active?.toString().toLowerCase() ==  "true") ) {
                  selected = `selected="selected"`
                }
                return `<option value="${key}" ${selected}>${opt}</option>`
        });
        let imageUrl  = imageData.length> 0? $.fn.getGoogleUrl(imageData[0].google_url) :'/static/images/placeholder.png'

        if (record && Object.keys(record).includes("image")) { 
          console.log("Record Image: ", record.image)
          console.log("Image ID: ", record.image["$oid"])
            let imageUrlInfo = window.tableMap['Images'].data.filter((image) => image._id == record.image["$oid"])
            imageUrl = imageUrlInfo.length == 1 ? $.fn.getGoogleUrl(imageUrlInfo[0].google_url) : imageUrl;

       } 

        let imagePreview    = imageUrl;
      
        const imageOptions = imageData ? imageData.filter((image) => { 
              return image.image_type == 'banner';
         }).map((image) => {
              let selected = "";          
                                          
              if (record && record?.image && image._id == record.image['$oid']) {
                selected = `selected="selected"`;
               // imagePreview = $.fn.getGoogleUrl(image.google_url)
              }
              return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

         }) : [];
        // imagePreview = imagePreview.length == 0 ? $.fn.getGoogleUrl(imageData[0].google_url) : '';

        $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title"> <i class="${$.fn.getObjectIcon('banners')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} Banner</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="banner-id" class="col-sm-2 form-label">Banner ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="banner_id" id="banner-id" value="${record?.banner_id ? record.banner_id : ''}" placeholder="ID" disabled>
                </div>
              </div>

              <div class="form-group row">
                <label for="name" class="col-sm-2 form-label">Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="name" value="${record?.name ? record.name : ''}" placeholder="Name">
                </div>
              </div>
              <div class="form-group row">
                <label for="title" class="col-sm-2 form-label">Title</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="title" id="title" value="${record?.title ? record.title : ''}" placeholder="Title">
                </div>
              </div>

                <div class="form-group row">
                <label for="social-media" class="col-sm-2 col-form-label">Page Links</label>
                <div class="col-sm-10"> 
      	            ${$.fn.getObjectMapper([{ 'id': 'page-links' }, { 'text': 'Class'}, { 'text': 'Href' }, {'text': 'Text'}, {'props': (record?.page_links ? record.page_links : '') }])}
                </div>
              </div>	

                <div class="form-group row">
                  <label  for="image" class="col-md-2">Image</label>
                  <div class="col-md-10"> 
                    <div id="image-preview" class="text-center"><img class="simg-fluid" style="height:auto;max-width:100%" id="preview-image" src="${imagePreview}" alt="Image"/> </div>
                       <select name="image" id="image" class="form-control select2" style="width: 100%;">
                         ${imageOptions}
                        </select>
                  
                     </div>
					        </div>
                <div class="form-group row">
                  <label  for="image" class="col-md-2">Is Active</label>
                  <div class="col-md-10"> 
                   
                       <select name="is_active" id="is-active" class="form-control select2" style="width: 100%;">
                         ${isActive}
                        </select>
                  
                     </div>
					        </div>
                <div class="form-group row">
                  <label for="banner-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="banner-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="banner-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="banner-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )

          $('#banner-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('banners');
            })
      $.fn.showDataTable('page-links-table');

          
      $('#image').on('change', (e) => {
          document.getElementById('preview-image').src = $.fn.getGoogleUrl(e.target.value);
      });

      $('.select2').select2();
      $('#name').on('change', (e) =>  { $.fn.isFieldValid(e.target, 'banner-submit-btn', [,'title', 'name']) })
			$('#title').on('change', (e) => { $.fn.isFieldValid(e.target, 'banner-submit-btn', ['title', 'name']) })

      $(".form-control").on('keydown', function (e) {
      
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
          $('#banner-submit-btn').click()
        }
      });

      $('#banner-submit-btn').on('submit click',(e) => { 
              
        e.preventDefault();
        let name            = $('#name').val()
        let title           = $('#title').val();
        let pageLinks = JSON.stringify($.fn.getObjectFromMapper('page-links'))
        let image           = $('#image').val();
        let isActive        = $('#is-active').val();
        let isValidPageLink = $.fn.checkMappedProps(pageLinks, [1, 1, 1]);
        
        if ($.fn.areFieldsValid('banner-submit-btn', ['title', 'name']) && isValidPageLink) {
              
              const formData = new FormData();
              formData.append("mode", titlePrefix.toLowerCase());
              if (titlePrefix.toLowerCase() == "edit") {
                formData.append('banner_id', record.banner_id)
              }
              
              formData.append("name", name)
              formData.append("title", title);
              formData.append("page_links", pageLinks);
              formData.append("image_url", image)
              formData.append("is_active",isActive)
              formData.append("acky", currentUser.acky);
          
              $.ajax({
                    url: `cpanel/add/${objectType}`,
                    type: "POST",
                    data: formData,
                    processData: false,
                    contentType: false,
                    crossDomain: true,
                    success: (result) => {
                    $.fn.showUpdatedTable(result, objectType)
                    },
                    error: (e) => {
                          $.fn.showAlert('Banner Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                    }
              })

            } else { 
                $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
            }
          
            
        })

        },
        error: (e) => {
          console.log(e)

        } 
  })

}

$.fn.editSlider = (query = 'none') => {
  const objectType = 'sliders';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editSlider(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&`+`acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

        let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
        let titlePrefix = record ? 'Edit' : 'New';
        let button = record ? 'Update' : 'Add';
        $('.page-title').text(titlePrefix + ' Slider');

          let imageData     = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
          imageData = imageData.filter((img) => img.image_type == 'slider');
          let isActive = ['No', 'Yes'].map((opt, key) => {
                let selected = "";
                if (opt=='No' || (record  && record.is_active?.toString().toLowerCase() ==  "true") ) {
                  selected = `selected="selected"`
                }
                return `<option value="${key}" ${selected}>${opt}</option>`
        });
        let imageUrl  = imageData.length> 0? $.fn.getGoogleUrl(imageData[0].google_url) :'/static/images/placeholder.png'

        if (record && Object.keys(record).includes("image")) { 
         // console.log("Record Image: ", record.image)
          //sconsole.log("Image ID: ", record.image["$oid"])
            let imageUrlInfo = window.tableMap['Images'].data.filter((image) => image._id == record.image["$oid"])
            imageUrl = imageUrlInfo.length == 1 ? $.fn.getGoogleUrl(imageUrlInfo[0].google_url) : imageUrl;

       } 

        let imagePreview    = imageUrl;
      
        const imageOptions = imageData ? imageData.filter((image) => { 
              return image.image_type == 'slider';
         }).map((image) => {
              let selected = "";          
                                          
              if (record && record?.image && image._id == record.image['$oid']) {
                selected = `selected="selected"`;
               // imagePreview = $.fn.getGoogleUrl(image.google_url)
              }
              return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

         }) : [];
        // imagePreview = imagePreview.length == 0 ? $.fn.getGoogleUrl(imageData[0].google_url) : '';
	      let titleboxAnimationOptions = ['fadeIn','slideInLeft','slideInRight','slideInDown','slideInUp'].map((opt) => {
            let selected = "";
            if (record  && record.titlebox_animation?.toString().toLowerCase() ==  opt ) {
				      selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
		  
		  let titleAnimationOptions = ['fadeIn','slideInLeft','slideInRight','slideInDown','slideInUp'].map((opt) => {
            let selected = "";
            if (record  && record.title_animation?.toString() ==  opt ) {
			      	selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
		  
		  let subtitleAnimationOptions = ['fadeIn','slideInLeft','slideInRight','slideInDown','slideInUp'].map((opt) => {
            let selected = "";
            if (record  && record.subtitle_animation?.toString() ==  opt ) {
				        selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
		  		  let dataInAnimationOptions = ['fadeIn','slideInLeft','slideInRight','slideInDown','slideInUp'].map((opt) => {
            let selected = "";
            if (record  && record.data_animation_in?.toString() ==  opt ) {
			        	selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
          let durationOptions =[]
          for (let i = 0; i <= 3.1; (i += 0.1)){
            durationOptions.push(i.toFixed(1));
          }
          
      let durationOpts = durationOptions.map((opt) => {
              let selected = "";
            if (record && record.data_animation_in_duration?.toString() == opt) {
              selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
		let descLeadAnimationOptions = ['fadeIn','slideInLeft','slideInRight','slideInDown','slideInUp'].map((opt) => {
            let selected = "";
            if (record  && record.description_lead_animation?.toString() ==  opt ) {
				selected = `selected="selected"`
            }
            return `<option value="${opt}" ${selected}>${opt}</option>`
          });
        $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title"> <i class="${$.fn.getObjectIcon('sliders')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} Slider</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="slider-id" class="col-sm-2 form-label">Slider ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="slider_id" id="slider-id" value="${record?.slider_id ? record.slider_id : ''}" placeholder="ID" disabled>
                </div>
              </div>

              
               <div class="form-group row">
                <label for="name" class="col-sm-2 form-label">Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="name" value="${record?.name ? record.name : ''}" placeholder="Name">
                </div>
              </div>

              <div class="form-group row">
                <label for="line1" class="col-sm-2 form-label">Line 1</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="line1" id="line1" value="${record?.line1 ? record.line1 : ''}" placeholder="Line 1">
                </div>
              </div>

              <div class="form-group row">
                <label for="line2" class="col-sm-2 form-label">Line 2</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="line2" id="line2" value="${record?.line2 ? record.line2 : ''}" placeholder="Line 2">
                </div>
              </div>

                <div class="form-group row">
                  <label  for="image" class="col-md-2">Image</label>
                  <div class="col-md-10"> 
                    <div id="image-preview" class="text-center"><img class="simg-fluid" style="height:auto;max-width:100%" id="preview-image" src="${imagePreview}" alt="Image"/> </div>
                       <select name="image" id="image" class="form-control select2" style="width: 100%;">
                         ${imageOptions}
                        </select>
                     </div>
					        </div>

              

                <div class="form-group row">
                  <label  for="image" class="col-md-2">Is Active</label>
                  <div class="col-md-10"> 
                   
                       <select name="is_active" id="is-active" class="form-control select2" style="width: 100%;">
                         ${isActive}
                        </select>

                     </div>
					       </div>

                <div class="form-group row">
                  <label for="slider-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="slider-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="slider-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="slider-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )

          $('#slider-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('sliders');
            })
      $.fn.showDataTable('data-animation-table');
          
      $('#image').on('change', (e) => {
          document.getElementById('preview-image').src = $.fn.getGoogleUrl(e.target.value);
      });

      $('.select2').select2();
        $('#name').on('change', (e) =>  { $.fn.isFieldValid(e.target, 'slider-submit-btn', [ 'line1', 'line2', ]) })
        $('#line1').on('change', (e) =>  { $.fn.isFieldValid(e.target, 'slider-submit-btn', [ 'name',  'line2']) })
        $('#line2').on('change', (e) =>  { $.fn.isFieldValid(e.target, 'slider-submit-btn', [ 'title', 'line1']) })

      $(".form-control").on('keydown', function (e) {
      
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
          $('#slider-submit-btn').click()
        }
      });

      $('#slider-submit-btn').on('submit click',(e) => { 
              
        e.preventDefault();
        let name                     = $('#name').val()
        let line1                    = $('#line1').val();
        let line2                    = $('#line2').val()
        let image                    = $('#image').val();
        let isActive                 = $('#is-active').val();
        
        if ($.fn.areFieldsValid('slider-submit-btn', ['name', 'line1', 'line2'])) {
              
              const formData = new FormData();
              formData.append("mode", titlePrefix.toLowerCase());
              if (titlePrefix.toLowerCase() == "edit") {
                formData.append('slider_id', record.slider_id)
              }
              
              formData.append("name", name)
              formData.append("line1", line1);
              formData.append("line2", line2)
              formData.append("image_url", image)
              formData.append("is_active",isActive)
              formData.append("acky", currentUser.acky);
          
              $.ajax({
                    url: `cpanel/add/${objectType}`,
                    type: "POST",
                    data: formData,
                    processData: false,
                    contentType: false,
                    crossDomain: true,
                    success: (result) => {
                        $.fn.showUpdatedTable(result, objectType)
                    },
                    error: (e) => {
                          $.fn.showAlert('Slider Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                    }
              })

            } else { 
                $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
            }
          
            
        })

        },
        error: (e) => {
          console.log(e)

        } 
  })

}
$.fn.editRole = (query = 'none') => {
  const objectType = 'roles';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editRole(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}?${objectType}=` + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Role');


      $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Role</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="role-id" class="col-sm-2 form-label">Role ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="role_id" id="role-id" value="${record?.role_id ? record.role_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="role-name" class="col-sm-2 form-label">Role Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="role-name" value="${record?.role_name ? record.role_name : ''}" placeholder="Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="role-description" class="col-sm-2 form-label">Description</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="role-description" name="role_description"  value="${record?.description ? record.description : ''}">
                </div>
                </div>
                <div class="form-group row">
                  <label for="role-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="role-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="role-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="role-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )

          if (record) {
            

      }
      
          $('#role-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('roles');
            })

            $('.select2').select2();
            $('#role-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'role-submit-btn', ['role-name']) })
            //$('#role-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'role-submit-btn', ['role-name']) })
            $('#role-description').on('change', (e) => {
            let descr = $('#role-description').val().trim()
            let classList = $('#role-description').attr('class')

            if (descr.length > 0) {
              if (classList.indexOf('is-invalid') > -1) {
                $('#role-description').removeClass('is-invalid')
                $('#role-description').removeClass('is-valid')
                $('#role-submit-btn').removeAttr('disabled', 'disabled')
              }
            } else {
              $('#role-description').addClass('is-invalid')
              $('#role-submit-btn').attr('disabled', 'disabled')
            }

            })
      
            $(".form-control").on('keydown', function (e) {
              
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                $('#role-submit-btn').click()
              }
            });

            $('#role-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let name = $('#role-name').val();
              let description = $('#role-description').val();  

              if (description.length == 0) {
                $('#role-description').addClass('is-invalid')
                $('#role-submit-btn').attr('disabled', 'disabled')
              }
              let isValid = $.fn.areFieldsValid('role-submit-btn', ['role-name']) && description.length > 0

              if (isValid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('role_id', record.role_id)
                }
              
               
                formData.append("role_name", name);
                formData.append("description", description);
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                       $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Role Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editUser = (query = 'none') => {
  const objectType = 'users';
  $.fn.highlightSidebar(objectType);
  DisplayManager.lastRunFunction = `$.fn.editUser(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/Users+Roles?users=${JSON.stringify(query)}&roles={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

        let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      
        let titlePrefix      = record ? 'Edit' : 'New';
        let button           = record ? 'Update' : 'Add';
        let connectionStatus = record?.connectionStatus ? "Connected" : "Disconnected"
        let connectionCheck  = connectionStatus == "Connected" ? `checked="checked"`:""
        let activeStatus     = record?.active ? "Enabled" : "Disabled"
        let activeCheck      = activeStatus == "Enabled" ? `checked="checked"` : "";
      
        let locked           = record?.locked ? "Locked" : "Unlocked";
        let lockCheck        = locked=="Unlocked" ? `checked="checked"`:"";
        let disabled         = record? "disabled" : ""
        let password         = record? "***************":''
        $('.page-title').text(titlePrefix + ' Account');
        const roles = isOnline() ?
          results['roles'].map((result) => {
            let selected = "";
            if (record && record.roled_id == result.role_id) {
              selected = `selected="selected"`
            }
            return `<option value="${result.role_id}" ${selected}>${result.role_name}</option>`
          }) : (Object.keys(window.tableMap).includes('Roles') && window.tableMap['Roles'].data ?
          window.tableMap['Roles'].data.map((result) => {
            let selected = "";
            if (record && record.roled_id == result.role_id) {  
                selected=`selected="selected"`
            }
                  return `<option value="${result.role_id}" ${selected}>${result.role_name}</option>`
          }) : []);
        $('#contentwrapper-node').html(
          `<div class="container-fluid"><div class="row">       
          <div class="card card-dark col-md-12 w-100">
          <div class="card-header">
          <h3 class="card-title"> <i class="${$.fn.getObjectIcon('users')}"></i>&nbsp;&nbsp;&nbsp;${titlePrefix} User</h3>
          </div>
          <form class="form-horizontal">
          <div class="card-body">
      
      <div class="form-group row">
        <label for="username" class="col-sm-2 col-form-label">User ID</label>
        <div class="col-sm-10">
          <input type="text" class="form-control" name="user_id" id="user-id" value="${record?.user_id ? record.user_id : ''}" placeholder="User ID" disabled>
        </div>
          </div>
      
      <div class="form-group row">
        <label for="username" class="col-sm-2 col-form-label">Username</label>
        <div class="col-sm-10">
          <input type="text" class="form-control" name="username" id="username" value="${record?.username ? record.username : ''}" placeholder="Username" ${disabled} />
        </div>
          </div>
      
      <div class="form-group row">
        <label for="password" class="col-sm-2 col-form-label">Password</label>
        <div class="col-sm-10">
          <input type="password" class="form-control" name="password" id="password" value="${password}" placeholder="Password" />
        </div>
          </div>
      
      <div class="form-group row">
        <label for="confirm-password" class="col-sm-2 form-label">Confirm Password</label>
        <div class="col-sm-10">
          <input type="password" class="form-control" name="confirm_password" id="confirm-password" value="${password}" placeholder="Confirm Password" />
        </div>
          </div>
        <div class="form-group row">
        <label for="email" class="col-sm-2 col-form-label">email</label>
        <div class="col-sm-10">
          <input type="text" class="form-control" name="email" id="email" value="${record?.email ? record.email : ''}" placeholder="Email Address"  />
        </div>
          </div>
      <div class="form-group row">
          <label class="col-md-2 form-label">Role</label>
              <div class="col-md-10">
                <select  name="role" id="role" class="form-control select2"  style="width: 100%;">
                  ${roles.join('')}
                </select>
            </div>
          </div>
        <div class="form-group row">
            <label class="col-sm-2 form-label" >Access Status </label>
            <div class="col-sm-10 custom-control custom-switch custom-switch-off-danger custom-switch-on-success">
                <input type="checkbox" class="custom-control-input" id="locked" ${lockCheck} />
                <label class="custom-control-label" for="locked" id="locked-label">${locked}</label>
            </div>
        </div>
      <div class="form-group row">
      <label class="col-sm-2 form-label" >Connection Status </label>
        <div class="custom-control custom-switch">
          <input type="checkbox" class="custom-control-input" disabled="" id="connection-status"  ${connectionCheck} />
          <label class="custom-control-label" for="connection-status" id="connection-label">${connectionStatus}</label>
        </div>
      </div>
            
            <div class="form-group row">
            <label class="col-sm-2 form-label">Active</label>
                      <div class="col-sm-10 custom-control custom-switch custom-switch-off-danger custom-switch-on-success">
                        <input type="checkbox" class="custom-control-input" id="status" ${activeCheck}  />
                        <label class="custom-control-label" for="status" id="status-label">${activeStatus}</label>
                      </div>
            </div>
        
      <div class="form-group row">
        <label for="logincount" class="col-sm-2 col-form-label">Login Count</label>
        <div class="col-sm-10">
          <input type="text" class="form-control" name="login_count" id="login-count" value="${record?.loginCount ? record.loginCount : ''}" placeholder="loginCount" disabled>
        </div>
          </div>
      
          <div class="form-group row">
          <label for="creation-date" class="col-sm-2 col-form-label">Creation Date</label>
            <div class="col-sm-10">
              <input type="text" class="form-control" name="creation_date" id="creation-date" value="${record?.creationDate ?  new Date(record['creationDate']['$date']).toString()  : ''}" placeholder="Creation Datetime" disabled>
            </div>
        </div>
      
          <div class="form-group row">
          <label for="last-modified-date" class="col-sm-2 col-form-label">Last Modified Date</label>
          <div class="col-sm-10">
            <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.lastModifiedDate ?  new Date(record['lastModifiedDate']['$date']).toString()  : ''}" placeholder="Last Modified" disabled>
          </div>
        </div>
            </div>
        
            <div class="card-footer">
              <button type="cancel" class="btn btn-default float-left" id="user-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-info float-right" id="user-submit-btn">${button}</button>
            </div>
          </form>
        </div></div></div>`
        );
      let passwordChanged = false;

      $('.custom-control-input').click((e) => { 
        let elementID = e.target.id
        if ($(`#${elementID}`).attr("checked") == "checked") {
            $(`#${elementID}`).removeAttr("checked")
        } else {
               $(`#${elementID}`).attr("checked", "checked")   
        }
        switch (elementID) { 
          case 'locked':
              let lockedLabel = $('#locked-label').html()
              if (lockedLabel == 'Locked') {

                $('#locked-label').html('Unlocked')
              } else { 

                $('#locked-label').html('Locked')
            }
          break;
          case 'connection-status':
              let connectionLabel = $('#connection-label').html()
              if (connectionLabel == 'Connected') {

                $('#connection-label').html('Disconnected')
              } else { 

                $('#connection-label').html('Connected')
            }
            break;
          case 'status':
              let statusLabel = $('#status-label').html()
              if (statusLabel == 'Enabled') {

                $('#status-label').html('Disabled')
              } else { 

                $('#status-label').html('Enabled')
            }
            break;
            case 'reset':
              let resetLabel = $('#reset-label').html()
              if (resetLabel == 'Pending') {

                $('#reset-label').html('')
              } else { 

                $('#reset-label').html('Pending')
            }
          break;
        }
        
        
        })

          if (record) {
            
              $("#role option[value=" + record.role_id + "]").attr('selected', 'selected'); 
              $("#role option[value=" + record.role_id + "]").attr('value', record.role_name); 

          }
          $('.select2').select2();
          $('#user-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'user-submit-btn', ['password', 'confirm-password']) })
    
          $('#password').on('change', (e) => {  })
    
        $('#user-cancel-btn').on('click', (e) => {
          e.preventDefault();
          $.fn.showTableRecords('users');
        });
        
          $('#password,#confirm-password').each(function (e) {                      
                  $(this).on('change', function (e) {
                      
                        passwordChanged = true;
                        var id = e.target.id;
                        var password = $('#password').val()
                        var confirmPassword = $('#confirm-password').val()
                        var minPassLen = 8
                        //$('#' + id + '-errors').html('');
                        if (!password || password == '') {
                                                        
                          $('#password').addClass('is-invalid')
                          $('#user-submit-btn').attr('disabled', 'disabled')
                                    
                        }

                        if (!confirmPassword || confirmPassword == '') {
                                                            
                          $('#confirm-password').addClass('is-invalid')
                          $('#user-submit-btn').attr('disabled', 'disabled')

                        }

                        if ((password  &&  password.length > 0) && (confirmPassword && confirmPassword.length > 0)) {

                          if ((password.length < minPassLen) || (password != confirmPassword) || (password == confirmPassword && !$.fn.isValidPass(password))) {
                                          
                            $('#password').addClass('is-invalid')
                            $('#confirm-password').addClass('is-invalid')
                            $('#user-submit-btn').attr('disabled', 'disabled')
                                    
                          } else if (password == confirmPassword && $.fn.isValidPass(password)) {

                            $('#password').removeClass('is-invalid');
                            $('#confirm-password').removeClass('is-invalid');
                             $('#user-submit-btn').removeAttr('disabled')
                          
                          }

                        }

                      })

        });

      $(".form-control").on('keydown', function (e) {
            
        if (e.key === 'Enter' || e.keyCode === 13) {
              e.preventDefault();
              $('#user-submit-btn').click()
            }
          });

      $('#user-submit-btn').on('submit click',(e) => {
        e.preventDefault();
        let active      = $('#status-label').html() == "Enabled";
        let role        = $('#role').val();
        let locked      = $('#locked-label').html() == "Locked";
        let username    = $('#username').val();
        let email       = $('#email').val();
        let isValid     = passwordChanged ? $('#password').val().length>0 && $('#password').val() == $('#confirm-password').val() : true;
    
        if(isValid){           
            const formData = new FormData();
            formData.append("mode", titlePrefix.toLowerCase());
            if (titlePrefix.toLowerCase() == "edit") {
              formData.append('user_id', record.user_id)
            } 
            formData.append('username', username)   
            formData.append("active", active);
            formData.append("locked", locked);
            formData.append("role",role)
            formData.append("passwordChanged", passwordChanged);
            if (passwordChanged) {
               formData.append("password", $('#password').val());
          }
          if (email && email.length > 0) { 
            formData.append("email", email);

          }
            formData.append("acky", currentUser.acky);
            $.ajax({
              url: `cpanel/add/${objectType}`,
              type: "POST",
              data: formData,
              processData: false,
              contentType: false,
              crossDomain: true,
              success: (result) => {
                $.fn.showUpdatedTable(result, objectType)
              
              },
              error: (e) => {
            
                  resolve($.fn.showAlert('User Creation Failed', 'danger',() => { $.fn.showTableRecords(objectType) }))
        

              }
            })
      }else{
          $.fn.showAlert('Please correct the fields highlighted', 'warning', '$.fn.closeDialog()' )

        }
        
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editMailBox = (query = 'none') => {
  
  const objectType = 'imapaccounts';
  $.fn.highlightSidebar(objectType);
  DisplayManager.lastRunFunction = `$.fn.editMailBox(${query =='none'?query:JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  let passwordChanged = false;

  $.ajax({
    url: "/cpanel/data/IMAPAccounts?imapaccounts="+JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,
    success:  (results)=> {
     // const imapAccount = results['imapaccounts']
      //record = record && Object.keys(record).length == 1 ? record['imapaccounts'][0] : null
       let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
          let titlePrefix = record?'Edit':'New'
          let button  = record?'Update':'Add'
          $('.page-title').text(titlePrefix+' Mail Account')

          $('#contentwrapper-node').html(
                `<div class="container-fluid"><div class="row">       
                    <div class="card card-primary col-md-12 w-100">
                        <div class="card-header">
                           <h3 class="card-title">${titlePrefix} Mail Server</h3>
                        </div>
                        <form class="form-horizontal">
                            <div class="card-body">
                                <div class="form-group row">
                                    <label for="imap-server-address" class="col-sm-2 col-form-label">Mail Server</label>
                                    <div class="col-sm-10">
                                        <input type="text" class="form-control" name="imap_server_address" id="imap-server-address" value="${record?.imap_server_address?record.imap_server_address:''}" placeholder="Server Address">
                                    </div>
                                </div>
                          <div class="form-group row">
                          <label for="account-name" class="col-sm-2 col-form-label">Account Name</label>
                          <div class="col-sm-10">
                          <input type="text" class="form-control" name="account_name" id="account-name" value="${record?.account_name ? record.account_name : ''}"  placeholder="">
                          </div>
                          </div>
                              <div class="form-group row">
                            <label for="imap-port" class="col-sm-2 col-form-label">Port</label>
                            <div class="col-sm-10">
                            <input type="imap_port" class="form-control"  id="imap-port" value="${record?.imap_port?record.imap_port:''}"  placeholder="port">
                            </div>
                            </div>
                            <div class="form-group row">
                            <label for="imap-username" class="col-sm-2 col-form-label" >Username</label>
                            <div class="col-sm-10">
                            <input type="imap_username" class="form-control"  id="imap-username"  value="${record?.imap_username?record.imap_username:''}"  placeholder="Username">
                            </div>
                            </div>
                            <div class="form-group row">
                            <label for="imap-password" class="col-sm-2 col-form-label">Password</label>
                            <div class="col-sm-10">
                            <input  type="password" class="form-control" id="imap-password" value="${record?.imap_password?record.imap_password:''}"  placeholder="Password">
                            </div>
                            </div>
                            <div class="form-group row">
                            <label for="imap-confirm-password" class="col-sm-2 col-form-label">Confirm Password</label>
                            <div class="col-sm-10">
                            <input  type="password" class="form-control" id="imap-confirm-password" value="${record?.imap_password?record.imap_password:''}" placeholder="Confirm Password">
                            </div>
                            </div>
                            <div class="form-group row">
                            <div class="col-md-2"><label>Security</label></div>
                            <div class="col-md-10"> 
                              <select name="imap_security" id="imap-security" class="form-control select2" style="width: 100%;">
                                <option selected="selected">None</option>
                                <option>None</option>
                                <option>TLS</option>
                                <option>SSL</option>
                              </select></div>
                            </div>
                            </div>
                            <div class="card-footer">
                                  <button type="cancel" class="btn btn-default float-left" id="imap-cancel-btn">Cancel</button>
                                  <button type="submit" class="btn btn-info float-right" id="imap-submit-btn">${button}</button>
                            </div>
                        </form>
                </div></div></div>`
  )
  if(record){ 
      $("#imap-security").val(record.imap_security)
  }

  $('#imap-server-address').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port','account-name'])}) 
  $('#imap-username').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port','account-name'])}) 
  $('#imap-password').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port','account-name'])}) 
  $('#imap-confirm-password').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port','account-name'])}) 
  $('#imap-port').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port','account-name'])})
  $('#account-name').on('change', (e)=>{ $.fn.isFieldValid(e.target,'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port'])})

  $("#imap-password,#imap-confirm-password").on('change', (e)=>{

          let password        = $('#imap-password').val()
          let confirmPassword = $('#imap-confirm-password').val() 
          passwordChanged = true;
          if (password===confirmPassword){
              let classList =  $('#imap-confirm-password').attr('class')
              if (classList.indexOf('is-invalid')> -1){
                $('#imap-confirm-password').removeClass('is-invalid')
              }
              classList =  $('#imap-password').attr('class')
              if (classList.indexOf('is-invalid')> -1){
                $('#imap-password').removeClass('is-invalid')
            }
          
          $.fn.areFieldsValid('imap-submit-btn', ['imap-server-address','imap-username','imap-port'])
          }else{

            let classList =  $('#imap-confirm-password').attr('class')
            if (classList.indexOf('is-invalid')< 0){
              $('#imap-confirm-password').addClass('is-invalid')
            }
            classList =  $('#imap-password').attr('class')
            if (classList.indexOf('is-invalid')<0){
              $('#imap-password').addClass('is-invalid')
            }

          }

  })


      $('#imap-cancel-btn').on('click', (e) => {
        e.preventDefault();
       $.fn.showTableRecords('mailaccounts')
      }
      );

  $(".form-control").on('keydown', function (e) {
        
    if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          $('#imap-submit-btn').click()
        }
      });
        $('#imap-submit-btn').on('click', (e)=>{
            e.preventDefault();

            let address         = $('#imap-server-address').val()
            let username        = $('#imap-username').val()
            let password        = $('#imap-password').val()
            let confirmPassword = $('#imap-confirm-password').val() 
            let security        = $('#imap-security').val() 
          let port = $('#imap-port').val() 
          let accountName = $('#account-name').val();
            
            if(address.length >0 && username.length > 0 && password.length > 0 && password===confirmPassword && port.length){
              
              e.preventDefault();

              let classList =  $('#imap-confirm-password').attr('class')
              if (classList.indexOf('is-invalid')> -1){
                $('#imap-confirm-password').removeClass('is-invalid')
              }
              classList =  $('#imap-password').attr('class')
              if (classList.indexOf('is-invalid')> -1){
                $('#imap-password').removeClass('is-invalid')
              }

              const formData = new FormData();
              
              formData.append("mode", titlePrefix.toLowerCase());
              if(titlePrefix.toLowerCase()=="edit"){
                formData.append('account_id', record.account_id)
              }
              formData.append("imap_server_address", address);
              formData.append("imap_username", username);
              formData.append("account_name",accountName)
              if (passwordChanged) { 
                  formData.append("imap_password", password);
              }
              formData.append("imap_security", security);  
              formData.append("imap_port", port);  
              formData.append("acky", currentUser.acky);
              $.ajax({
                url: "/cpanel/add/imap",
                type: "POST",
                data: formData,
                processData: false,
                processData: false,
                contentType: false,
                crossDomain: true,
                success:  (result)=> {
                    new Promise( (resolve)=>{
                    resolve( $.fn.resetModal())
                    }).then(()=>{
                      let resultClass = result.message.toLowerCase().indexOf('success') >-1?'success':'danger'
                      $.fn.showAlert(result.message,resultClass, `$.fn.showTableRecords('mailaccounts')`) 
                    })
                  
                },
                error: (e)=>{

                  new Promise( (resolve)=>{
                    resolve( $.fn.resetModal())
                  }).then(()=>{
                    
                    $.fn.showAlert('Mail Account Addition Failed','danger',`$.fn.showTableRecords('mailaccounts')`) 
                  })

                }
            })

            }else if(password!==confirmPassword){
              $.fn.showAlert('Passwords do not match.','danger');
              let classList =  $('#imap-confirm-password').attr('class')
              if (classList.indexOf('is-invalid')< 0){
                $('#imap-confirm-password').addClass('is-invalid')
              }
              classList =  $('#imap-password').attr('class')
              if (classList.indexOf('is-invalid')<0){
                $('#imap-password').addClass('is-invalid')
              }
                
            }else{
        
              $.fn.isFieldValid('#imap-server-address', 'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port']) 
              $.fn.isFieldValid('#imap-username', 'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port']) 
              $.fn.isFieldValid('#imap-password', 'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port']) 
              $.fn.isFieldValid('#imap-confirm-password', 'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port']) 
              $.fn.isFieldValid('#imap-port', 'imap-submit-btn', ['imap-server-address','imap-username','imap-password','imap-confirm-password','imap-port']) 
            }


        })
     
    },
    error: (e)=>{

        $.fn.showAlert('Email Accounts Fetch Error', 'danger', `$.fn.showTableRecords('mailaccounts')`)

    }
}
)
}
$.fn.editGmailBox = (query = 'none') => {

  const objectType = 'gmailaccounts'
  $.fn.highlightSidebar(objectType);
  DisplayManager.lastRunFunction = `$.fn.editGmailBox(${query == 'none' ? query : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  let passwordChanged = false;
  let credFileChanged = false;
  $.ajax({
    url: "/cpanel/data/GMailAccounts?gmailaccounts=" + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,
    success: (results) => {

      //let record = results && Object.keys(results).length == 1 ? results['gmailaccounts'][0] : null
      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New'
      let button = record ? 'Update' : 'Add'
      $('.page-title').text(titlePrefix + ' Gmail Account')
      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
           <div class="card card-danger col-md-12 w-100">
          <div class="card-header">
            <h3 class="card-title">${titlePrefix} GMail Account</h3>
          </div>
          <form class="form-horizontal">
            <div class="card-body">
              <div class="form-group row">
                <label for="gmail-server-address" class="col-sm-2 col-form-label">GMail Server</label>
                <div class="col-sm-10">
                  <input type="text" class="form-control" name="gmail_server_address" id="gmail-server-address" value="${record?.servers ? record.servers : ''}" placeholder="https://mail.google.com/">
                </div>
              </div>
              <div class="form-group row">
              <label for="gmail-account-name" class="col-sm-2 col-form-label">Account Name</label>
              <div class="col-sm-10">
                <input type="text" class="form-control" name="gmail_account_name" id="gmail-account-name" value="${record?.account_name ? record.account_name : ''}"  placeholder="${window.appConfig['site_id']}  Account">
              </div>
            </div>
            <div class="form-group row">
                <label for="gmail-email-address" class="col-sm-2 col-form-label" >Email Address</label>
                <div class="col-sm-10">
                  <input type="text" class="form-control" name="gmail_email_address"  id="gmail-email-address"  value="${record?.email_address ? record.email_address : ''}"  placeholder="emailaddress@gmail.com">
                </div>
              </div>
              <div class="form-group row">
                <label for="gmail-api-key" class="col-sm-2 col-form-label">Password\\API Key</label>
                <div class="col-sm-10">
                  <input  type="password" class="form-control" name="gmail_api_key" id="gmail-api-key" value="${record?.api_key ? record.api_key : ''}"  placeholder="password or key">
                </div>
              </div>

             <div class="form-group row">
                <label for="confirm-gmail-api-key" class="col-sm-2 col-form-label">Confirm Password\\API Key</label>
                <div class="col-sm-10">
                  <input  type="password" class="form-control" name="confirm_gmail_api_key" id="confirm-gmail-api-key" value="${record?.api_key ? record.api_key : ''}"  placeholder="confirm password or key">
                </div>
              </div>
             <div class="form-group row">
                <label for="create-cred-file" class="col-sm-2 col-form-label">Create Credential File</label>
                <div class="col-sm-10">
                  <ol>
                  <li> <a href="https://console.cloud.google.com/apis/credentials?_ga=2.180641124.297930122.1719406513-202706936.1719406513" target=”_blank” >Open Google Credentials (click here) </a></li>
                  <li> Click +CREATE CREDENTIALS</li>
                  <li> Choose OAuth Client ID</li>
                  <li> Choose Web Application</li>
                  <li> Type the name of this application (${window.appConfig.site_name})</li>
                  <li> Copy the URL in the address bar of this page and use it for the 'Authorized JavaScript origins' and 'Authorized redirect URIs'</li>
                  <li> Click Create </li>
                  <li> Download Credential in JSON format</li>
                </div>
              </div>
           <div class="form-group row">
              <div class="col-md-2"><label for="credentials-file">Upload Credential File (JSON)</label></div>
              <div class="input-group col-md-10">
                
                <div class="custom-file">
                    <input type="file" class="custom-file-input" id="credentials-file" accept="json" />
                    <label class="custom-file-label" for="credentials-file">Select File</label>
                </div>
              </div>
         </div>

       </div>
            <div class="card-footer">
              <button type="cancel" class="btn btn-default float-left" id="gmail-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-info float-right" id="gmail-submit-btn">${button}</button>
            </div>
          </form>
        </div></div></div>`
      )

      $('#gmail-cancel-btn').on('click', (e) => { e.preventDefault(); $.fn.showTableRecords('mailaccounts'); });

      $('#credentials-file').on('change', (e) => {
        
      
        $('.custom-file-label').html(e.target.value);
               credFileChanged = true;
       
      });

$('#gmail-account-name').on('change', (e)=>{ $.fn.isFieldValid(e.target,'gmail-submit-btn', ['gmail-server-address','gmail-email-address','gmail-api-key','gmail-confirm-api-key'])}) 
$('#gmail-server-address').on('change', (e)=>{ $.fn.isFieldValid(e.target,'gmail-submit-btn', [,'gmail-email-address','gmail-api-key','gmail-confirm-api-key','gmail-account-name'])}) 
$('#gmail-email-address').on('change', (e)=>{ $.fn.isFieldValid(e.target,'gmail-submit-btn', ['gmail-server-address','gmail-api-key','gmail-confirm-api-key','gmail-account-name'])}) 
$('#gmail-api-key').on('change', (e)=>{ $.fn.isFieldValid(e.target,'gmail-submit-btn', ['gmail-server-address','gmail-email-address','gmail-confirm-api-key','gmail-account-name'])}) 
$('#gmail-confirm-api-key').on('change', (e)=>{ $.fn.isFieldValid(e.target,'gmail-submit-btn', ['gmail-server-address','gmail-email-address','gmail-api-key','gmail-account-name'])}) 

$("#gmail-api-key,#gmail-confirm-api-key").on('change', (e)=>{

  let password        = $('#gmail-api-key').val()
  let confirmPassword = $('#gmail-confirm-api-key').val() 
  passwordChanged = true;
  if ( password===confirmPassword ){
      let classList =  $('#gmail-confirm-api-key').attr('class')
      if (classList && classList.indexOf('is-invalid')> -1){
        $('#gmail-confirm-api-key').removeClass('is-invalid')
      }
      classList =  $('#gmail-api-key').attr('class')
      if (classList && classList.indexOf('is-invalid')> -1){
         $('#gmail-api-key').removeClass('is-invalid')
    }
   
   $.fn.areFieldsValid('gmail-submit-btn', ['gmail-account-name','gmail-server-address','gmail-email-address'])
  }else{

    let classList =  $('#gmail-confirm-api-key').attr('class')
    if (classList && classList.indexOf('is-invalid')< 0){
       $('#gmail-confirm-api-key').addClass('is-invalid')
    }
    classList =  $('#gmail-api-key').attr('class')
    if (classList && classList.indexOf('is-invalid')<0){
       $('#gmail-api-key').addClass('is-invalid')
    }

  }

})
        $(".form-control").on('keydown', function (e) {
        
          if (e.key === 'Enter' || e.keyCode === 13) {
                  e.preventDefault();
              $('#gmail-submit-btn').click()
            }
          });
      
       $('#gmail-submit-btn').on('click', (e) => {
         e.preventDefault();
         let serverAddress = $('#gmail-server-address').val()
         let accountName   = $('#gmail-account-name').val()
         let emailAddress  = $('#gmail-email-address').val()
         let apiKey     = $('#gmail-api-key').val()
         let credFile = $('#credentials-file').prop('files')[0]
         
         if ($.fn.areFieldsValid('gmail-submit-btn', ['gmail-account-name', 'gmail-server-address', 'gmail-email-address','gmail-api-key','confirm-gmail-api-key']) && apiKey.length > 0) {
           const formData = new FormData();
           formData.append("mode", titlePrefix.toLowerCase());
           if (titlePrefix.toLowerCase() == "edit") {
             formData.append('account_id', record.account_id)
           }
           formData.append("gmail_server_address", serverAddress);
           formData.append("gmail_account_name", accountName);
           formData.append("gmail_email_address", emailAddress);
         
           if (passwordChanged) {
             formData.append("gmail_api_key", apiKey);
           }

           if (credFileChanged) {
             formData.append("crendentials", credFile);
           }
           formData.append("acky", currentUser.acky);
           $.ajax({
             url: "/cpanel/add/gmail",
             type: "POST",
             data: formData,
             processData: false,
             processData: false,
             contentType: false,
             crossDomain: true,
             success: (result) => {
               new Promise((resolve) => {

                 resolve($.fn.syncLokiCollection('GMailAccounts'), () => { $.fn.showTableRecords('GMailAccounts') }  )
               }).then(() => {

                 $.fn.showAlert(result.message, 'success', `$.fn.showTableRecords('mailaccounts')`)

               })

             },
             error: (e) => {
               new Promise((resolve) => {
                 resolve($.fn.showAlert('Account Creation Failed', 'danger', `$.fn.showTableRecords('mailaccounts')`))
               })

             }
           })

         }
      })

    },
    error: (e) => {
      console.log(e)

    }
  })

}
$.fn.editMailTemplate = (query = 'none') => {
  const objectType = 'mailtemplates';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editMailTemplate(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
     url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Mail Template');
      $.fn.imageData = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
	    $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-10 ">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Mail Template</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="template-id" class="col-sm-2 form-label">Template ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="template_id" id="template-id" value="${record?.template_id ? record.template_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="template-name" class="col-sm-2 form-label">Template Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="template-name" value="${record?.name ? record.name : ''}" placeholder="Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="template-description" class="col-sm-2 form-label">Description</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="template-description" name="template_description"  value="${record?.description ? record.description : ''}">
                </div>
                </div>
          <div class="form-group row">
          <label for="template-contents" class="form-label col-sm-2">Template Contents</label>
                <div  class="col-sm-10"> 
                <textarea id="template-contents" rows="4" name="template_contents" value="">
                  ${record?.contents ? record.contents: 'Place <em>some</em> <u>text</u> <strong>here</strong>'}
                </textarea>
              </div>
          </div>
					<div class="form-group row">
					  <label for="template-id" class="col-sm-2 form-label">Date of Creation</label>
					  <div class="col-sm-10">
						<input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime')  : ''}" placeholder="" disabled>
					  </div>
					</div>
						<div class="form-group row">
					<label for="template-id" class="col-sm-2 form-label">Last Modified</label>
					<div class="col-sm-10">
					<input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ?  $.fn.displayDate(record, 'last_modified_date')  : ''}" placeholder="" disabled>
					</div>
				  </div>
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="template-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="template-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )

	  
	const ImageButton = function (context) {
        let ui = $.summernote.ui;
        var button = ui.button({
          contents: '<i class="fa fa-images"/> Image</i>',
          tooltip: 'Insert Image',
          click: function () {
            $.fn.selectImage(context)
          }
        });

      return button.render();  
      }

      	const SwapButton = function (context) {
        let ui = $.summernote.ui;
        var button = ui.button({
          contents: '<i class="fa fa-swap"/> Placeholder</i>',
          tooltip: 'Insert Placeholder',
          click: function () {
            $.fn.selectPlaceholder(context)
          }
        });

      return button.render();  
      }

      $('#template-contents').summernote({

			height: 600,                 
			minHeight: 600,             
			maxHeight: null,             
			focus: true,                
			toolbar: [
				['style', ['style']],
				['font', ['bold', 'italic', 'underline', 'clear']],
				['fontname', ['fontname']],
				['color', ['color']],
				['para', ['ul', 'ol', 'paragraph']],
				['height', ['height']],
				['table', ['table']],
				['insert', ['link', 'image','swap', 'hr']],
				['view', ['fullscreen', 'codeview']],
				['help', ['help']]
			],
			buttons: {
        image: ImageButton,
        swap: SwapButton
			}
			})
      
          $('#template-cancel-btn').on('click', (e) => {
                e.preventDefault();
            //$.fn.showMailTemplates();
            $.fn.showTableRecords('mailtemplates');
            })

			$('.select2').select2();
			$('#template-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'template-submit-btn', ['template-description']) })
			$('#template-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'template-submit-btn', ['template-name']) })
         $(".form-control").on('keydown', function (e) {
           
           if (e.key === 'Enter' || e.keyCode === 13) {
               e.preventDefault();
              $('#template-submit-btn').click()
            }
          });
            $('#template-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let name = $('#template-name').val();
              let description = $('#template-description').val(); 
			  let contents =  $('#template-contents').val()

              if (description.length == 0) {
                $('#template-description').addClass('is-invalid')
                $('#template-submit-btn').attr('disabled', 'disabled')
              }
              let isValid = $.fn.areFieldsValid('template-submit-btn', ['template-name','template-description']) && description.length > 0

              if (isValid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('template_id', record.template_id)
                }
              
                formData.append("name", name);
                formData.append("description", description);
				        formData.append("contents", contents);
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                       $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Template Creation Failed', 'danger',  () =>{$.fn.showTableRecords(objectType)})
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', () =>{$.fn.showTableRecords(objectType)})
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editClient = (query = 'none') => {
  const objectType = 'clients';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editClient(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  let imageQuery = {"image_type": "profile"}
  $.ajax({
    url: `/cpanel/data/${objectType}+images?${objectType}=`+ JSON.stringify(query)+`&images=`+ JSON.stringify(imageQuery)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

		let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
		let titlePrefix = record ? 'Edit' : 'New';
		let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Client');
      
        let disabled         = record? "disabled" : ""
        let password         = record? "***************":''
		    let activeStatus     = record?.status || !record ? "Enabled" : "Disabled"
        let activeCheck      = activeStatus == "Enabled" ? `checked="checked"` : "";
        const imageData      = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
        
        let imagePreview = imageData ? $.fn.getGoogleUrl(imageData[0]?.google_url ): '';
        let profileImageId =record?.profile_image? record.profile_image["$oid"]  :null
        const imageOptions = imageData ? imageData.map((image) => {
        let selected = "";
                                                               
        if (profileImageId && image._id == profileImageId) {
          selected = `selected="selected"`;
          imagePreview = $.fn.getGoogleUrl(image.google_url)
         
        }
        return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

      }) : [];
		
        $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Client</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
			         <div class="form-group row">
						<label  for="profile-image" class="col-md-2">Profile Image</label>
						<div class="col-md-10"> 
							<div id="image-preview" class="text-center"><img class="simg-fluid" style="height:auto;max-width:100%" id="preview-image" src="${imagePreview}" alt="Profile Image"/> </div>
						 <select name="profile_image" id="profile-image" class="form-control select2" style="width: 100%;">
								${imageOptions}
						</select>
              
						</div>
					</div>
              <div class="form-group row">
                <label for="client-id" class="col-sm-2 form-label">Client ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="client_id" id="client-id" value="${record?.client_id ? record.client_id : ''}" placeholder="Client ID" disabled>
                </div>
              </div>
			 <div class="form-group row">
					<label for="first-name" class="col-sm-2 form-label">First Name</label>
					<div class="col-sm-10">
					<input type="text" class="form-control" name="first_name" id="first-name" value="${record?.first_name ? record.first_name : ''}" placeholder="First Name">
					</div>
				  </div>
				  <div class="form-group row">
					<label for="last-name" class="col-sm-2 form-label">last Name</label>
					<div class="col-sm-10">
					<input type="text" class="form-control" name="last_name" id="last-name" value="${record?.last_name ? record.last_name : ''}" placeholder="Last Name">
					</div>
				  </div>
				<div class="form-group row">
					<div  class="col-sm-2">
					<label>Date of Birth </label>
					</div>
					<div class="input-group date col-sm-10" id="date-of-birth" data-target-input="nearest">
					<input type="text" id="birth-date" class="form-control form-control-lg datetimepicker-input" data-target="#date-of-birth" value="${record?.date_of_birth ?  $.fn.displayDate(record, 'date_of_birth') : ''}"/>
					<div class="input-group-append" data-target="#date-of-birth" data-toggle="datetimepicker">
					<div class="input-group-text"><i class="fa fa-calendar"></i></div>
					</div>
					</div>
				</div>
				<div class="form-group row">
					<label for="email-address" class="col-sm-2 form-label">Email Address</label>
					<div class="col-sm-10">
					<input type="text" class="form-control" name="email_address" id="email-address" value="${record?.email_address ? record.email_address : ''}" placeholder="Email Address">
					</div>
				</div>
					<div class="form-group row">
			 <label for="password" class="col-sm-2 col-form-label">Password</label>
			 <div class="col-sm-10">
				<input type="password" class="form-control" name="password" id="password" value="${password}" placeholder="Password" />
			 </div>
         </div>
		 
		 <div class="form-group row">
			 <label for="confirm-password" class="col-sm-2 form-label">Confirm Password</label>
			 <div class="col-sm-10">
				<input type="password" class="form-control" name="confirm_password" id="confirm-password" value="${password}" placeholder="Confirm Password" />
			 </div>
         </div>
				
				<div class="form-group row">
					<div  class="col-sm-2">
						<label for="phone-number">Phone Number</label>
					</div>
					<div  class="col-sm-10">
						<input type="text" class="form-control form-control-lg" name="phone_number" id="phone-number" placeholder="" value="${record?.phone_number ? record.phone_number : ''}">
					</div>
				</div>
				
				  <div class="form-group row">
					<label for="address" class="col-sm-2 form-label">Address</label>
					<div class="col-sm-10">
					<input type="text" class="form-control" name="address" id="address" value="${record?.address ? record.address : ''}" placeholder="Address">
					</div>
				  </div>

          <div class="form-group row">
          <label class="col-sm-2 form-label">Active</label>
                    <div class="col-sm-10 custom-control custom-switch custom-switch-off-danger custom-switch-on-success">
                      <input type="checkbox" class="custom-control-input" id="status" ${activeCheck}  />
                      <label class="custom-control-label" for="status" id="status-label">${activeStatus}</label>
                    </div>
          </div>
		  
                <div class="form-group row">
                <label for="orders" class="col-sm-2 form-label">Orders</label>
					<div class="col-sm-10">
						<input type="text"   class="form-control"  id="orders" name="orders"  value="${record?.orders ? record.orders : ''}" disabled="disabled">
					</div>
                </div>
                <div class="form-group row">
                  <label for="client-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ?  $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="client-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="client-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="client-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )
          let passwordChanged = false;
          $('#client-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('clients');
            })

            $('.select2').select2();
			

      if(record  && record.date_of_birth && record.date_of_birth!=""){ 
            //console.log(`Date of birth: ${record.date_of_birth}`)
            $('#date-of-birth').datetimepicker({ "date": $.fn.getDateFromObject( record.date_of_birth),format:'YYYY/MM/DDz'});
          
       } else { 
        
            $('#date-of-birth').datetimepicker({
              format:'YYYY/MM/DDz'
            });
        }
	   
	   
		
      $('#profile-image').on('change', (e)=>{
            
            document.getElementById('preview-image').src = $.fn.getGoogleUrl(e.target.value)	   
        })



      $('.custom-control-input').click((e) => { 
        let elementID = e.target.id
        if ($(`#${elementID}`).attr("checked") == "checked") {
            $(`#${elementID}`).removeAttr("checked")
        } else {
               $(`#${elementID}`).attr("checked", "checked")   
        }
        switch (elementID) { 
  
          case 'status':
              let statusLabel = $('#status-label').html()
              if (statusLabel == 'Enabled') {

                $('#status-label').html('Disabled')
              } else { 

                $('#status-label').html('Enabled')
            }
            break;
            case 'reset':
              let resetLabel = $('#reset-label').html()
              if (resetLabel == 'Pending') {

                $('#reset-label').html('')
              } else { 

                $('#reset-label').html('Pending')
            }
          break;
        }
        
        
        })
      //    $('.select2').select2()
    
    $('#password,#confirm-password').each(function (e) {
                    
      $(this).on('change', function (e) {
          
            passwordChanged = true;
            var id = e.target.id;
            var password = $('#password').val()
            var confirmPassword = $('#confirm-password').val()
            var minPassLen = 8
            //$('#' + id + '-errors').html('');
            if (!password || password == '') {
                                            
              $('#password').addClass('is-invalid')
              $('#user-submit-btn').attr('disabled', 'disabled')
                        
            }

            if (!confirmPassword || confirmPassword == '') {
                                                
              $('#confirm-password').addClass('is-invalid')
              $('#user-submit-btn').attr('disabled', 'disabled')

            }

            if ((password  &&  password.length > 0) && (confirmPassword && confirmPassword.length > 0)) {

              if ((password.length < minPassLen) || (password != confirmPassword) || (password == confirmPassword && !$.fn.isValidPass(password))) {
                              
                $('#password').addClass('is-invalid')
                $('#confirm-password').addClass('is-invalid')
                $('#user-submit-btn').attr('disabled', 'disabled')
                        
              } else if (password == confirmPassword && $.fn.isValidPass(password)) {

                $('#password').removeClass('is-invalid');
                $('#confirm-password').removeClass('is-invalid');
               
              }

            }

          })

        });

	      
		$('#first-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'client-submit-btn', ['last-name', 'email-address', 'address', 'phone-number']) })
		$('#last-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'client-submit-btn', ['first-name', 'email-address', 'address', 'phone-number']) })
		$('#email-address').on('change', (e) => { $.fn.isFieldValid(e.target, 'client-submit-btn', ['first-name','last-name', 'email-address', 'address', 'phone-number']) })
		$('#address').on('change', (e) => { $.fn.isFieldValid(e.target, 'client-submit-btn', ['first-name','last-name', 'email-address', 'address', 'phone-number']) })
		$('#phone-number').on('change', (e) => { $.fn.isFieldValid(e.target, 'client-submit-btn', ['first-name', 'last-name', 'email-address', 'address', 'phone-number']) })
    
     $(".form-control").on('keydown', function (e) {
           
       if (e.key === 'Enter' || e.keyCode === 13) {
               e.preventDefault();
              $('#client-submit-btn').click()
            }
     });
    $('#client-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              
              let firstName       = $('#first-name').val();
              let lastName        = $('#last-name').val()
              let emailAddress    = $('#email-address').val()
              let address         = $('#address').val();
              let birthDate       = $('#birth-date').val();
              let phoneNumber     = $('#phone-number').val();
              let status          = $('#status').attr("checked") == "checked" ? 1 : 0;
              let profileImage    = $('#profile-image').val()
              let password        = $("#password").val()

              let valid           = $.fn.areFieldsValid('creator-submit-btn', [ 'first-name', 'last-name','email-address', 'address', 'phone-number'])
              if (valid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('client_id', record.client_id)
                }

                formData.append("first_name", firstName);
                formData.append("last_name", lastName);
                formData.append("email_address", emailAddress);
                formData.append("address", address);
                formData.append("date_of_birth", birthDate);
                formData.append("phone_number", phoneNumber);
                formData.append("status", status);
                formData.append("profile_image", profileImage);
                if (passwordChanged) { 
                  formData.append("password", password)
                }
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                            $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Client Creation Failed', 'danger', () =>{$.fn.showTableRecords(objectType)})
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()')
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editPartner = (query = 'none') => {
  const objectType = 'partners';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editPartner(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
      url: `/cpanel/data/${objectType}+images?${objectType}=` + JSON.stringify(query)+`&images={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

        let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
        let titlePrefix = record ? 'Edit' : 'New';
        let button = record ? 'Update' : 'Add';
        $('.page-title').text(titlePrefix + ' Partner');
        const imageData    = Object.keys(results).includes('images') && results['images'].length > 0 ? results['images'] : [];
        let imagePreview   =    imageData ? $.fn.getGoogleUrl(imageData[0]?.google_url) : '';
        const imageOptions = imageData ? imageData.map((image) => {
            let selected   = "";               
            if (record && record?.partner_image && image.image_id == record.partner_image.image_id) {
              selected = `selected="selected"`;
              imagePreview =$.fn.getGoogleUrl( image.google_url)
            }
            return `<option value="${image.google_url}" ${selected}>${image.image_name}</option>`

          }) : [];

      $('#contentwrapper-node').html(
        `<div class="container-fluid"><div class="row">       
                          <div class="card card-dark col-md-12 w-100">
                          <div class="card-header">
                          <h3 class="card-title">${titlePrefix} Partner</h3>
                          </div>
                          <form class="form-horizontal">
                          <div class="card-body">
                          <div class="form-group row">
                            <label for="partner-id" class="col-sm-2 form-label">Partner ID</label>
                            <div class="col-sm-10">
                            <input type="text" class="form-control" name="partner_id" id="partner-id" value="${record?.partner_id ? record.partner_id : ''}" placeholder="ID" disabled>
                            </div>
                          </div>
                          <div class="form-group row">
                            <label for="partner-name" class="col-sm-2 form-label">Partner Name</label>
                            <div class="col-sm-10">
                            <input type="text" class="form-control" name="name" id="partner-name" value="${record?.partner_name ? record.partner_name : ''}" placeholder="Name">
                            </div>
                          </div>
                            <div class="form-group row">
                            <label for="partner-description" class="col-sm-2 form-label">Description</label>
                            <div class="col-sm-10">
                            <input type="text"   class="form-control"  id="partner-description" name="partner_description"  value="${record?.description ? record.description : ''}">
                            </div>
                            </div>
                    <div class="form-group row">
                        <label  for="partner-image" class="col-md-2">Partner Image</label>
                        <div class="col-md-10"> 
                          <div id="image-preview" class="text-center"><img class="simg-fluid" style="height:auto;max-width:100%"  id="preview-image" src="${imagePreview}" alt="Partner Image"/> </div>
                          <br />
                        <select name="partner_image" id="partner-image" class="form-control select2" style="width: 100%;">
                            ${imageOptions}
                        </select>
                          
                        </div>
                      </div>
                            <div class="form-group row">
                              <label for="partner-id" class="col-sm-2 form-label">Date of Creation</label>
                              <div class="col-sm-10">
                                <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                              </div>
                            </div>
                                <div class="form-group row">
                            <label for="partner-id" class="col-sm-2 form-label">Last Modified</label>
                            <div class="col-sm-10">
                            <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                            </div>
                          </div>
                          
                            </div>
                            <div class="card-footer">
                            <button type="cancel" class="btn btn-default float-left" id="partner-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-info float-right" id="partner-submit-btn">${button}</button>
                            </div>
                          </form>
                          </div></div></div>`
      );
          
              $('#partner-cancel-btn').on('click', (e) => {
                    e.preventDefault();
                    $.fn.showTableRecords('partners');
                })

                $('.select2').select2();
                $('#partner-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'partner-submit-btn', ['partner-name']) })
                //$('#partner-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'partner-submit-btn', ['partner-name']) })
                $('#partner-description').on('change', (e) => {
                let descr = $('#partner-description').val().trim()
                let classList = $('#partner-description').attr('class')

                if (descr.length > 0) {
                  if (classList.indexOf('is-invalid') > -1) {
                    $('#partner-description').removeClass('is-invalid')
                    $('#partner-description').removeClass('is-valid')
                    $('#partner-submit-btn').removeAttr('disabled', 'disabled')
                  }
                } else {
                  $('#partner-description').addClass('is-invalid')
                  $('#partner-submit-btn').attr('disabled', 'disabled')
                }

                })
            
            $('#partner-image').on('change', (e)=>{
                
            document.getElementById('preview-image').src =  $.fn.getGoogleUrl(e.target.value) 	   
          
          })


                $(".form-control").on('keydown', function (e) {
                  
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    $('#partner-submit-btn').click()
                  }
                });

                $('#partner-submit-btn').on('submit click',(e) => { 
                  e.preventDefault();
                  let name = $('#partner-name').val();
                  let description = $('#partner-description').val();  
            let partnerImage    = $('#partner-image').val()

                  if (description.length == 0) {
                    $('#partner-description').addClass('is-invalid')
                    $('#partner-submit-btn').attr('disabled', 'disabled')
                  }
                  let isValid = $.fn.areFieldsValid('partner-submit-btn', ['partner-name']) && description.length > 0

                  if (isValid) {
                        

                    const formData = new FormData();
                    formData.append("mode", titlePrefix.toLowerCase());
                    if (titlePrefix.toLowerCase() == "edit") {
                      formData.append('partner_id', record.partner_id)
                    }
                  
                  
                    formData.append("partner_name", name);
                    formData.append("description", description);
            formData.append("partner_image", partnerImage)
            
                    formData.append("acky", currentUser.acky);
                    $.ajax({
                          url: `cpanel/add/${objectType}`,
                          type: "POST",
                          data: formData,
                          processData: false,
                          contentType: false,
                          crossDomain: true,
                          success: (result) => {
                          $.fn.showUpdatedTable(result, objectType)
                          },
                          error: (e) => {
                                $.fn.showAlert('Partner Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                              
                          

                          }
                    })

                      } else { 
                          $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
                      }
                    
                      
                  })

    },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editServiceType = (query = 'none') => {
  const objectType = 'servicetypes';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editServiceType(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}?${objectType}=` + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' ServiceType');


      $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Service Type</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="type-id" class="col-sm-2 form-label">Type ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="type_id" id="type-id" value="${record?.type_id ? record.type_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="type-name" class="col-sm-2 form-label">Type Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="type_name" id="type-name" value="${record?.type_name ? record.type_name : ''}" placeholder="Type Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="type-description" class="col-sm-2 form-label">Type Description</label>
                <div class="col-sm-10">
                <input type="text"  class="form-control"  id="type-description" name="type_description"  value="${record?.type_description ? record.type_description : ''}">
                </div>
                </div>
                <div class="form-group row">
                  <label for="created-datetime" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="last-modified-date" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="type-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="type-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
          )


          $('#type-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('servicetypes');
            })

            $('.select2').select2();
            $('#type-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'type-submit-btn', ['type-name', 'type-description']) });
            $('#type-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'type-submit-btn', ['type-name','type-description']) });
           
            $(".form-control").on('keydown', function (e) {
              
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                $('#type-submit-btn').click()
              }
            });

            $('#type-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let typeName = $('#type-name').val();
              let typeDescription = $('#type-description').val();  

              if (typeDescription && typeDescription.length == 0) {
                $('#type-description').addClass('is-invalid')
                $('#type-submit-btn').attr('disabled', 'disabled')
              }
              let isValid = $.fn.areFieldsValid('type-submit-btn', ['type-name']) && typeDescription.length > 0

              if (isValid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('type_id', record.type_id)
                }
        
                formData.append("type_name", typeName);
                formData.append("type_description", typeDescription);
                formData.append("acky", currentUser.acky);
                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                       $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Service Type Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                       

                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editService = (query = 'none') => {
			const objectType = 'services';
			$.fn.highlightSidebar(objectType)
			DisplayManager.lastRunFunction = `$.fn.editService(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
			DisplayManager.lastObjectType = objectType;
			$.ajax({
			url: `/cpanel/data/${objectType}+servicetypes+pages?${objectType}=` + JSON.stringify(query)+`&servicetypes={}&pages={}&acky=${currentUser.acky}`,
			type: "GET",
			processData: false,
			contentType: false,
			crossDomain: true,

			success: (results) => {
        //console.log(results);
			  let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
			  let titlePrefix = record ? 'Edit' : 'New';
			  let button = record ? 'Update' : 'Add';
			  $('.page-title').text(titlePrefix + ' Service');
			  
			  let pages = Object.keys(results).includes('pages') && results['pages'].length > 0 ? results['pages'] : [];
			  let types = Object.keys(results).includes('servicetypes') && results['servicetypes'].length > 0 ? results['servicetypes'] : [];
			  
			  let typeOptions =types && types.length> 0? types.map((servType) => {
            let selected = "";
            if ( record  && record.service_type['$oid']  ==  servType._id ) {
            selected = `selected="selected"`
            }
            return `<option value="${servType.type_id}" ${selected}>${servType.type_name}</option>`;
				}):[] ;
				
		     let pageOptions =pages && pages.length> 0? pages.map((page) => {
				  let selected = "";
				  if ( record && record.page  && record.page['$oid']  ==  page._id ) {
					    selected = `selected="selected"`
				  }
				  return `<option value="${page.page_id}" ${selected}>${page.page_name}</option>`
         }) : [] 
        
        let periodOptions =  ['weekly','monthly', 'yearly'].map((opt, key) => {
              let selected = "";
              if (record  && record.perioid?.toString().toLowerCase() ==  opt) {
                selected = `selected="selected"`
              }
              return `<option value="${key}" ${selected}>${opt}</option>`
        });
        
        const currencyList = [
          { "value": "CAD", "label": "Canadian dollar" },
          { "value": "USD", "label": "US dollar" },
          { "value": "NGN", "label": "Nigerian naira" },
          { "value": "EUR", "label": "Euro" },
          { "value": "JPY", "label": "Japanese yen" },
          { "value": "GBP", "label": "Pound sterling" },
          { "value": "AED", "label": "United Arab Emirates dirham" },
          { "value": "AFN", "label": "Afghan afghani" },
          { "value": "ALL", "label": "Albanian lek" },
          { "value": "AMD", "label": "Armenian dram" },
          { "value": "ANG", "label": "Netherlands Antillean guilder" },
          { "value": "AOA", "label": "Angolan kwanza" },
          { "value": "ARS", "label": "Argentine peso" },
          { "value": "AUD", "label": "Australian dollar" },
          { "value": "AWG", "label": "Aruban florin" },
          { "value": "AZN", "label": "Azerbaijani manat" },
          { "value": "BAM", "label": "Bosnia and Herzegovina convertible mark" },
          { "value": "BBD", "label": "Barbadian dollar" },
          { "value": "BDT", "label": "Bangladeshi taka" },
          { "value": "BGN", "label": "Bulgarian lev" },
          { "value": "BHD", "label": "Bahraini dinar" },
          { "value": "BIF", "label": "Burundian franc" },
          { "value": "BMD", "label": "Bermudian dollar" },
          { "value": "BND", "label": "Brunei dollar" },
          { "value": "BOB", "label": "Bolivian boliviano" },
          { "value": "BRL", "label": "Brazilian real" },
          { "value": "BSD", "label": "Bahamian dollar" },
          { "value": "BTN", "label": "Bhutanese ngultrum" },
          { "value": "BWP", "label": "Botswana pula" },
          { "value": "BYN", "label": "Belarusian ruble" },
          { "value": "BZD", "label": "Belize dollar" },
          { "value": "CDF", "label": "Congolese franc" },
          { "value": "CHF", "label": "Swiss franc" },
          { "value": "CLP", "label": "Chilean peso" },
          { "value": "CNY", "label": "Chinese yuan" },
          { "value": "COP", "label": "Colombian peso" },
          { "value": "CRC", "label": "Costa Rican colón" },
          { "value": "CUC", "label": "Cuban convertible peso" },
          { "value": "CUP", "label": "Cuban peso" },
          { "value": "CVE", "label": "Cape Verdean escudo" },
          { "value": "CZK", "label": "Czech koruna" },
          { "value": "DJF", "label": "Djiboutian franc" },
          { "value": "DKK", "label": "Danish krone" },
          { "value": "DOP", "label": "Dominican peso" },
          { "value": "DZD", "label": "Algerian dinar" },
          { "value": "EGP", "label": "Egyptian pound" },
          { "value": "ERN", "label": "Eritrean nakfa" },
          { "value": "ETB", "label": "Ethiopian birr" },
          { "value": "EUR", "label": "EURO" },
          { "value": "FJD", "label": "Fijian dollar" },
          { "value": "FKP", "label": "Falkland Islands pound" },
          { "value": "GBP", "label": "British pound" },
          { "value": "GEL", "label": "Georgian lari" },
          { "value": "GGP", "label": "Guernsey pound" },
          { "value": "GHS", "label": "Ghanaian cedi" },
          { "value": "GIP", "label": "Gibraltar pound" },
          { "value": "GMD", "label": "Gambian dalasi" },
          { "value": "GNF", "label": "Guinean franc" },
          { "value": "GTQ", "label": "Guatemalan quetzal" },
          { "value": "GYD", "label": "Guyanese dollar" },
          { "value": "HKD", "label": "Hong Kong dollar" },
          { "value": "HNL", "label": "Honduran lempira" },
          { "value": "HRK", "label": "Croatian kuna" },
          { "value": "HTG", "label": "Haitian gourde" },
          { "value": "HUF", "label": "Hungarian forint" },
          { "value": "IDR", "label": "Indonesian rupiah" },
          { "value": "ILS", "label": "Israeli new shekel" },
          { "value": "IMP", "label": "Manx pound" },
          { "value": "INR", "label": "Indian rupee" },
          { "value": "IQD", "label": "Iraqi dinar" },
          { "value": "IRR", "label": "Iranian rial" },
          { "value": "ISK", "label": "Icelandic króna" },
          { "value": "JEP", "label": "Jersey pound" },
          { "value": "JMD", "label": "Jamaican dollar" },
          { "value": "JOD", "label": "Jordanian dinar" },
          { "value": "JPY", "label": "Japanese yen" },
          { "value": "KES", "label": "Kenyan shilling" },
          { "value": "KGS", "label": "Kyrgyzstani som" },
          { "value": "KHR", "label": "Cambodian riel" },
          { "value": "KID", "label": "Kiribati dollar" },
          { "value": "KMF", "label": "Comorian franc" },
          { "value": "KPW", "label": "North Korean won" },
          { "value": "KRW", "label": "South Korean won" },
          { "value": "KWD", "label": "Kuwaiti dinar" },
          { "value": "KYD", "label": "Cayman Islands dollar" },
          { "value": "KZT", "label": "Kazakhstani tenge" },
          { "value": "LAK", "label": "Lao kip" },
          { "value": "LBP", "label": "Lebanese pound" },
          { "value": "LKR", "label": "Sri Lankan rupee" },
          { "value": "LRD", "label": "Liberian dollar" },
          { "value": "LSL", "label": "Lesotho loti" },
          { "value": "LYD", "label": "Libyan dinar" },
          { "value": "MAD", "label": "Moroccan dirham" },
          { "value": "MDL", "label": "Moldovan leu" },
          { "value": "MGA", "label": "Malagasy ariary" },
          { "value": "MKD", "label": "Macedonian denar" },
          { "value": "MMK", "label": "Burmese kyat" },
          { "value": "MNT", "label": "Mongolian tögrög" },
          { "value": "MOP", "label": "Macanese pataca" },
          { "value": "MRU", "label": "Mauritanian ouguiya" },
          { "value": "MUR", "label": "Mauritian rupee" },
          { "value": "MVR", "label": "Maldivian rufiyaa" },
          { "value": "MWK", "label": "Malawian kwacha" },
          { "value": "MXN", "label": "Mexican peso" },
          { "value": "MYR", "label": "Malaysian ringgit" },
          { "value": "MZN", "label": "Mozambican metical" },
          { "value": "NAD", "label": "Namibian dollar" },
          { "value": "NIO", "label": "Nicaraguan córdoba" },
          { "value": "NOK", "label": "Norwegian krone" },
          { "value": "NPR", "label": "Nepalese rupee" },
          { "value": "NZD", "label": "New Zealand dollar" },
          { "value": "OMR", "label": "Omani rial" },
          { "value": "PAB", "label": "Panamanian balboa" },
          { "value": "PEN", "label": "Peruvian sol" },
          { "value": "PGK", "label": "Papua New Guinean kina" },
          { "value": "PHP", "label": "Philippine peso" },
          { "value": "PKR", "label": "Pakistani rupee" },
          { "value": "PLN", "label": "Polish złoty" },
          { "value": "PRB", "label": "Transnistrian ruble" },
          { "value": "PYG", "label": "Paraguayan guaraní" },
          { "value": "QAR", "label": "Qatari riyal" },
          { "value": "RON", "label": "Romanian leu" },
          { "value": "RSD", "label": "Serbian dinar" },
          { "value": "RUB", "label": "Russian ruble" },
          { "value": "RWF", "label": "Rwandan franc" },
          { "value": "SAR", "label": "Saudi riyal" },
          { "value": "SEK", "label": "Swedish krona" },
          { "value": "SGD", "label": "Singapore dollar" },
          { "value": "SHP", "label": "Saint Helena pound" },
          { "value": "SLL", "label": "Sierra Leonean leone" },
          { "value": "SLS", "label": "Somaliland shilling" },
          { "value": "SOS", "label": "Somali shilling" },
          { "value": "SRD", "label": "Surinamese dollar" },
          { "value": "SSP", "label": "South Sudanese pound" },
          { "value": "STN", "label": "São Tomé and Príncipe dobra" },
          { "value": "SYP", "label": "Syrian pound" },
          { "value": "SZL", "label": "Swazi lilangeni" },
          { "value": "THB", "label": "Thai baht" },
          { "value": "TJS", "label": "Tajikistani somoni" },
          { "value": "TMT", "label": "Turkmenistan manat" },
          { "value": "TND", "label": "Tunisian dinar" },
          { "value": "TOP", "label": "Tongan paʻanga" },
          { "value": "TRY", "label": "Turkish lira" },
          { "value": "TTD", "label": "Trinidad and Tobago dollar" },
          { "value": "TVD", "label": "Tuvaluan dollar" },
          { "value": "TWD", "label": "New Taiwan dollar" },
          { "value": "TZS", "label": "Tanzanian shilling" },
          { "value": "UAH", "label": "Ukrainian hryvnia" },
          { "value": "UGX", "label": "Ugandan shilling" },
          { "value": "USD", "label": "United States dollar" },
          { "value": "UYU", "label": "Uruguayan peso" },
          { "value": "UZS", "label": "Uzbekistani soʻm" },
          { "value": "VES", "label": "Venezuelan bolívar soberano" },
          { "value": "VND", "label": "Vietnamese đồng" },
          { "value": "VUV", "label": "Vanuatu vatu" },
          { "value": "WST", "label": "Samoan tālā" },
          { "value": "XAF", "label": "Central African CFA franc" },
          { "value": "XCD", "label": "Eastern Caribbean dollar" },
          { "value": "XOF", "label": "West African CFA franc" },
          { "value": "XPF", "label": "CFP franc" },
          { "value": "ZAR", "label": "South African rand" },
          { "value": "ZMW", "label": "Zambian kwacha" },
          { "value": "ZWB", "label": "Zimbabwean bonds" }
        ];
        
          let currencyOptions =  currencyList.map((opt, key) => {
              let selected = "";
              if (record  && record.currency?.toString().toLowerCase() ==  opt.value) {
                selected = `selected="selected"`
              }
              return `<option value="${opt.value}" label="${opt.label}" ${selected}>${opt.value}</option>`
        });

        $('#contentwrapper-node').html(
          `<div class="container-fluid"><div class="row">       
					  <div class="card card-dark col-md-12 w-100">
					  <div class="card-header">
					  <h3 class="card-title">${titlePrefix} Service</h3>
					  </div>
					  <form class="form-horizontal">
					  <div class="card-body">
					  <div class="form-group row">
						<label for="service-id" class="col-sm-2 form-label">Service ID</label>
						<div class="col-sm-10">
						<input type="text" class="form-control" name="service_id" id="service-id" value="${record?.service_id ? record.service_id : ''}" placeholder="ID" disabled>
						</div>
					  </div>
					  <div class="form-group row">
						<label for="service-name" class="col-sm-2 form-label">Service Name</label>
						<div class="col-sm-10">
						<input type="text" class="form-control" name="name" id="name" value="${record?.name ? record.name : ''}" placeholder="Name">
						</div>
					  </div>
						<div class="form-group row">
						<label for="service-description" class="col-sm-2 form-label">Description</label>
							<div class="col-sm-10">
							<input type="text"   class="form-control"  id="description" name="description"  value="${record?.description ? record.description : ''}">
							</div>
						</div>
	                    <div class="form-group row">
                    <label for="service-page" class="col-sm-2 form-label">Page</label>
                    <div class="col-sm-10">
                    <select class="form-control select2" name="currency" id="currency" style="width: 100%;">
                    ${currencyOptions.join('')}
                    </select>
                    </div>
                    </div>
				      <div class="form-group row">
						<label for="price" class="col-sm-2 form-label">Price</label>
						<div class="col-sm-10">
						<input type="text" class="form-control" name="price" id="price" value="${record?.price ? record.price : ''}" placeholder="Price">
						</div>
					  </div>

            			    <div class="form-group row">
                  <label for="period" class="col-sm-2 form-label">Period</label>
                  <div class="col-sm-10">
                    <select class="select2" name="period" id="period" data-placeholder="period" style="width: 100%;">
                    ${periodOptions.join('')}
                    </select>
                  </div>
                </div>
					  <div class="form-group row">
							<label for="available-features" class="col-sm-2 col-form-label">Available Features</label>
							<div class="col-sm-10">
							   <div class="row">
                      <div class="col-md-8">
                          <textarea class="form-control" id="available-features" rows="3" placeholder="" disabled="" style="resize: none;">${record?.available_features ? record.available_features.join('\n') : ''}</textarea>
                          <input type="text" class="form-control" name="available_feature" id="available-feature" value="" placeholder="Add Item" />
                      </div>
                      <div  class="col-sm-2">
					
                          <div class="row mt-4"><button  class="btn btn-danger" id="avail-feature-rm-btn">Remove</button></div>
                          <div class="row mt-4"><button  class="btn btn-primary" id="avail-feature-add-btn">Add</button></div> 
                    </div>
								</div>
							</div>
 
						</div>
						
					<div class="form-group row">
							<label for="restricted-features" class="col-sm-2 col-form-label">Restricted Features</label>
							<div class="col-sm-10">
							   <div class="row">
                      <div class="col-md-8">
                          <textarea class="form-control" id="restricted-features" rows="3" placeholder="" disabled="" style="resize: none;">${record?.restricted_features ? record.restricted_features.join('\n') : ''}</textarea>
                          <input type="text" class="form-control" name="restricted_feature" id="restricted-feature" value="" placeholder="Add Item" />
                      </div>
                      <div  class="col-sm-2">
                          <div class="row mt-4"><button  class="btn btn-danger" id="restr-feature-rm-btn">Remove</button></div>
                          <div class="row mt-4"><button  class="btn btn-primary" id="restr-feature-add-btn">Add</button></div> 
                    </div>
								</div>
							</div>
						</div>
						  <div class="form-group row">
                  <label for="service-types" class="col-sm-2 form-label">Service Type</label>
                  <div class="col-sm-10">
                    <select class="select2" name="service_type" id="service-type" data-placeholder="Service Types" style="width: 100%;">
                    ${typeOptions.join('')}
                    </select>
                  </div>
                </div>
                    <div class="form-group row">
                    <label for="service-page" class="col-sm-2 form-label">Page</label>
                    <div class="col-sm-10">
                    <select class="select2" name="service_page" id="service-page"  data-placeholder="Service Page" style="width: 100%;">
                    ${pageOptions.join('')}
                    </select>
                    </div>
                    </div>
						<div class="form-group row">
						  <label for="service-id" class="col-sm-2 form-label">Date of Creation</label>
						  <div class="col-sm-10">
							<input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
						  </div>
						</div>
							<div class="form-group row">
						<label for="service-id" class="col-sm-2 form-label">Last Modified</label>
						<div class="col-sm-10">
						<input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
						</div>
					  </div>
					  
						</div>
						<div class="card-footer">
						<button type="cancel" class="btn btn-default float-left" id="service-cancel-btn">Cancel</button>
						<button type="submit" class="btn btn-info float-right" id="service-submit-btn">${button}</button>
						</div>
					  </form>
					  </div></div></div>`
        );

      $('#avail-feature-rm-btn').on('click', (e) => {
                e.preventDefault();
                let optionsText  = $('#available-features').val();
                let optionsList  = [];
                if (optionsText !== "") { 
                    optionsList   = optionsText.split('\n');
                    optionsList.pop();
                    $('#available-features').val(optionsList.join('\n'));
                }
                
                if (optionsList.join('').trim().length == 0) { 
                     $('#available-features').addClass('is-invalid')
                      $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
                     // $('#service-submit-btn').attr('disabled', 'disabled')
                }
        
              })
        
        $('#avail-feature-add-btn').on('click', (e) => {
              e.preventDefault();
              let optionsText  = $('#available-features').val();
              let optionItem   = $('#available-feature').val()
              if (optionItem && optionItem.trim() != "") {
              let optionsList = [];
              optionsList = optionsText.split('\n');
              if (!optionsList.includes(optionItem.trim())) { 
                  optionsList.push(optionItem.trim());
                  let classList = $('#available-features').attr('class')
                  if (classList.indexOf('is-invalid')> -1 && optionItem.length >0){
                  $('#available-features').removeClass('is-invalid'); 
                  $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
                  }
                }
                  
              $('#available-features').val(optionsList.join('\n'));
              $('#available-feature').val('');


            } else {

              $.fn.showAlert('Please provide a feature', 'warning');
              $('#available-feature').addClass('is-invalid')
              }


          })
          
        $('#available-features').on('change', (e) => {
            let optionItem =$('#available-feature').val()
            let classList = $('#available-features').attr('class')
            if (classList.indexOf('is-invalid')> -1 && optionItem.length >0){
              $('#available-features').removeClass('is-invalid');
              $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
            }

            
            })
	
	      $('#restr-feature-rm-btn').on('click', (e) => {
            e.preventDefault();
            let optionsText  = $('#restricted-features').val();
            let optionsList  = [];
            if (optionsText !== "") { 
              optionsList   = optionsText.split('\n');
              optionsList.pop();
              $('#restricted-features').val(optionsList.join('\n'));
            }
            
            if (optionsList.join('').trim().length == 0) { 
                $('#restricted-features').addClass('is-invalid')
                   $.fn.areFieldsValid('service-submit-btn', ['name',  'description']);
                  $('#service-submit-btn').attr('disabled', 'disabled')
            }
    
          })
      
        $('#restr-feature-add-btn').on('click', (e) => {
              e.preventDefault();
              let optionsText  = $('#restricted-features').val();
              let optionItem   = $('#restricted-feature').val()
              if (optionItem && optionItem.trim() != "") {
                let optionsList = [];
                optionsList = optionsText.split('\n');
                if (!optionsList.includes(optionItem.trim())) { 
                      optionsList.push(optionItem.trim());
                      let classList = $('#restricted-features').attr('class')
                      if (classList.indexOf('is-invalid')> -1 && optionItem.length >0){
                        $('#restricted-features').removeClass('is-invalid'); 
                        $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
                      }
                  }
                    
                $('#restricted-features').val(optionsList.join('\n'));
                $('#restricted-feature').val('');


          } else {

                $.fn.showAlert('Please provide a feature', 'warning');
                $('#restricted-features').addClass('is-invalid');
                 $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
            }


        })
          
        $('#restricted-features').on('change', (e) => {
          let optionItem =$('#restricted-feature').val()
          let classList = $('#restricted-features').attr('class')
          if (classList.indexOf('is-invalid')> -1 && optionItem.length >0){
            $('#restricted-features').removeClass('is-invalid')
              $.fn.areFieldsValid('service-submit-btn', ['name', 'description']);
          }

          
        })

        $('#service-cancel-btn').on('click', (e) => {
                  e.preventDefault();
                  $.fn.showTableRecords('services');
         })

					$('.select2').select2();
					$('#name,#description').on('change', (e) => { $.fn.isFieldValid(e.target, 'service-submit-btn', ['name', 'description']) })
          $('#price').on('change', (e) => {
            let value = e.target.value;
            let element = '#price'
            let buttonID = 'service-submit-btn'
                
            if (value === ""|| (value  && value.length> 0 && !$.fn.isNumeric(value))) {
        
              $(element).addClass('is-invalid')
              $('#' + buttonID).attr('disabled', 'disabled')

            } else {

              $(element).removeClass('is-invalid');
              $('#' + buttonID).removeAttr('disabled');
            }

          });
	  
					$(".form-control").on('keydown', function (e) {
					  
					  if (e.key === 'Enter' || e.keyCode === 13) {
						e.preventDefault();
						$('#service-submit-btn').click()
					  }
					});

          $('#service-submit-btn').on('submit click', (e) => {
            e.preventDefault();
            let name = $('#name').val();
            let description = $('#description').val();
            let currency = $('#currency').val();
            let price = $('#price').val();
            let period = $('#period').val();
            let availableFeatures = $('#available-features').val();
            let restrictedFeatures = $('#restricted-features').val();
            let serviceType = $('#service-type').val()
            let servicePage = $('#service-page').val()

            if (description.length == 0) {
              $('#service-description').addClass('is-invalid')
              $('#service-submit-btn').attr('disabled', 'disabled')
            }
            let isValid = $.fn.areFieldsValid('service-submit-btn', ['name', 'description']) && price.length > 0 && currency.length > 0 && availableFeatures.length > 0 && restrictedFeatures.length > 0
            if (isValid) {
                
              const formData = new FormData();
              formData.append("mode", titlePrefix.toLowerCase());
              if (titlePrefix.toLowerCase() == "edit") {
                formData.append('service_id', record.service_id)
              }
              availableFeatures = availableFeatures.split('\n').filter((feature)=>feature.length>0);
              restrictedFeatures = restrictedFeatures.split('\n').filter((feature)=>feature.length>0);
              formData.append("name", name);
              formData.append("description", description);
              formData.append("currency", currency);
              formData.append("price", price)
              formData.append("available_features", JSON.stringify(availableFeatures));
              formData.append("restricted_features", JSON.stringify(restrictedFeatures));
              formData.append("service_type", serviceType);
              formData.append("page", servicePage);
              formData.append("period", period)
              formData.append("acky", currentUser.acky);
              $.ajax({
                url: `cpanel/add/${objectType}`,
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                crossDomain: true,
                success: (result) => {
                  $.fn.showUpdatedTable(result, objectType)
                },
                error: (e) => {
                  $.fn.showAlert('Service Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                      
                    

                }
              })

            } else {
              $.fn.showAlert("Please correct the values in the highlighted fields", 'warning', '$.fn.closeDialog()')
                
                              
              if (!currency || currency && currency.length == 0) {
                $("#currency").addClass('is-invalid')
              }

              if (!price || price && price.length == 0) {
                $("#price").addClass('is-invalid')
              }

              if (!availableFeatures || availableFeatures && availableFeatures.length == 0) {
                $("#available-features").addClass('is-invalid')
              }
              if (!restrictedFeatures || restrictedFeatures && restrictedFeatures.length == 0) {
                $("#restricted-features").addClass('is-invalid')
              }
                
              $(`#${e.target.id}`).attr('disabled', 'disabled')

            }
              
                
          });

				},
				error: (e) => {
				  console.log(e)

				}
			})

}
$.fn.editEventType = (query = 'none') => {
  const objectType = 'eventtypes';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editEventType(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+mailtemplates+handlers?${objectType}=` + JSON.stringify(query)+`&mailtemplates={}&handlers={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,


    success: (results) => {

      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Event Type');

      let  handlers      =   Object.keys(results).includes('handlers') && results['handlers'].length >0 ? results['handlers']: [];
      
	    let  handlerOption =  handlers.map((handler) => {    
           let selected = "";    
        if (record && record.handler?.toString().toLowerCase() == handler) {
         
                  selected = `selected="selected"`
              }
              return `<option value="${handler}" ${selected}>${handler}</option>`
       });
       const mailTemplates       = Object.keys(results).includes('mailtemplates') && results['mailtemplates'].length > 0 ? results['mailtemplates'] : [];
     
        const templateOptions = mailTemplates ? mailTemplates.map((template) => {
            let selected   = "";               
            if (record && record?.template && record.template['$oid']  ==  template._id ) {
              selected = `selected="selected"`;
            }
            return `<option value="${template.template_id}" ${selected}>${template.name}</option>`

        }) : [];
		
		
  $('#contentwrapper-node').html(
    `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Event Type</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="type-id" class="col-sm-2 form-label">Type ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="type_id" id="type-id" value="${record?.type_id ? record.type_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="type-name" class="col-sm-2 form-label">Type Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="type-name" value="${record?.type_name ? record.type_name : ''}" placeholder="Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="type-description" class="col-sm-2 form-label">Description</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="type-description" name="type_description"  value="${record?.description ? record.description : ''}">
                </div>
                </div>
			        <div class="form-group row">
                    <label for="handler" class="col-sm-2 form-label">Event Handler</label>
                    <div class="col-sm-10">
                    <select class="form-control select2" name="handler" id="handler" style="width: 100%;">
                    ${handlerOption.join('')}
                    </select>
                    </div>
                    </div>
              		      <div class="form-group row">
                    <label for="mail-template" class="col-sm-2 form-label">Mail template</label>
                    <div class="col-sm-10">
                    <select class="form-control select2" name="mail_template" id="mail-template" style="width: 100%;">
                    <option value="-1">None</option>
                    ${templateOptions.join('')}
                    </select>
                    </div>
                    </div>
                <div class="form-group row">
                  <label for="type-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="type-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="type-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="type-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
       );

      
          $('#type-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('eventtypes');
            })

            $('.select2').select2();
            $('#type-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'type-submit-btn', ['type-name']) })
            //$('#type-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'type-submit-btn', ['type-name']) })
            $('#type-description').on('change', (e) => {
            let descr = $('#type-description').val().trim()
            let classList = $('#type-description').attr('class')

            if (descr.length > 0) {
              if (classList.indexOf('is-invalid') > -1) {
                $('#type-description').removeClass('is-invalid')
                $('#type-description').removeClass('is-valid')
                $('#type-submit-btn').removeAttr('disabled', 'disabled')
              }
            } else {
              $('#type-description').addClass('is-invalid')
              $('#type-submit-btn').attr('disabled', 'disabled')
            }

            })
      
            $(".form-control").on('keydown', function (e) {
              
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                $('#type-submit-btn').click()
              }
            });

            $('#type-submit-btn').on('submit click',(e) => { 
              e.preventDefault();
              let name = $('#type-name').val();
              let description = $('#type-description').val();  

              if (description.length == 0) {
                $('#type-description').addClass('is-invalid')
                $('#type-submit-btn').attr('disabled', 'disabled')
              }
              let handler = $('#handler').val();
              let templateId = $('#mail-template').val()
              
              let isValid = $.fn.areFieldsValid('type-submit-btn', ['type-name']) && description.length > 0

              if (isValid) {
                    

                const formData = new FormData();
                formData.append("mode", titlePrefix.toLowerCase());
                if (titlePrefix.toLowerCase() == "edit") {
                  formData.append('type_id', record.type_id)
                }

                formData.append("type_name", name);
                formData.append("description", description);
                formData.append("handler", handler);
                formData.append("template_id", templateId)
                formData.append("acky", currentUser.acky);

                $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                       $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Event Type Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                      
                      }
                })

                  } else { 
                      $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
                  }
                
                  
              })

        },
        error: (e) => {
          console.log(e)

        }
  })

}
$.fn.editSchedule = (query = 'none') => {
  const objectType = 'schedules';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editSchedule(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}?${objectType}=` + JSON.stringify(query)+`&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,


    success: (results) => {

	  let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
	  let titlePrefix = record ? 'Edit' : 'New';
	  let button = record ? 'Update' : 'Add';
	  $('.page-title').text(titlePrefix + ' Schedule');
		let scheduleName = record && record.name ? record.name : '';
		let scheduleDescription = record && record.description ? record.description : '';
		let startTime = record && record.startTime ? moment(new Date(record.startTime['$date'])).format('YYYY-MM-DD hh:mm:ss') : ''
		let repeat = record && record.repeat ? $.fn.getRepeatString(record.repeat) : 'No';
      $('#contentwrapper-node').html(`<div class="container-fluid"><div class="row">       
      <div class="card card-dark col-md-12 w-100">
      <div class="card-header">
        <h3 class="card-title">${titlePrefix} Schedule</h3>
      </div>
      <form class="form-horizontal">
        <div class="card-body">
          <div class="form-group row">
            <label for="imap-server-address" class="col-sm-2 col-form-label">Name</label>
            <div class="col-sm-10">
              <input type="text" class="form-control" name="schedule_name" id="schedule-name" placeholder="Name" value="${scheduleName}">
            </div>
          </div>
          <div class="form-group row">
          <label for="schedule-description" class="col-sm-2 col-form-label">Description</label>
          <div class="col-sm-10">
            <input type="text" name="schedule_description" id="schedule-description" class="form-control"  value="${scheduleDescription}" placeholder="Description">
          </div>
        </div>
          <div class="form-group row">
          <div class="col-md-2">  <label for="start-time">Start Time</label></div>
          <div class="col-md-10">   <div class="input-group date" data-target-input="nearest">
                  <input type="text"  name="start_time" id="start-time"  class="form-control datetimepicker-input" data-target="#start-time" value="${startTime}"/>
                  <div class="input-group-append" data-target="#start-time" data-toggle="datetimepicker">
                      <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                  </div>
                  </div>
              </div>
          </div>
        <div class="form-group row">
          <div class="col-md-2"><label>Repeat</label></div>
          <div class="col-md-10">
            <select  name="schedule_repeat" id="schedule-repeat" class="form-control select2" style="width: 100%;">
              <option selected="selected" value="none">No</option>
              <option value="hourly" >Hourly</option>
              <option value="daily" >Daily</option>
              <option value="weekly" >Weekly</option>
              <option value="bi-weekly" >Bi-weekly</option>
              <option value="monthly" >Monthly</option>
            <option value="quarterly" >Quarterly</option>
            <option value="twice-a-year" >Twice-a-year</option>
            <option value="yearly" >Yearly</option>
            <option value="custom" >Custom</option>
          </select>
        </div>
        </div>
        <div class="form-group row custom d-none">
        <div class="col-md-2">
            <label> Custom</label>
        </div>
          <div class="col-2"><label for="schedule-months">Months</label>
                    <select  name="schedule_months" id="schedule-months" class="form-control select2" style="width: 100%;">
                      <option selected="selected">0</option>
                    </select>
              </div>
              <div class="col-2"><label for="schedule-weeks">Weeks</label>
                    <select  name="schedule_weeks" id="schedule-weeks" class="form-control select2" style="width: 100%;">
                      <option selected="selected">0</option>
                    </select>
              </div>
              <div class="col-2"><label for="schedule-days">Days</label>
                    <select  name="schedule_days" id="schedule-days" class="form-control select2" style="width: 100%;">
                      <option selected="selected">0</option>
                    </select>
              </div>
          </div>
          <div class="form-group row custom d-none">
            <div class="col-md-2">
            </div>
            <div class="col-2"><label for="schedule-hours">Hours</label>
                    <select  name="schedule_hours" id="schedule-hours" class="form-control select2" style="width: 100%;">
                      <option selected="selected">0</option>
                    </select>
              </div>
                <div class="col-2"><label for="schedule-minutes">Minutes</label>
                      <select  name="schedule_minutes" id="schedule-minutes" class="form-control select2" style="width: 100%;">
                        <option selected="selected">0</option>
                      </select>
                </div>
                <div class="col-2"><label for="schedule-minutes">Seconds</label>
                      <select  name="schedule_seconds" id="schedule-seconds" class="form-control select2" style="width: 100%;">
                      <option selected="selected">0</option>
                      </select>
                </div>
          </div>
    <div class="form-group row">
    <div class="col-md-2"><label>Status</label></div>
    <div class="col-md-10"><select  name="schedule_status" id="schedule-status" class="form-control select2" style="width: 100%;">
    <option selected="selected" value="active">Active</option>
    <option value="disabled" >Disabled</option>
  </select>
  </div>
        </div>
        <div class="card-footer">
          <button type="cancel" class="btn btn-default float-left" id="schedule-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-info float-right" id="schedule-submit-btn">${button}</button>
        </div>
      </form>
    </div></div></div>`)

         

      if (record) {
    
        $('#start-time').datetimepicker({ "date": $.fn.getDateFromObject(moment(record.startTime['$date'])), format: 'DD/MM/YYYY HH:mm', icons: { time: 'far fa-clock' } })
        $("#schedule-repeat").val(repeat);
        $("#schedule-months").val(record.months);
        $("#schedule-weeks").val(record.weeks);
        $("#schedule-day").val(record.days);
        $("#schedule-hours").val(record.hours);
        $("#schedule-minutes").val(record.minutes);
        $("#schedule-seconds").val('value', record.seconds);
    
      } else { 

        
        $('#start-time').datetimepicker({format: 'DD/MM/YYYY HH:mm', icons: { time: 'far fa-clock' }  });
        

      }


  //$('#start-time').datetimepicker({ });
  $('#schedule-months').find('option').remove().end()
  for (let i = 0; i < 12; i++) {
    $('#schedule-months').append(`<option value="${i}">${i}</option>`);
  }
  $('#schedule-weeks').find('option').remove().end()
  for (let i = 0; i < 4; i++) {
    $('#schedule-weeks').append(`<option value="${i}">${i}</option>`);
  }
  $('#schedule-months').on('change', (e) => {
    $('#schedule-days').find('option').remove().end()
    let days = $.fn.getTotalDays(e.target.value)

    $('#schedule-days').find('option').remove().end()
    for (let i = 0; i < days; i++) {
      $('#schedule-days').append(`<option value="${i}">${i}</option>`);
    }

  });

  let days = $.fn.getTotalDays($('#schedule-months').val())
  $('#schedule-days').find('option').remove().end()
  for (let i = 0; i < days; i++) {
    $('#schedule-days').append(`<option value="${i}">${i}</option>`);
  }

  $('#schedule-weeks').change((e) => {
    $('#schedule-days').find('option').remove().end()
    let month = $('#schedule-months').val()
    let days = $.fn.getTotalDays(month)

    let daysLeft = days - parseInt(e.target.value) * 7
    for (let i = 0; i < daysLeft; i++) {
      $('#schedule-days').append(`<option value="${i}">${i}</option>`);
    }


  })
  let hours = 24
  $('#schedule-hours').find('option').remove().end()
  for (let i = 0; i < hours; i++) {
    $('#schedule-hours').append(`<option value="${i}">${i}</option>`);
  }

  let count = 60
  $(this).find('option').remove().end()
  for (let i = 0; i < count; i++) {
    $("#schedule-minutes,#schedule-seconds").append(`<option value="${i}">${i}</option>`);
  }

  $("#schedule-repeat").on('change', (e) => {
    let value = e.target.value;
    if (value === 'custom') {
      $('.custom').removeClass('d-none')
    } else {
      let classList = $('.custom').attr("class")
      if (classList.indexOf('d-none') < 0) {
        $('.custom').addClass('d-none')
      }

    }

  })

  $('#schedule-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'schedule-submit-btn', ['schedule-name', 'schedule-description']) })
  $('#schedule-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'schedule-submit-btn', ['schedule-name', 'schedule-description']) })

  $('#start-time').on('change', (e) => {
    // console.log('Start time changed')
    $.fn.isValidDate('#start-time', 'schedule-submit-btn', ['schedule-name', 'schedule-description']);
  })

      $('#schedule-cancel-btn').on('click', (e) => {
         e.preventDefault();
         $.fn.showTableRecords('schedules');
      })
  $('#schedule-submit-btn').on('click', (e) => {

    let scheduleName = $('#schedule-name').val()
    let scheduleDescription = $('#schedule-description').val()
    let startTime = $('#start-time').val()
    let status = $('#schedule-status').val()
    let scheduleRepeat = $('#schedule-repeat').val()

    let months = 0
    let weeks = 0
    let days = 0
    let hours = 0
    let minutes = 0
    let seconds = 0

    if (scheduleRepeat === 'custom') {

      months = $('#schedule-months').val();
      weeks = $('#schedule-weeks').val();
      days = $('#schedule-days').val();
      hours = $('#schedule-hours').val();
      minutes = $('#schedule-minutes').val();
      seconds = $('#schedule-seconds').val();
    }
    e.preventDefault();
    if (startTime.length > 0 && (Date.parse(startTime) - (new Date())) < 0) {
      $.fn.showAlert('Start time cannot be in the past unless you are The Flash', 'danger')
    } else if (scheduleName.length > 0 && scheduleDescription.length > 0 && startTime.length > 0) {


      const formData = new FormData();
      formData.append("mode", titlePrefix.toLowerCase());
      if (titlePrefix.toLowerCase() == "edit") {
        formData.append('schedule_id', record.schedule_id)
      }
      formData.append("schedule_name", scheduleName);
      formData.append("schedule_description", scheduleDescription);
      formData.append("startTime", startTime);
      formData.append("scheduleStatus", status);
      formData.append("schedule_repeat", scheduleRepeat);
      formData.append("months", months);
      formData.append("weeks", weeks);
      formData.append("days", days);
      formData.append("hours", hours);
      formData.append("minutes", minutes);
      formData.append("seconds", seconds);
      formData.append("acky", currentUser.acky);

       $.ajax({
                      url: `cpanel/add/${objectType}`,
                      type: "POST",
                      data: formData,
                      processData: false,
                      contentType: false,
                      crossDomain: true,
                      success: (result) => {
                       $.fn.showUpdatedTable(result, objectType)
                      },
                      error: (e) => {
                            $.fn.showAlert('Schedule Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                          
                       

                      }
        })

    } else {
      $.fn.isFieldValid('#schedule-name', 'schedule-submit-btn', ['schedule-name', 'schedule-description'])
      $.fn.isFieldValid('#schedule-description', 'schedule-submit-btn', ['schedule-name', 'schedule-description'])
      $.fn.isValidDate('#start-time', 'schedule-submit-btn', ['schedule-name', 'schedule-description']);
    }

  })


	}
	
	
  })
  
}
$.fn.editEventTrigger = (query = 'none') => {
  const objectType = 'eventtriggers';
  $.fn.highlightSidebar(objectType)
  DisplayManager.lastRunFunction = `$.fn.editEventTrigger(${query == 'none' ? `'none'` : JSON.stringify(query)})`;
  DisplayManager.lastObjectType = objectType;
  $.ajax({
    url: `/cpanel/data/${objectType}+schedules+eventtypes?${objectType}=` + JSON.stringify(query)+`&schedules={}&eventtypes={}&acky=${currentUser.acky}`,
    type: "GET",
    processData: false,
    contentType: false,
    crossDomain: true,

    success: (results) => {

      let record = Object.keys(results).includes(objectType) && results[objectType].length == 1 ? results[objectType][0] : null;
      let titlePrefix = record ? 'Edit' : 'New';
      let button = record ? 'Update' : 'Add';
      $('.page-title').text(titlePrefix + ' Event Trigger');

        const schedules       = Object.keys(results).includes('schedules') && results['schedules'].length > 0 ? results['schedules'] : [];
        const scheduleOptions = schedules ? schedules.map((schedule) => {
            let selected   = "";               
            if (record && record?.schedule && record.schedule['$oid']  ==  schedule._id ) {
              selected = `selected="selected"`;
            }
            return `<option value="${schedule.schedule_id}" ${selected}>${schedule.name}</option>`

        }) : [];
        const   eventTypes   = Object.keys(results).includes('eventtypes') && results['eventtypes'].length > 0 ? results['eventtypes'] : [];
        const   eventTypeOptions = eventTypes ? eventTypes.map((eventType) => {
              let selected   = "";               
              if (record && record?.event_type  && record.event_type['$oid']  ==  eventType._id ) {
                selected = `selected="selected"`;
              }
              return `<option value="${eventType.type_id}" ${selected}>${eventType.type_name}</option>`

          }) : [];

          let  history  = record?.trigger_history? record.trigger_history:[]
          let tableBody = []
      if (Object.keys(history).length > 0) {

        tableBody = Object.keys(history).map((key, index) => {
          return `
          <tr>
          <td>${key}</td>
          <td onclick="$.fn.viewEvent(${history[key]})">${history[key]} </td>
          </tr>`
        });


      } else { 
         tableBody = [`<tr><td>No Events</td><td>0</td></tr>`]

      }

      let historyTable = `<table class="col-sm-10" id="history-table">
            	<thead>
                  <tr> 
                      <th class="col-sm-4" >Triggered Time</th>
                      <th class="col-sm-2">Event ID</th>
                  </tr>
               </thead>
							 <tbody>${tableBody.join('')}</tbody>
						</table>`;

       let parameters =  record?.parameters? record.parameters:[]

      $('#contentwrapper-node').html(
              `<div class="container-fluid"><div class="row">       
              <div class="card card-dark col-md-12 w-100">
              <div class="card-header">
              <h3 class="card-title">${titlePrefix} Event Trigger</h3>
              </div>
              <form class="form-horizontal">
              <div class="card-body">
              <div class="form-group row">
                <label for="trigger-id" class="col-sm-2 form-label">Trigger ID</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="trigger_id" id="trigger-id" value="${record?.trigger_id ? record.trigger_id : ''}" placeholder="ID" disabled>
                </div>
              </div>
              <div class="form-group row">
                <label for="trigger-name" class="col-sm-2 form-label">Trigger Name</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="name" id="trigger-name" value="${record?.trigger_name ? record.trigger_name : ''}" placeholder="Name">
                </div>
              </div>
                <div class="form-group row">
                <label for="trigger-description" class="col-sm-2 form-label">Description</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="trigger-description" name="trigger_description"  value="${record?.description ? record.description : ''}">
                </div>
                </div>
                				        <div class="form-group row">
                    <label for="event-type" class="col-sm-2 form-label">Event Type</label>
                    <div class="col-sm-10">
                    <select class="form-control select2" name="event_type" id="event-type" style="width: 100%;">
                    ${eventTypeOptions.join('')}
                    </select>
                    </div>
                    </div>
                    <div class="form-group row">
                        <label for="parameters" class="col-sm-2 col-form-label">Parameters</label>
                        <div class="col-sm-10">
                            ${$.fn.getObjectMapperOld('parameters', 'Name', 'Value',parameters )}
                        </div>
                    </div>		
				          <div class="form-group row">
                    <label for="schedule" class="col-sm-2 form-label">Schedule</label>
                    <div class="col-sm-10">
                    <select class="form-control select2" name="schedule" id="schedule" style="width: 100%;">
                    ${scheduleOptions.join('')}
                    </select>
                    </div>
                    </div>
                    <div class="form-group row">
                <label for="trigger-count" class="col-sm-2 form-label">Trigger Count</label>
                <div class="col-sm-10">
                <input type="text"   class="form-control"  id="trigger-count" name="trigger_count"  value="${record?.trigger_count ? record.trigger_count : ''}" disabled>
                </div>
                </div>
                 <div class="form-group row">
                         <label for="history-table" class="col-sm-2 form-label">Trigger History</label>
                        <div class="col-sm-10">
                          ${historyTable}
                        </div>
                    </div>
	
                <div class="form-group row">
                  <label for="trigger-id" class="col-sm-2 form-label">Date of Creation</label>
                  <div class="col-sm-10">
                    <input type="text" class="form-control" name="created_datetime" id="created-datetime" value="${record?.created_datetime ? $.fn.displayDate(record, 'created_datetime') : ''}" placeholder="" disabled>
                  </div>
                </div>
                    <div class="form-group row">
                <label for="trigger-id" class="col-sm-2 form-label">Last Modified</label>
                <div class="col-sm-10">
                <input type="text" class="form-control" name="last_modified_date" id="last-modified-date" value="${record?.last_modified_date ? $.fn.displayDate(record, 'last_modified_date') : ''}" placeholder="" disabled>
                </div>
              </div>
              
                </div>
                <div class="card-footer">
                <button type="cancel" class="btn btn-default float-left" id="trigger-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-info float-right" id="trigger-submit-btn">${button}</button>
                </div>
              </form>
              </div></div></div>`
      )
      if ($('#history-table')) {
             $('#history-table').dataTable();
            }
           
          $('#trigger-cancel-btn').on('click', (e) => {
                e.preventDefault();
                $.fn.showTableRecords('eventtriggers');
            })

            $('.select2').select2();
            $('#trigger-name').on('change', (e) => { $.fn.isFieldValid(e.target, 'trigger-submit-btn', ['trigger-name']) })
            //$('#trigger-description').on('change', (e) => { $.fn.isFieldValid(e.target, 'trigger-submit-btn', ['trigger-name']) })
            $('#trigger-description').on('change', (e) => {
            let descr = $('#trigger-description').val().trim()
            let classList = $('#trigger-description').attr('class')

            if (descr.length > 0) {
              if (classList.indexOf('is-invalid') > -1) {
                $('#trigger-description').removeClass('is-invalid')
                $('#trigger-description').removeClass('is-valid')
                $('#trigger-submit-btn').removeAttr('disabled', 'disabled')
              }
            } else {
              $('#trigger-description').addClass('is-invalid')
              $('#trigger-submit-btn').attr('disabled', 'disabled')
            }

            })
      
            $(".form-control").on('keydown', function (e) {
              
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                $('#trigger-submit-btn').click()
              }
            });

            $('#trigger-submit-btn').on('submit click',(e) => { 
                  e.preventDefault();
                  let name = $('#trigger-name').val();
                  let description = $('#trigger-description').val();  
                  let eventType = $("#event-type").val();
                  let schedule = $("#schedule").val();
              let parameters = JSON.stringify($.fn.getObjectFromMapper('parameters'))

                  if (description.length == 0) {
                    $('#trigger-description').addClass('is-invalid')
                    $('#trigger-submit-btn').attr('disabled', 'disabled')
                  }
                  let isValid = $.fn.areFieldsValid('trigger-submit-btn', ['trigger-name']) && description.length > 0

                  if (isValid) {
                        

                    const formData = new FormData();
                    formData.append("mode", titlePrefix.toLowerCase());
                    if (titlePrefix.toLowerCase() == "edit") {
                      formData.append('trigger_id', record.trigger_id)
                    }
                  
                  
                    formData.append("trigger_name", name);
                    formData.append("description", description);
                    formData.append("event_type", eventType)
                    formData.append("schedule", schedule);
                    formData.append("parameters", parameters);
                    formData.append("acky", currentUser.acky);
                    $.ajax({
                          url: `cpanel/add/${objectType}`,
                          type: "POST",
                          data: formData,
                          processData: false,
                          contentType: false,
                          crossDomain: true,
                          success: (result) => {
                          $.fn.showUpdatedTable(result, objectType)
                          },
                          error: (e) => {
                                $.fn.showAlert('Event Trigger Creation Failed', 'danger', () => { $.fn.showTableRecords(objectType) })
                              
                          

                          }
                    })

                      } else { 
                          $.fn.showAlert("Please correct the values in the highlighted fields",'warning', '$.fn.closeDialog()' )
                      }
                    
                      
                  })

        },
        error: (e) => {
          console.log(e)

        }
  })

}


/**
 * =====================================================================================================================
 * 
 * This section is for function that load initial pages
 * 
 * =======================================================================================================================
 */

$.fn.updateDashboard = (mode) => {

  let startDate = $('#report-range-start').val().split(' ')[0]
  let endDate = $('#report-range-end').val().split(' ')[0]
  let domain = $('#wblester-domain').val()
  let transDomain = domain === "all" ? "." : domain;

  if (dashWorker) {
    // console.log(`syncMode: ${syncMode}`);
    // console.log(`startDate: ${startDate}`)
    // console.log(`endDate: ${endDate}`)
    // console.log(`transDomain: ${transDomain}`)
    dashWorker.postMessage([window.config, syncMode, startDate, endDate, transDomain]);
    dashWorker.onmessage = (event) => {
      if ($.fn.checkForUpdates(window.dashboardData, event.data)) {
        $.fn.prepareChartInfo(event.data);
        window.dashboardData, event.data
      }

    }

  } else {
    if (syncMode === 'ONLINE') {
      $.fn.onlineDataFetch(startDate, endDate, transDomain, mode);
    } else if (syncMode === 'LOCAL') {
      $.fn.localDataFetch(startDate, endDate, transDomain, mode);
    }
  }

  ;


}

$.fn.loadDashboard= () => {
        let  sNavItems        = {...window.defaultComponents.sidebar.sidebarNav.sidebarNavItems,sidebarNavItemList:[
         {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": "fas fa-cog nav-icon",
              "text": "Dashboard",
              "spanClass": "",
              "spanText": "",
              "position": 0
              , "actions": { "event": "onClick", "functionName": " $.fn.updateDashboard(1)", "parameters": {} }
              
        }, {
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
          "itemIconClass": "fas fa-user-secret nav-icon",
       "text": "Client Services",
       "spanClass": "",
       "spanText": "",
       "position": 1
          , "actions": { "event": "onClick", "functionName": "$.fn.showClientServices()", "parameters": {} }
        ,"subNavItemList": [ {
                      "href": "#",
          "itemIconClass": "fa fa-plus nav-icon",
          "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editClientService()", "parameters":{}}
                      }
                      ]
        },, {
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
          "itemIconClass": "fas fa-user-secret nav-icon",
       "text": "Client Status",
       "spanClass": "",
       "spanText": "",
       "position": 2
          , "actions": { "event": "onClick", "functionName": "$.fn.showClientStatus()", "parameters": {} }
        ,"subNavItemList": [ {
                      "href": "#",
          "itemIconClass": "fa fa-plus nav-icon",
          "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editClientStatus()", "parameters":{}}
                      }
                      ]
        },	      {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": "fas fa-users nav-icon",
              "text": "Messages",
              "spanClass": "",
              "spanText": "",
              "position": 3
              , "actions": { "event": "onClick", "functionName": "$.fn.showMessages()", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.updateMessage()", "parameters":{}}
                      }
                      ]
        }, {
                  "itemClass":"nav-item",   
                  "href": "#",
                  "navLinkClass":"nav-link",
          "itemIconClass": "fa fa-space-shuttle nav-icon",
                  "text": "FAQs",
                  "spanClass": "",
                  "spanText": "",
                   "position": 4
                    , "actions": { "event": "onClick", "functionName": "$.fn.showFAQs()", "parameters": {} }
                   ,"subNavItemList": [ {
                      "href": "#",
                     "itemIconClass": "fa fa-plus nav-icon",
                     "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editFAQs()", "parameters":{}}
                      }
                      ]
        }

  ]
  };
       const sidebarNav = { ...window.defaultComponents.sidebar.sidebarNav, sidebarNavItems: sNavItems }
    
    if (!DisplayManager.pageUpdateHistory.has('dashboard')) {
      let sidebarLogo = { ...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo }
      DisplayManager.addComponentDisplay(Preloader, { ...window.defaultComponents.preloader, image: window.appConfig.login_image });
      DisplayManager.addComponentDisplay(Navbar, window.defaultComponents.navbar);
      DisplayManager.addComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav,sidebarLogo: sidebarLogo });
      DisplayManager.addComponentDisplay(ContentHeader, window.defaultComponents.contentHeader);
      DisplayManager.addComponentDisplay(Footer, {});
      DisplayManager.display('dashboard');

  } else {
    let sidebarLogo = {...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo  }
    DisplayManager.addComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav,sidebarLogo:sidebarLogo });
    DisplayManager.updateComponentDisplay(ContentHeader, window.defaultComponents.contentHeader);

  }
  clearInterval(window.dashboardUpdateID);
  $.fn.updateDashboard(1);
DisplayManager.currentTab ='Dashboard'
    db.loadDatabase({}, function (result) { 
    $.fn.databaseInitialize();
    if(!syncWorker ){
      $.fn.localSync() 
      }
      $.fn.highlightNavHeader(DisplayManager.currentTab);   
  });

     
}

$.fn.loadComponents=()=>{
  DisplayManager.lastRunFunction = `$.fn.loadComponents()`;
  DisplayManager.lastObjectType = "*"

      let  sNavItems        = {...window.defaultComponents.sidebar.sidebarNav.sidebarNavItems,sidebarNavItemList:[
         {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('images')} nav-icon`,
              "text": "Images",
              "spanClass": "",
              "spanText": "",
              "position": 0
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('images')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editImage()", "parameters":{}}
                      }
                      ]
        },  {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('files')} nav-icon`,
              "text": "Files",
              "spanClass": "",
              "spanText": "",
              "position": 1
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('files')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editFile()", "parameters":{}}
                      }
                      ]
        }, {
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
          "itemIconClass": `${$.fn.getObjectIcon('banners')} nav-icon`,
       "text": "Banners",
       "spanClass": "",
       "spanText": "",
       "position": 2
          , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('banners')", "parameters": {} }
        ,"subNavItemList": [ {
                      "href": "#",
          "itemIconClass": "fa fa-plus nav-icon",
          "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editBanner()", "parameters":{}}
                      }
                      ]
        },   {
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
          "itemIconClass": `${$.fn.getObjectIcon('sliders')} nav-icon`,
       "text": "Sliders",
       "spanClass": "",
       "spanText": "",
       "position": 3
          , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('sliders')", "parameters": {} }
        ,"subNavItemList": [ {
                      "href": "#",
          "itemIconClass": "fa fa-plus nav-icon",
          "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editSlider()", "parameters":{}}
                      }
                      ]
        }, {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('pagetemplates')} nav-icon`,
              "text": "Page Templates",
              "spanClass": "",
              "spanText": "",
              "position": 4
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('pagetemplates')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editTemplate()", "parameters":{}}
                      }
                      ]
        },     {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('pages')} nav-icon`,
              "text": "Pages",
              "spanClass": "",
              "spanText": "",
              "position": 5
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('pages')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editPage()", "parameters":{}}
                      }
                      ]
        }

				]};
      const sidebarNav = { ...window.defaultComponents.sidebar.sidebarNav, sidebarNavItems: sNavItems }
 // console.log(DisplayManager.pageUpdateHistory)
  //console.log( DisplayManager.pageUpdateHistory.size )
  if (!DisplayManager.pageUpdateHistory.has('Components') && DisplayManager.pageUpdateHistory.size == 0) {
    let sidebarLogo = { ...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo }
    DisplayManager.addComponentDisplay(Preloader, { ...window.defaultComponents.preloader, image: window.appConfig.login_image });
    DisplayManager.addComponentDisplay(Navbar, window.defaultComponents.navbar);
    DisplayManager.addComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav, sidebarLogo:sidebarLogo});
    let resultsTable = DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.createGroupCode()">Banners</a>`, "statsIcon": "fa fa-users", "tableData":  $.fn.getTableRecords('banners'), "id": "users", "statsClass": "secondary" });
    //let tableHtml = `<div class="container-fluid"><div class="row">${resultsTable}</div>`;
    let setupContentWrapper = { ...window.defaultComponents.contentHeader.contentWrapper, contentRows: [{ "htmlText": resultsTable }], dashboardReportRange: {} }
    DisplayManager.addComponentDisplay(ContentHeader, { ...window.defaultComponents.contentHeader, parentPage: "Components", pageTitle: "Banners", contentWrapper: setupContentWrapper });
    DisplayManager.addComponentDisplay(Footer, {});
    DisplayManager.display('configurations');

  } else { 
     let sidebarLogo = { ...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo }
    DisplayManager.updateComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav ,sidebarLogo:sidebarLogo });
    let setupContentWrapper = { ...window.defaultComponents.contentHeader.contentWrapper, contentRows: [{ "htmlText": '' }], dashboardReportRange: {} }
    DisplayManager.updateComponentDisplay(ContentHeader, { ...window.defaultComponents.contentHeader, parentPage: "Components", pageTitle: "Banners", contentWrapper: setupContentWrapper });
    
  }
     DisplayManager.currentTab = 'Components'
  
      
  db.loadDatabase({}, function (result) { 
    $.fn.databaseInitialize();
      $.fn.showImages();
    if(!syncWorker ){
      $.fn.localSync() 
    }
     $.fn.highlightNavHeader(DisplayManager.currentTab);  
  });
 
    
}

$.fn.loadConfigurations=()=>{
  DisplayManager.lastRunFunction = `$.fn.loadConfigurations()`;
  DisplayManager.lastObjectType = "*"
 //https://www.w3schools.com/icons/icons_reference.asp
  $('.page-title').text("Site Settings");
      let  sNavItems        = {...window.defaultComponents.sidebar.sidebarNav.sidebarNavItems,sidebarNavItemList:[
         {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('sitesettings')} nav-icon`,
              "text": "Settings",
              "spanClass": "",
              "spanText": "",
              "position": 0
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('sitesettings')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Edit"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editSettings({'settings_id':1})", "parameters":{}}
                      }
                      ]
        }, {
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
          "itemIconClass": `${$.fn.getObjectIcon('roles')} nav-icon`,
       "text": "Roles",
       "spanClass": "",
       "spanText": "",
       "position": 1
          , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('roles')", "parameters": {} }
        ,"subNavItemList": [ {
                      "href": "#",
          "itemIconClass": "fa fa-plus nav-icon",
          "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editRole()", "parameters":{}}
                      }
                      ]
        },	      {
               "itemClass":"nav-item",   
              "href": "#",
              "navLinkClass":"nav-link",
              "itemIconClass": `${$.fn.getObjectIcon('users')} nav-icon`,
              "text": "Users",
              "spanClass": "",
              "spanText": "",
              "position": 2
              , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('users')", "parameters": {} }
              ,"subNavItemList": [ {
                      "href": "#",
                "itemIconClass": "fa fa-plus nav-icon",
                "text": "Add"
                      ,"actions":{"event":"onClick", "functionName":"$.fn.editUser()", "parameters":{}}
                      }
                      ]
        },{
        "itemClass":"nav-item",   
       "href": "#",
       "navLinkClass":"nav-link",
       "itemIconClass": "nav-icon fas fa-mail-bulk",
       "text": "Email Accounts",
       "spanClass": "",
       "spanText": "",
       "position": 3
       ,"actions":{"event":"onClick", "functionName":"$.fn.showTableRecords('mailaccounts')", "parameters":{}}
      , "subNavItemList": [{
         "id": "edit-mail-nav-id",
                            "href": "#",
                            "itemIconClass": "fas fa-envelope-open nav-icon",
                            "text": "New Email Account"
                            ,"actions":{"event":"onClick", "functionName":"$.fn.editMailBox()", "parameters":{}}
      }, {
                           "id": "edit-gmail-nav-id",
                          "href": "#",
                          "itemIconClass": "fas fa-envelope-open-text nav-icon",
                          "text": "New Gmail Account"
                          ,"actions":{"event":"onClick", "functionName":"$.fn.editGmailBox()", "parameters":{}}
                      }

                    ]
       
      },{
        "itemClass": "nav-item",
        "href": "#",
        "navLinkClass": "nav-link",
        "itemIconClass": "fas fa-bolt",
        "text": "Mail Templates",
        "spanClass": "",
        "spanText": "",
        "position": 4
        , "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('mailtemplates')", "parameters": {} }
        , "subNavItemList": [{
          "href": "#",
          "itemIconClass": "fas fa-chevron-right  nav-icon",
          "text": "New Template"
          , "actions": { "event": "onClick", "functionName": "$.fn.editMailTemplate()", "parameters": {} }
        }
      ]
    },{ "itemClass":"nav-item",   
		  "href": "#",
		  "navLinkClass":"nav-link",
	"itemIconClass": "fa fa-graduation-cap nav-icon",
		  "text": "Event Types",
		  "spanClass": "",
		  "spanText": "",
		   "position": 5
			, "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('eventtypes')", "parameters": {} }
		   ,"subNavItemList": [ {
			  "href": "#",
			 "itemIconClass": "fa fa-chevron-right  nav-icon",
			 "text": "Add"
			  ,"actions":{"event":"onClick", "functionName":"$.fn.editEventType()", "parameters":{}}
			  }
			  ]
	}	, {
		  "itemClass":"nav-item",   
		  "href": "#",
		  "navLinkClass":"nav-link",
	"itemIconClass": "fa fa-graduation-cap nav-icon",
		  "text": "Events",
		  "spanClass": "",
		  "spanText": "",
		   "position": 6
			, "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('events')", "parameters": {} }
	}	, {
		  "itemClass":"nav-item",   
		  "href": "#",
		  "navLinkClass":"nav-link",
	"itemIconClass": "fa fa-graduation-cap nav-icon",
		  "text": "Schedules",
		  "spanClass": "",
		  "spanText": "",
		   "position": 7
			, "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('schedules')", "parameters": {} }
		   ,"subNavItemList": [ {
			  "href": "#",
			 "itemIconClass": "fa fa-chevron-right  nav-icon",
			 "text": "Add"
			  ,"actions":{"event":"onClick", "functionName":"$.fn.editSchedule()", "parameters":{}}
			  }
			  ]
	}, {
		  "itemClass":"nav-item",   
		  "href": "#",
		  "navLinkClass":"nav-link",
	"itemIconClass": "fa fa-graduation-cap nav-icon",
		  "text": "Event Triggers",
		  "spanClass": "",
		  "spanText": "",
		   "position": 8
			, "actions": { "event": "onClick", "functionName": "$.fn.showTableRecords('eventtriggers')", "parameters": {} }
		   ,"subNavItemList": [ {
			  "href": "#",
			 "itemIconClass": "fa fa-chevron-right  nav-icon",
			 "text": "Add"
			  ,"actions":{"event":"onClick", "functionName":"$.fn.editEventTrigger()", "parameters":{}}
			  }
			  ]
	}
		        , {
          "itemClass": "nav-item",
          "href": "#",
          "navLinkClass": "nav-link",
          "itemIconClass": "fas fa-bolt",
          "text": "Jobs",
          "spanClass": "",
          "spanText": "",
          "position": 9
          , "actions": { "event": "onClick", "functionName": "$.fn.showJobs()", "parameters": {} }
        },{
      "itemClass": "nav-item",
      "href": "#",
      "navLinkClass": "nav-link",
      "itemIconClass": `${$.fn.getObjectIcon('audittrail')} nav-icon`,
      "text": "Audit Trail",
      "spanClass": "",
      "spanText": "",
      "position": 10
      , "actions": { "event": "onClick", "functionName": "$.fn.showAuditTrail()", "parameters": {} }
        }

				]};
      const sidebarNav = { ...window.defaultComponents.sidebar.sidebarNav, sidebarNavItems: sNavItems }
  
  if (!DisplayManager.pageUpdateHistory.has('configurations')) {
    let sidebarLogo = { ...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo }
    DisplayManager.addComponentDisplay(Preloader, { ...window.defaultComponents.preloader, image: window.appConfig.site_logo });
    DisplayManager.addComponentDisplay(Navbar, window.defaultComponents.navbar);
    DisplayManager.addComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav, sidebarLogo:sidebarLogo});
    let adminUserTable = ''; //DashboardTable({ "statsTitle": `<a href="#" onclick="$.fn.editUser()">Administrative Users</a>`, "statsIcon": "fa fa-users", "tableData":  $.fn.getTableRecords('admin'), "id": "users", "statsClass": "secondary" });
    //let tableHtml = `<div class="container-fluid"><div class="row">${adminUserTable}</div>`;
    let setupContentWrapper = { ...window.defaultComponents.contentHeader.contentWrapper, contentRows: [{ "htmlText": adminUserTable }], dashboardReportRange: {} }
    DisplayManager.addComponentDisplay(ContentHeader, { ...window.defaultComponents.contentHeader, parentPage: "Configurations", pageTitle: "Administrators", contentWrapper: setupContentWrapper });
    DisplayManager.addComponentDisplay(Footer, {});
    
    DisplayManager.display('configurations');

  } else { 

        let sidebarLogo = { ...window.defaultComponents.sidebar.sidebarLogo, image: window.appConfig.site_logo }
        DisplayManager.addComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav,sidebarLogo:sidebarLogo });
        DisplayManager.updateComponentDisplay(Sidebar, { ...window.defaultComponents.sidebar, sidebarNav: sidebarNav, sidebarLogo:sidebarLogo});
        let setupContentWrapper = { ...window.defaultComponents.contentHeader.contentWrapper, contentRows: [{ "htmlText": '' }], dashboardReportRange: {} }
        DisplayManager.updateComponentDisplay(ContentHeader, { ...window.defaultComponents.contentHeader, parentPage: "Configurations", pageTitle: "Administrators", contentWrapper: setupContentWrapper });

  }
     DisplayManager.currentTab = 'Configurations'
   

  db.loadDatabase({}, function (result) { 
    $.fn.databaseInitialize();
    $.fn.showSettings();
       
    if (!syncWorker) {
 
      $.fn.localSync() 
    }
      $.fn.highlightNavHeader(DisplayManager.currentTab); 
  });
  
  
      
  //}
}


$.fn.checkUserAccess = () => { 
 
   return currentUser? currentUserRoleID: 0
}


$.fn.removeRecord = (deleteInfo) => {
  /**
   * Generic function for removing records from components
   * 
   */

    let objectType = deleteInfo.split(',')[0]
    let recordID = deleteInfo.split(',')[1];
    const formData = new FormData();
    formData.append("id", recordID);
    formData.append("acky", currentUser.acky);
    $.ajax({
      url: `cpanel/delete/${objectType}?acky=${currentUser.acky}`,
      type: "POST",
      data:formData,
      processData: false,
      contentType: false,
      crossDomain: true,
      success: (results) => {

        $.fn.syncLokiCollection($.fn.capitalize(objectType), () => { $.fn.showTableRecords(objectType) }) 

      }
      , error: (err) => {

        $.fn.showAlert(`Error deleting record ${recordID} of  ${objectType}`, 'danger','$.fn.closeDialog()')
      }


    });
}


$.fn.localSync = () => { 
    /**
    *  Syncs LokiDatabase with online database
    **/

    if (window.Worker) {
  
      syncWorker = new Worker("/static/cpanel/dist/custom/js/workers/worker.js");
      let tableData ={}
      Object.keys(window.tableMap).forEach((table)=> tableData[table] =window.tableMap[table].data)
      syncWorker.postMessage(['start', window.config,tableData,currentUser.acky]);
      syncWorker.onmessage = (e) => {
        let isUpdated = e?.data?.count > 0;
        let updatedCollections = e?.data?.collections;
        let deletedRecords = e?.data?.deleted;
        let updatedRecords = e?.data?.records;
        let isActiveSession = e?.data?.session;
        let dataPass = e?.data.dataPass
       // console.log(e.data)
        //console.log("session: ", isActiveSession)
        //console.log("dataPass: ", dataPass)
        if (!isActiveSession && dataPass ==currentUser.acky) { 
          window.location = 'auth/logout';
        }


        if (deletedRecords && Object.keys(deletedRecords).length > 0) { 
          Object.keys(deletedRecords).forEach((table) => { 
            let removedList = deletedRecords[table];
            let idField            = window.config.syncInfo.cpanel.filter((tableName) => tableName.collectionName == table)[0]['idField']
              let query = {}
            query[idField] = { "$in": removedList };
              window.tableMap[table].chain().find(query).remove();         
          })


          
        }

        //console.log("updated: " + isUpdated)
        if (isUpdated) {


          if (updatedCollections){
            Object.keys(updatedRecords).forEach((collection) => {
            // console.log(collection)
              let idField = window.config.syncInfo.cpanel.filter((x) => { return x.collectionName.toLowerCase() == collection.toLowerCase() })[0]['idField']
              //  console.log(updatedRecords[collection])
              updatedRecords[collection].forEach((record) => {

                let tempQuery = {}
                tempQuery[idField] = record[idField];
                let filteredRecord = null;
                filteredRecord = Object.keys(window.tableMap).includes(collection) && window.tableMap[collection].data.length > 0 ? window.tableMap[collection].find(tempQuery) : null;
                
                if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                // console.log(`filtered record`)
                // console.log(filteredRecord)
                  let tempRecord = { ...filteredRecord[0] }
                  Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                                    
                    tempRecord[field] = record[field];
                                    
                  })
                  try {
                    window.tableMap[collection].update(tempRecord)
                  } catch (e) {
                   console.log(e)   
                  }
                } else {

                  try {

                    let tempRecord = {  }
                    Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                      tempRecord[field] = record[field]
                    })
                    
                    window.tableMap[collection].insert(tempRecord);
                      
                  } catch (e) {
                  
                    filteredRecord = Object.keys(window.tableMap).includes(collection) && window.tableMap[collection].data.length > 0 ? window.tableMap[collection].find(tempQuery) : null;
                          
                    if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                      let tempRecord = { ...filteredRecord[0] }
                      Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                        tempRecord[field] = record[field]
                      })
                      window.tableMap[collection].update(tempRecord);
                                
                    } else {
                      let tempRecord = {}
                      Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                        tempRecord[field] = record[field]
                      })

                      window.tableMap[collection].insert(tempRecord);
                    }
                  }


                }
              })
          //    


            })
            db.saveDatabase((data) => {

              if (DisplayManager.lastRunFunction && DisplayManager.lastRunFunction.trim() != "" && DisplayManager.lastRunFunction.trim() != "none") {
                //console.log(`Executing: '${DisplayManager.lastRunFunction}'`)
                eval(DisplayManager.lastRunFunction);
              }


            });

          }

        }
      }
    } else {
      startSync();
      syncWorker = true
    }
}


$("#index-root").ready((e) => { 
    DisplayManager.setCurrentPageID("index-root");
    // console.log(JSON.stringify(currentUser))
    if (currentUserRoleID == 1) {
      $.fn.loadConfigurations();
    } else if (currentUserRoleID == 2 ) { 
      $.fn.loadComponents()
    }

})

