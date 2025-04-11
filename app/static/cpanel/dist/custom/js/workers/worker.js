importScripts("/static/cpanel/dist/custom/js/data/lokijs.js");
importScripts("/static/cpanel/dist/custom/js/data/LokiIndexedAdapter.js");

const LT        =  "$lt";
const GT        =  "$gt";
const LTE       =  "$lte";
const GTE       =  "$gte";
const EQ        =  "$eq";
const NE        =  "$ne";
const EXISTS    =  "$exists";
const TYPE      =  "$type";
const IN        =  "$in";
const AND       =  "$and";
const NIN       =  "$nin";
const ALL       =  "$all";
const SIZE      =  "$size";
const OR        =  "$or";
const NOR       =  "$nor";
const NOT       =  "$not";
const MOD       =  "$mod";
const REGEX     =  "$regex";
const ELEMMATCH =  "$elemMatch";

let db;
let  config = {}
const tableMap   = {}
let tableData = {}
let acky    = ""
class SelectElement{

  static  field;
  static  value;
  static  operator;

  constructor(field,operator, value){

    this.field     = field? field:null;
    this.operator  = operator?operator: null;
    this.value     = value?value:null

  }


}
 class Selector{

    selector = {};

    static get LT(){
        return LT;
    }
    static get GT(){
        return GT;
    }

    static get LTE(){
        return LTE;
    }

    static get GTE(){
        return GTE;
    }

    static get EQ(){
        return EQ;
    }

    static get NE(){
        return NE;
    }

    static get EXISTS(){
        return EXISTS;
    }

    static get TYPE(){
        return TYPE;
    }

    static get IN(){
        return IN;
    }

    static get AND(){
        return AND;
    }

    static get NIN(){
        return NIN;
    }

    static get ALL(){
        return ALL;
    }

    static get SIZE(){
        return SIZE;
    }

    static get OR(){
        return OR;
    }

    static get NOR(){
        return NOR;
    }

    static get NOT(){
        return NOT;
    }
    static get MOD(){
        return MOD;
    }

    static get REGEX(){
        return REGEX;
    }

    static get ELEMMATCH(){
        return ELEMMATCH;
    }

    lt(field, value){
		let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.LT] = value;
		return temp;
    }
   gt(field, value){
       	let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.GT] = value;
		return temp;
    }

   lte(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.LTE] = value;
		return temp;
    }

   gte(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.GTE] = value;
		return temp;
    }

   eq(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.EQ] = value;
		return temp;
    }

   ne(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NE] = value;
		return temp;
    }

   exists(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.EXISTS] = value;
		return temp;
    }

   type(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.TYPE] = value;
		return temp;
    }

   _in(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.IN] = value;
		return temp;
    }

   and(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.AND] = value;
		return temp;
    }

   nin(field, value){
		let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NIN] = value;
		return temp;
    }

   all(field, value){
        let  temp  				 = {}
        temp[field] 			 = {}
        temp[field][Selector.ALL] = value;
        return temp;
    }

   size(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.SIZE] = value;
		return temp;
    }

   or(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.OR] = value;
		return temp;
    }

   nor(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NOR] = value;
		return temp;
    }

   not(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NOT] = value;
		return temp;
    }
   mod(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.MOD] = value;
		return temp;
    }

   regex(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.REGEX] = value;
		return temp;
    }

   elemMatch(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.ELEMMATCH] = value;
		return temp;
    }

    constructor(searchFilters){
        
        if(searchFilters){ 
        if(!Array.isArray(searchFilters) ){
            let tempArray = [];
            tempArray.push(searchFilters)
            searchFilters = tempArray

        }
        
        searchFilters.forEach((searchFilter)=>{
            
            let selector = new SelectElement(searchFilter.field,searchFilter.operator,searchFilter.value);
           
            switch(selector.operator){

                case null:
                    selector= Object.assign(this.selector,this.eq(searchFilter.field, searchFilter.value));
                break;
                case Selector.EQ:
                   
                    selector = Object.assign(this.selector,this.eq(searchFilter.field, searchFilter.value));
                break;
                case Selector.LT:
                    Object.assign(this.selector,this.lt(searchFilter.field, searchFilter.value));
                break;
                case Selector.GT:
                    Object.assign(this.selector,this.gt(searchFilter.field, searchFilter.value));
                break;
                case Selector.LTE:
                    Object.assign(this.selector,this.lte(searchFilter.field, searchFilter.value));
                break;
                case Selector.GTE:
                    Object.assign(this.selector,this.gte(searchFilter.field, searchFilter.value));
                break;
                case Selector.NE:
                    Object.assign(this.selector,this.ne(searchFilter.field, searchFilter.value));
                break;
                case Selector.EXISTS:
                    Object.assign(this.selector,this.exists(searchFilter.field, searchFilter.value));
                break;
                case Selector.TYPE:
                    Object.assign(this.selector,this.type(searchFilter.field, searchFilter.value));
                break;                 
                case Selector.IN:
                    Object.assign(this.selector,this._in(searchFilter.field, searchFilter.value));
                break;
                case Selector.NIN:
                    Object.assign(this.selector,this.nin(searchFilter.field, searchFilter.value));
                break;   
                case Selector.ALL:
                    Object.assign(this.selector,this.all(searchFilter.field, searchFilter.value));
                break; 
                case Selector.SIZE:
                    Object.assign(this.selector,this.size(searchFilter.field, searchFilter.value));
                break;   
                case Selector.OR:
                    Object.assign(this.selector,this.or(searchFilter.field, searchFilter.value));
                break;    
                case Selector.NOR:
                    Object.assign(this.selector,this.nor(searchFilter.field, searchFilter.value));
                break; 
                case Selector.NOT:
                    Object.assign(this.selector,this.not(searchFilter.field, searchFilter.value));
                break; 
                case Selector.MOD:
                    Object.assign(this.selector,this.mod(searchFilter.field, searchFilter.value));
                break;       
                case Selector.REGEX:
                    Object.assign(this.selector,this.regex(searchFilter.field, searchFilter.value));
                break;   
                case Selector.ELEMMATCH:
                    Object.assign(this.selector,this.elemMatch(searchFilter.field, searchFilter.value));
                break;  
            }

        })
    
    
         return this.selector;
        }
        else{
            return {}
        }

    }



}


class DataSynchronizer {
    static xhttp = {};
    static mongoBridgeURL = '';
    static session =  true;
 
    constructor() {
		
        DataSynchronizer.mongoBridgeURL = config.mongoBridgeURL;
       
    }
     static matchingFieldsAlign(remoteRow, localRow, fields) { 

         let fieldsMatch = true;
         
         for (let field of fields) { 

              if (!Object.keys(remoteRow).includes(field) || !Object.keys(localRow).includes(field)) { 
                 fieldsMatch = false;
                 break;
              }else if (remoteRow[field].toString().trim() !== localRow[field].toString().trim()) { 
                 fieldsMatch = false;
                 break;
              }    
         }

         return fieldsMatch;
    }
    
   static isValidJSON(text) { 
        let isValid = false;
        if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').
        replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
        replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

        isValid = true;

        }
        return isValid


    }
	
    syncLoki(collectionInfo){

        let matchingFields =  collectionInfo.matchingFields
        let watchedFields  =  collectionInfo.watchedFields
        let query          = null
       // let selector       = collectionInfo.selector?collectionInfo.selector:{}
        let mode           = collectionInfo.mode?collectionInfo.mode:'update'
        let collection     = collectionInfo.collectionName
        let idField        = collectionInfo.idField?collectionInfo.idField:null;
        let updateSet = new Set()
        try {
 
            let collectionData =   tableMap[collection].data;
            let IdList         = collectionData.map((record)=>{return record[idField]})
            
            if (mode == 'append'){
                    
                     let maxId    = -1
                     IdList.forEach(id => {
                        maxId =  id> maxId?id:maxId
                     });

                     query = maxId
                     let fetchUrl = query ?  DataSynchronizer.mongoBridgeURL + collection + '/' + query :  DataSynchronizer.mongoBridgeURL + collection;
             
                    let xmlhttp = new XMLHttpRequest();

                    xmlhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        let  results = JSON.parse(this.responseText);

                        tableMap[collection].insert(results);
    
                        if (results.length > 0) {
                             updateSet.add(collection)
                            // db.saveDatabase((err) => {
                            //     if (!err) {
                                    
                            //       //  console.log("Database saved")
                            //     } else { 
                                    
                            //         console.log(err)
                            //     }
                            // });
                         }
                       
                        return results.length
                    }
                    };
                    xmlhttp.open("GET", fetchUrl, true);
                    xmlhttp.setRequestHeader('Access-Control-Allow-Headers', '*');
                    xmlhttp.setRequestHeader('Content-type', 'application/json');
                    xmlhttp.setRequestHeader('Access-Control-Allow-Origin', '*');
                    xmlhttp.setRequestHeader( 'Accept', 'application/json');
                    xmlhttp.send();
            } else if (mode=='update'){
                if (query && Object.getOwnPropertyNames(query).length > 0) {
                    query = JSON.stringify(query);
                }
                
            let fetchUrl = query ?  DataSynchronizer.mongoBridgeURL + collection + '/' + query :  DataSynchronizer.mongoBridgeURL + collection;
            let xmlhttp = new XMLHttpRequest();
                //console.log(`fetchUrl:${fetchUrl}`)
            let updateCount = 0
            xmlhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                    let  results = JSON.parse(this.responseText);
                  
                   
                for (let record of results) {

                         if (IdList.indexOf(record[idField])> -1){
                          
                            let tableRow = collectionData.filter((row)=> row[idField]==record[idField]) 
                            tableRow =Array.isArray(tableRow)?tableRow[0]:null;

                            if( !DataSynchronizer.matchingFieldsAlign(record,tableRow, watchedFields )){ 
                        
                                Object.keys(record).filter((field) => ['$loki'].indexOf(field) < 0).forEach((field) => {

                                tableRow[field] = record[field]
                                })
                                tableMap[collection].update(tableRow);
                                updateCount += 1;
                                updateSet.add(collection)
                            }

                         }else{

                             let query ={}
                             query[idField] = record[idField]
                             let temp = collectionData.filter((row) => row[idField] == record[idField]); 
                             if (temp.length==0){
                                
                                tableMap[collection].insert(record)
                                 updateCount += 1;
                                 updateSet.add(collection)
                             }
                              
                         }

                         var index = IdList.indexOf(record[idField]);
                         if (index > -1) {
                            IdList.splice(index, 1);
                         }
                    }
                    if(IdList.length >0){
                        IdList.forEach((id)=>{
                            let query ={}
                            query[idField]=id
                            tableMap[collection].chain().find(query).remove()
                            updateCount += 1
                            updateSet.add(collection)
                        })
                    }

                if (updateCount > 0) {
                    // db.saveDatabase((err) => {
                    //     if (!err) {


                    //     } else {

                    //         console.log(err)
                    //     }

                    // });
                    let updatedColData = {}
                    Array.from(updateSet).forEach((collection) => { 
                            updatedColData[collection] =tableMap[collection].data

                    })
                    postMessage({ 'count': updateCount, 'collections':  updatedColData,'session': DataSynchronizer.session, 'dataPass':acky });
                } else { 

                     return 0;
                }
                    
                }
                
            };
            xmlhttp.open("GET", fetchUrl, true);
            xmlhttp.setRequestHeader('Access-Control-Allow-Headers', '*');
            xmlhttp.setRequestHeader('Content-type', 'application/json');
            xmlhttp.setRequestHeader('Access-Control-Allow-Origin', '*');
            xmlhttp.setRequestHeader( 'Accept', 'application/json');
            xmlhttp.send();
            
        }

        } catch (e) {
            console.log(e)
        }

     }
     

    static runGet(fetchUrl,onSuccess, succesParameters=null,onError=null,errorParameters=null){ 

		let xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
                DataSynchronizer.xhttp = this
                if (DataSynchronizer.xhttp.responseText) {
                    let response = DataSynchronizer.isValidJSON(DataSynchronizer.xhttp.responseText) ? JSON.parse(DataSynchronizer.xhttp.responseText) : null;
                    if (Object.keys(response).includes('message')) { 
                        
                        if (response.message === "Invalid Session Information") { 

                            DataSynchronizer.session = false;
                        }

                    }
                }
				if(succesParameters){
					onSuccess(succesParameters)
				}else{
					onSuccess()
				}
			

			}else if (this.status && parseInt(this.status)>=500){
			//  console.log(`Could not get: ${fetchUrl}`);
					
				if(onError && errorParameters){
					onError(errorParameters)
                } else if(onError){ 
					onError()
				
				}
			}
		};
		xmlhttp.open("GET", fetchUrl, true);
		xmlhttp.setRequestHeader('Access-Control-Allow-Headers', '*');
		xmlhttp.setRequestHeader('Content-type', 'application/json');
		xmlhttp.setRequestHeader('Access-Control-Allow-Origin', '*');
		xmlhttp.setRequestHeader( 'Accept', 'application/json');
		xmlhttp.send();
	}

    static getActualTime(dateField){
        let dateString = "";
       // console.log(dateField)
        if (typeof dateField != 'string') {  
            if(Object.keys( dateField ).indexOf('$date') > -1){
                dateString = new Date(dateField['$date']).getTime();
            }
        }else if (typeof dateField == 'string' && dateField.indexOf('$date')> -1) {  
                dateField = JSON.parse(dateField)
                dateString = new Date(dateField['$date']).getTime();
        }else{
            dateString = new Date(dateField).getTime();
        }

        return dateString;
     }
    static getLocalTableVersion(parameters) {
       
        
        let tableVersionInfo = DataSynchronizer.isValidJSON(DataSynchronizer.xhttp.responseText)? JSON.parse(DataSynchronizer.xhttp.responseText):null;
        let updateQuery = {}
        const updateSet = new Set();
        const recordDeletionMap = {};
        if (Object.keys(tableVersionInfo).includes('message')) { 
                
            if (tableVersionInfo.message === "Invalid Session Information") { 

                    DataSynchronizer.session = false;
            }

            }

                    
        
        if (tableVersionInfo && Object.keys(tableVersionInfo).length > 0) {
            
            Object.keys(tableVersionInfo).forEach((tableName) => {
               try { 
                    updateQuery[tableName] = []
                    let liveTableData = tableVersionInfo[tableName];
                    let localTableData = tableMap[tableName].data //tableData? tableData[tableName]:tableMap[tableName].data;
                    let idField = parameters.collectionSyncInfo.filter((table) => table.collectionName == tableName)[0]['idField']
                    let localIdList = localTableData.map((record) => { return record[idField] })
                    let liveIdList = liveTableData.map((record) => { return record[idField] })
                    let removedIdList = liveIdList && liveIdList.length > 0 ? localIdList.filter((id) => !liveIdList.includes(id)) : localIdList;
                    let currentIdList = liveIdList.filter((id) => !removedIdList.includes(id))
                    let insertList = liveIdList.filter((id) => !localIdList.includes(id))
                    let updateCheckList = [];
                    currentIdList.filter((id) => !insertList.includes(id) ).forEach((id) => { 
                        let liveRecord = liveTableData.filter((record) => record[idField] == id);
                        liveRecord = liveRecord && liveRecord.length==1 ?liveRecord[0]:null
                        let localRecord = localTableData.filter((record) => record[idField] == id);
                        localRecord = localRecord  && localRecord.length==1 ? localRecord[0] : null;
                        parameters.collectionSyncInfo.filter((table) => table.collectionName == tableName)[0]['watchedFields'].forEach((field) => { 
                            if (field.toLowerCase().indexOf('date') > -1) { 
                               if (DataSynchronizer.getActualTime(liveRecord[field]) != DataSynchronizer.getActualTime(localRecord[field]) && !updateCheckList.includes(id)) { 
                                    updateQuery[tableName].push(id);
                                }
                            }else{ 
                                if (liveRecord[field] != localRecord[field] && !updateCheckList.includes(id)) { 
                                    updateQuery[tableName].push(id);
                                }
                            }

                        })
                    })
                        
                //    if (tableName.toLowerCase() == "events") {
                //           console.log("liveTableData: ",liveTableData)
                //         console.log("localTableData: ",localTableData)
                //    }
                //    if (tableName.toLowerCase() == "users") {
                //         console.log(tableName + ' removedIdList list: ' + removedIdList);
                //         console.log(tableName + ' insert list: ' + insertList);
                //         console.log(tableName+' Update list: '+updateCheckList);
                //    }
                        
                    if (removedIdList && removedIdList.length > 0) {
                        let query = {}
                        query[idField] = { "$in": removedIdList };
                        tableMap[tableName].chain().find(query).remove();
                        recordDeletionMap[tableName] = removedIdList
                        
                    }
                    if (insertList && insertList.length > 0) {
                        updateQuery[tableName].push(insertList);
                        updateQuery[tableName] = updateQuery[tableName].flat(Infinity)
                    }
                }catch(e){

                }
                    
            });


            let count = 0;
            //console.log(JSON.stringify(updateQuery))
            Object.keys(updateQuery).forEach((tableName) => {
                let updateCount = updateQuery[tableName].length;
                count += updateCount;
                if (updateCount == 0) {
                    delete updateQuery[tableName];
                }
                 
            })
           
            if (count > 0) {

                // db.saveDatabase((err) => {
                   
                //     if (!err) { databaseInitialize();tableData=null } else { console.log(err) }
                // });
                 

                let fetchUrl = `${DataSynchronizer.mongoBridgeURL}update/cpanel?q=`+JSON.stringify(updateQuery)+`&acky=${acky}`;
                DataSynchronizer.runGet(fetchUrl, DataSynchronizer.updateLocalTables, { "updateSet": updateSet, "collectionSyncInfo": parameters.collectionSyncInfo, "deleted": recordDeletionMap })
            } else {
             let updatedColData = {}
                    Object.keys(tableMap).forEach((collection) => { 
                            updatedColData[collection] =tableMap[collection].data

                    })
                postMessage({ 'count': 0, 'collections': updatedColData, 'records': [], 'deleted': recordDeletionMap ,'session': DataSynchronizer.session, 'dataPass':acky  });
                 
                 
            }

				
        } else { 

            if (Object.keys(tableVersionInfo).includes('message')) { 

                    let updatedColData = {}
                    Object.keys(tableMap).forEach((collection) => { 
                            updatedColData[collection] =tableMap[collection].data

                    })

            postMessage({ 'count': 0, 'collections': updatedColData, 'records': [], 'deleted': [],'session': DataSynchronizer.session, 'dataPass':acky });

            }
        }
		   
			
     }


    static updateLocalTables(parameters) {
       
        let updateCount = 0; 
        let updateSet = new Set()
        let updateData = {}
        const syncInfo = parameters.collectionSyncInfo;
			if(DataSynchronizer.xhttp.responseText){
				
                let tableUpdateInfo = JSON.parse(DataSynchronizer.xhttp.responseText);
              if (Object.keys(tableUpdateInfo).includes('message')) { 
                        
                    if (tableUpdateInfo.message === "Invalid Session Information") { 

                              DataSynchronizer.session = false;
                        }

                    }
                for (let table of Object.keys(tableUpdateInfo)) {
                    try{
                    //console.log(syncInfo)
                        updateData[table]=[]
                        const idField = syncInfo.filter((collection) => collection.collectionName == table)[0]['idField'];
                        tableUpdateInfo[table].forEach((record) => {
                            
                            let tempQuery = {}
                            tempQuery[idField] = record[idField];
                            let filteredRecord = tableMap[table].find(tempQuery)
                            
                        
                            if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                                let tempRecord = filteredRecord[0]
                               // Object.keys(record).filter((field) => ['meta'].indexOf(field) < 0).forEach((field) => {
                                Object.keys(record).filter((field) => field.indexOf('meta') < 0).forEach((field) => {     
                                  //  console.log('Before =>',`${field}: `, tempRecord[field])
                                    tempRecord[field] = record[field];
                                  //  console.log('After =>',`${field}: `, tempRecord[field])
                                    
                                })
                            // console.log(`${JSON.stringify(tempRecord)}`)
                                try{ 
                                    tableMap[table].update(tempRecord); 
                                }catch{

                                  //  console.log("Table not updated", table, tempRecord)
                                }
                                
                                updateCount  += 1;
                                updateSet.add(table);
                                updateData[table].push(tempRecord);
                            } else {
                                
                                try {
                                    let tempRecord = {}
                                    Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                                        tempRecord[field] = record[field]
                                    })
                                    tableMap[table].insert(tempRecord);
                                    updateCount += 1;
                                    updateSet.add(table);
                                    updateData[table].push(tempRecord);
                                } catch (e) {
                                        
                                    filteredRecord = tableMap[table].find(tempQuery)
                        
                                    if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                                        let tempRecord = {...filteredRecord[0]}
                                        Object.keys(record).filter((field) => [ 'meta'].indexOf(field) < 0).forEach((field) => {
                                            tempRecord[field] = record[field]
                                        })
                                        tableMap[table].update(tempRecord);
                                        updateData[table].push(tempRecord);
                                
                                    }
                                
                                    updateCount  += 1;
                                updateSet.add(table);
                                }
                            }

                        })
                    
                  
                }catch(e){


                }
                   
                }

                // db.saveDatabase((err) => {

                //     if(err){

                //         console.log(err)
                //     }
                // });
                  let updatedColData = {}
                Array.from(updateSet).forEach((collection) => { 
                        
                            updatedColData[collection] =tableMap[collection].data

                     })
                   postMessage({ 'count': updateCount, 'collections':  updatedColData, 'records': updateData, 'deleted': parameters.deleted ,'session': DataSynchronizer.session, 'dataPass':acky });
              //  postMessage({ 'count': updateCount, 'collections': Array.from(updateSet), 'records': updateData, 'deleted': parameters.deleted ,'session': DataSynchronizer.session, 'dataPass':acky });
                    
			}
							
							
							
		}


}


function isOnline() {
  return navigator.onLine;
}

function sync() { 

          databaseInitialize();
          let fetchUrl = `${DataSynchronizer.mongoBridgeURL}cpanel?acky=${acky}`
          DataSynchronizer.runGet(fetchUrl, DataSynchronizer.getLocalTableVersion, {'collectionSyncInfo':config.syncInfo.cpanel})
		
}

function startSync() {
  

  if (self.syncID === -1) {
      // const dataSynchronizer       =  new DataSynchronizer();
      new DataSynchronizer();
     
      if (isOnline()) {
           sync();
          self.syncID = setInterval(() => {
              self.syncID = 0
              //console.log("commencing interval check")

              sync();

      

          }, config.syncInterval)
      }

  } else if (self.syncID !== -1) {

   console.log("Data sync is already running");

  }

  
}


 function databaseInitialize (){
     let dbCollections = db.collections;
    config.syncInfo.cpanel.filter((x => !dbCollections.includes(x.collectionName))).forEach((collection) => {
        //console.log(collection.collectionName)
        db.addCollection(collection.collectionName, {
                indices: collection.matchingFields.concat(collection.watchedFields)
                , autoupdate: true
                , unique: [collection.idField]
        });
      
    })
     config.syncInfo.cpanel.forEach((collection) => {

        tableMap[collection.collectionName] = db.getCollection(collection.collectionName);
     //   console.log(`${collection.collectionName}`);
    //    console.log(tableMap[collection.collectionName].data)

     })
  }


onmessage = function(e) {
  
  const result = e.data;
    if (e.data[0] == 'start') {

        config = e.data[1]

        self.syncID = -1;
        let dbName = config.lokiDBDatabase + '.db'
        let idbAdapter = new LokiIndexedAdapter();
        let pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: false });
        db = new loki(dbName, {
                    adapter: pa
                    , autoload: true
                    ,autosave:true
        });
        tableData = e.data[2];
        acky = e.data[3]

            db.loadDatabase({}, () => {
    
                databaseInitialize();

            })
      
        startSync();
  }

}