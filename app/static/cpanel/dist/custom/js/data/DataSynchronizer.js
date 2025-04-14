import { Selector } from './Selector.js'
const config = window.config

export default class DataSynchronizer {
    static punchBridge = null
    constructor() {
        this.mongoBridgeURL = config.mongoBridgeURL;
       // DataSynchronizer.punchBridge = new PunchBridge({ host: config.pouchDBServer, port: config.pouchDBPort, database: config.pouchDBDatabase })
       // this.initPunchBridge();
        //console.log("Initializing DataSynchronizer...")
    }

    async initPunchBridge() {
        if (config.syncRemoteCouchdb) {
            await DataSynchronizer.punchBridge.createDB({
                "fetch_url": `http://${config.pouchDBServer}:${config.pouchDBPort}/${config.pouchDBDatabase}`
                , "auth_username": config.pouchDBUsername
                , "auth_password": config.pouchDBPassword
                , "name": config.pouchDBDatabase
            })
        } else {
            await DataSynchronizer.punchBridge.createDB({
                "name": config.pouchDBDatabase
            })
        }

    }
    async getData(collection, queryOptions) {

        let recordData = await DataSynchronizer.punchBridge.find(queryOptions);
        recordData = Object.getOwnPropertyNames(recordData).map((x) => x.toLowerCase()).indexOf('docs') > -1 ? recordData['docs'] : recordData;
        //console.log(`recordData: ${JSON.stringify(recordData)}`)
        return { "name": collection, "data": recordData }

    }

      
    static matchingFieldsAlign(remoteRow, localRow, fields) { 

         let fieldsMatch = true
    
        for (let field of fields) { 
              console.log(field)
              if (!Object.keys(remoteRow).includes(field) || !Object.keys(localRow).includes(field)) { 
                 fieldsMatch = false;
                 break;
              }else if (remoteRow[field].toString().trim() !== localRow[field].toString().trim()) { 
                  fieldsMatch = false;
                  console.log(remoteRow[field].toString().trim())
                  console.log(localRow[field].toString().trim())
                 break;
              }    
         }
         return fieldsMatch;
     }


    sync(collectionInfo) {
        
        let matchingFields =  collectionInfo.matchingFields
        let watchedFields  =  collectionInfo.watchedFields
        let query          = null
        let selector       = collectionInfo.selector?collectionInfo.selector:{}
        let mode           = collectionInfo.mode?collectionInfo.mode:'update'
        let collection     = collectionInfo.collectionName
        let idField        = collectionInfo.idField?collectionInfo.idField:null;

        //console.log(`Synchronizing ${collection}...`);
        try {

            if (mode == 'append'){
                let recordSelect  = new Selector([{ 
                    field: "table_name"
                    ,value: collection
                    ,operator:Selector.EQ
                  }]
                  
                  )  
                 //console.log(JSON.stringify(recordSelect))
                 return DataSynchronizer.punchBridge.find({selector: recordSelect}).then((meta)=>{
                     //console.log(`idField: ${idField}`)
                     let maxId    = -1
                     meta['docs'].forEach(element => {
                        maxId =  element[idField]> maxId?element[idField]:maxId
                     });

                     query = maxId
                     //console.log(`query: ${maxId}`)
                     let fetchUrl = query ? this.mongoBridgeURL + collection + '/' + query : this.mongoBridgeURL + collection;
                     return $.ajax({
                     url: fetchUrl
                     , type: 'GET'
                     , headers: {
                         'Access-Control-Allow-Origin': '*'
                         , 'Content-Type': 'application/json'
                         , 'Accept': 'application/json'
                     }
                     , dataType: 'json'
                     , success: function (results) {

                         results = results.map((result)=>{
                               return {...result,'table_name': collection}
                         })
                        
                        return DataSynchronizer.punchBridge.appendDocs(results, { 'selector': selector, 'limit': results.length, 'matchingFields': matchingFields, 'watchedFields': watchedFields })
                     }
                     , error: function (error) {
                         console.log(error)
                         return error
                     }
                 })

                  })

            } else if (mode=='update'){
                if (query && Object.getOwnPropertyNames(query).length > 0) {
                    query = JSON.stringify(query);
                }
                let fetchUrl = query ? this.mongoBridgeURL + collection + '/' + query : this.mongoBridgeURL + collection;
                return $.ajax({
                url: fetchUrl
                , type: 'get'
                , headers: {
                    'Access-Control-Allow-Origin': '*'
                    , 'Content-Type': 'application/json'
                    , 'Accept': 'application/json'
                }
                , dataType: 'json'
                , success: function (results) {

                    results = results.map((result)=>{
                          
                          return {...result,'table_name': collection}
                    })
                    let selectorOption = [{ 
                        field: "table_name"
                        ,value: collection
                        ,operator:Selector.EQ
                      }]
                    return DataSynchronizer.punchBridge.syncDocs(results, { 'selector': selectorOption, 'limit': results.length} , {'matchingFields': matchingFields, 'watchedFields': watchedFields })

                }
                , error: function (error) {
                    console.log(error)
                    return error
                }
            });
        }

        } catch (e) {
            console.log(e)
        }
    }


    static runGet(fetchUrl,onSuccess, succesParameters=null,onError=null,errorParameters=null){ 

		let xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
			    DataSynchronizer.xhttp =this
				if(succesParameters){
					onSuccess(succesParameters)
				}else{
					onSuccess()
				}
			

			}else if (this.status && parseInt(this.status)>=500){
			  console.log(`Could not get: ${fetchUrl}`);
					
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
        console.log(dateField)
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

            let tableVersionInfo = JSON.parse(DataSynchronizer.xhttp.responseText);
            let updateQuery = {}
            const updateSet      = new Set();
                if (tableVersionInfo && Object.keys(tableVersionInfo).length > 0) {
                    //console.log(tableVersionInfo)
                    Object.keys(tableVersionInfo).forEach((tableName)=>{
                        updateQuery[tableName] = []
                        let liveTableData      = tableVersionInfo[tableName];
                        let localTableData     = tableMap[tableName].data;
                        let idField            = parameters.collectionSyncInfo.filter((table) => table.collectionName == tableName)[0]['idField']
                        let localIdList        = localTableData.map((record)=>{return record[idField]})
                        let liveIdList         = liveTableData.map((record)=>{return record[idField]})
                        let removedIdList      = localIdList.filter((id)=> !liveIdList.includes(id))
                        let currentIdList      = liveIdList.filter((id) => !removedIdList.includes(id))
                        let insertList         = liveIdList.filter((id) => !localIdList.includes(id))
                        let updateCheckList = currentIdList.filter((id) => !insertList.includes(id))
                        if (tableName.toLowerCase() == "users") {
                            console.log(tableName+' General list: ',localIdList);
                            console.log(tableName + ' insert list: ', insertList);
                            console.log(tableName + ' Live list: ', liveIdList);
                        }
                        //console.log(tableName+' General list: '+localIdList);
                        //console.log(tableName+' insert list: '+insertList);
                        
                        if (removedIdList && removedIdList.length > 0) { 
                            let query = {}
                            query[idField] ={ "$in": removedIdList };
                            tableMap[tableName].chain().find(query).remove();
                        }
                        if (insertList && insertList.length > 0) {
                            updateQuery[tableName].push(insertList);
                            updateQuery[tableName]=updateQuery[tableName].flat(Infinity)
                        }
                        
                        
                        if (localTableData && localTableData.length > 0) {
                            
                            for (let id of updateCheckList) {

                                let localRecord = tableMap[tableName].data.filter((record) => record[idField]== id)
                                let liveRecord = liveTableData.filter((record) => record[idField]== id)
                                localRecord = localRecord && localRecord.length > 0 ? localRecord[0] : null
                                liveRecord = liveRecord && liveRecord.length > 0 ? liveRecord[0] : null;
                                if (!localRecord) { 
                                        updateQuery[tableName].push(id);
                                } else if (parseInt(localRecord['current_version']) != parseInt(liveRecord['current_version'])) {  
                                    
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
                                    // updateQuery[tableName].push(id);
                                }
                            }
                        }
                        /*else { 
                            
                                updateQuery[tableName]=currentIdList;

                        }*/	
                        // console.log(`${tableName}: ${JSON.stringify(updateQuery[tableName])}`)
                        
                    });


                    let count = 0;
                    //console.log(JSON.stringify(updateQuery))
                    Object.keys(updateQuery).forEach((tableName) => { 
                        let updateCount =  updateQuery[tableName].length;
                        count += updateCount;
                        if (updateCount == 0) { 
                            delete updateQuery[tableName];
                        } 
                        
                    })
                
                    if (count > 0) { 
                    db.saveDatabase((err) => {
                        
                        if (!err) { databaseInitialize(); } else { console.log(err) }
                    });

                        let fetchUrl = '/update/cpanel?q=' + JSON.stringify(updateQuery);
                    DataSynchronizer.runGet(fetchUrl, DataSynchronizer.updateLocalTables, {'updateSet':updateSet, "collectionSyncInfo":parameters.collectionSyncInfo})
                    }

                    
                    }
                
			
     }



    static updateLocalTables(parameters) {
 
        let updateCount = 0; 
        let  updateSet = new Set()
			const syncInfo  =parameters.collectionSyncInfo
			if(DataSynchronizer.xhttp.responseText){
				
                let tableUpdateInfo = JSON.parse(DataSynchronizer.xhttp.responseText);
              
                for (let table of Object.keys(tableUpdateInfo)) {
                    //console.log(syncInfo)
                  try{
                    const idField = syncInfo.filter((collection) => collection.collectionName == table)[0]['idField']
                    tableUpdateInfo[table].forEach((record) => {
                           
                        let tempQuery = {}
                        tempQuery[idField] = record[idField];
                        
                        let filteredRecord = Object.keys(window.tableMap).includes(table) ? window.tableMap[table].find(tempQuery) : null //change to find One?

                        if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                            let tempRecord = filteredRecord[0]// { ...filteredRecord[0] }
                            Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                                
                                tempRecord[field] = record[field];
                                
                            })
                            // console.log(`${JSON.stringify(tempRecord)}`)
                            window.tableMap[table].update(tempRecord);
                            updateCount += 1;
                            updateSet.add(table);
                        } else {
                            
                            try {
                                window.tableMap[table].insert(record);
                                updateCount += 1;
                                updateSet.add(table);
                            } catch (e) {
                                    
                                filteredRecord = Object.keys(window.tableMap).includes(table) ? window.tableMap[table].find(tempQuery) : null
                       
                                if (filteredRecord && Object.keys(filteredRecord).length > 0) {
                                    let tempRecord = { ...filteredRecord[0] }
                                    Object.keys(record).filter((field) => ['$loki', 'meta'].indexOf(field) < 0).forEach((field) => {
                                        tempRecord[field] = record[field]
                                    })
                                    window.tableMap[table].update(tempRecord);
                             
                                }
                            
                                updateCount += 1;
                                updateSet.add(table);
                            }
                        }

                    })
                    
                  
                    //   db.saveDatabase();
                }catch (e) { 
                         console.log(e)

                }
                   
                }
                
             
                if (Object.keys(parameters).includes('callback')) { 
                   

                    parameters['callback']();
                }
			}
							
							
							
		}
 


}

