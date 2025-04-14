
//<script src="//cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js"></script>
import  { Selector }   from './Selector.js'
//const  PouchDB   = require('pouchdb');
let db;
export class PunchBridge{

    static host;
    static port;
    static databaseName;
    static mongoUrl;
    selector;

    constructor(options) {

        //PouchDB.plugin(PouchdbFind);
        this.host                              = options && options.host?options.host:"localhost";
        this.port                              = options && options.port?options.port:5984;
        this.databaseName                      = options && options.databaseName?options.databaseName:null;
        this.db                                = db;

    }

    createDB(opts){
      
        let options                            = {}
        options.name                           = opts && opts.name?opts.name:null;
        options.auto_compaction                = opts && opts.auto_compaction?opts.auto_compaction:false;
        options.adapter                        = opts && opts.adapter?opts.adapter: null;
        options.revs_limit                     = opts && opts.revs_limit?opts.revs_limit:1000;
        options.deterministic_revs             = opts && opts.deterministic_revs?opts.deterministic_revs:true;
        options.view_update_changes_batch_size = opts && opts.view_update_changes_batch_size?opts.view_update_changes_batch_size:50;
        options.view_adapter                   = opts && opts.view_adapter?opts.view_adapter:null;
        options.purged_infos_limit             = opts && opts.purged_infos_limit?opts.purged_infos_limit:1000;
        options.fetch_url                      = opts && opts.fetch_url?opts.fetch_url:null;
        options.fetch_options                  = opts && opts.fetch_options?opts.fetch_options:null;
        options.auth_username                  = opts && opts.auth_username?opts.auth_username:null;
        options.auth_password                  = opts && opts.auth_password?opts.auth_password:null;
        options.skip_setup                     = opts && opts.skip_setup?opts.skip_setup:true;

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })
        if(!options.fetch_url){
         
            this.db=  new PouchDB(options);
            db = this.db
         }else{
            

            this.db=    new PouchDB(options.fetch_url , {
                auth: {
                  username:  options.auth_username ,
                  password: options.auth_password  ,
                },
              })
              db=this.db
        }

       // console.log(this.db.adapter);
        
         return  this;
    }

    deleteDB(options){
        return this.db.destroy(options).then((response)=>{
            return (response);
        }).catch((e)=>console.log(e))
    }
//Change to Mango query
    update(options){
  
        let id = options && options.id? options.id:options._id;
       // console.log(options._id)
        if (options.post){ 
                if(id){
                
                    this.get(id).then((response)=>{
                       //console.log(`id: ${id}`)
                            Object.getOwnPropertyNames(options).forEach((props)=>{
                                response[props]= options[props];
                            })
                            return  this.db.post(response).catch( (err) =>{ console.log(err); });
                        })


                    }else{

                        return this.db.post(options).catch((e)=>console.log(e))

                    }

        }else{
            if(id){
                
                this.get(id).then((response)=>{
                   // console.log("searching for record with id "+id)
                        Object.getOwnPropertyNames(options).forEach((props)=>{
                            response[props]= options[props];
                        })
                        return  this.db.put(response).catch( (err) =>{ console.log(err); });
                    })


                }else{

                    return this.db.put(options).catch((e)=>console.log(e))

                }


        }
    }

    get(id,opts){

        let options         = {};

        options.rev         = opts && opts.rev?opts.rev:null;
        options.revs        = opts && opts.revs?opts.revs:null;
        options.rev_info    = opts && opts.rev_info?opts.rev_info: null;
        options.open_revs   = opts && opts.open_revs?opts.open_revs:null;
        options.conflicts   = opts && opts.conflicts?opts.conflicts:null;
        options.attachments = opts && opts.attachments?opts.attachments:null;
        options.binary      = opts && opts.binary?opts.binary:null;
        options.latest      = opts && opts.latest?opts.latest:null

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        if (Object.getOwnPropertyNames(options).length>0){
          return  this.db.get(id, options).catch((e)=>{console.log(e)})
        }else{
            return this.db.get(id).catch((e)=>{console.log(e)})
        }

    }


    delete(id,options){

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        if (Object.getOwnPropertyNames(options).length>0){

             this.get(id).then((result)=>{
                    return this.db.remove(result, options).catch((e)=>{ console.log(e)})
             })

        }else{
            this.get(id).then((result)=>{
                return this.db.remove(result).catch((e)=>{ console.log(e)})
         })

        }

    }

   // bulkDocs(docs, options){
    syncDocs(docs, options, matchOptions){
        //console.log(options)
        if(!options ){
            options = {}
        }
       
   let matchFilterFields = {}// options.selector
   let docIdSet         = [] 
   docs.forEach((doc)=>{
    docIdSet.push(doc._id)
    matchOptions.matchingFields.forEach((field)=>{
         if(Object.keys(matchFilterFields).indexOf(field)<0){
            matchFilterFields[field] = new Set()
         }
            matchFilterFields[field].add(doc[field])
            })
     })

      // console.log(matchFilterFields)
       let selectors = []
       for (let key of Object.keys(matchFilterFields)){
        selectors.push({ 
            'field': key
            ,'value':  Array.from(matchFilterFields[key])
            ,'operator':Selector.IN
        })
        
       }
        options['selector'] = new Selector(selectors)
    
        let removedIDSet = []

       return this.find(options).then((foundDocs)=>{
            let updateItemCount =0;
            let  results = []


            if(foundDocs && ('docs' in foundDocs)){ 
               
                removedIDSet    = foundDocs["docs"].filter(
                (doc)=>{ 
                       
                        return (docIdSet.indexOf(doc['_id'])<0) 
                    }).map((x)=>({
                    '_id': x['_id'],'_rev':x['_rev'], '_deleted':true 
                    } )
                );
  
                let removedIDs = removedIDSet.map((k)=>k._id)

                //let couchDBDocs = foundDocs["docs"].filter((x)=>{ return ( removedIDs.indexOf(x['_id'] ) <0 )})
                let tempSyncFields    =  matchOptions.watchedFields?matchOptions.watchedFields.map((f)=>{return f.toLowerCase()}):null;
                docs.forEach((mongoDoc)=> {
                        let changed  = false;
                        let tempDoc  = mongoDoc;
                        let savedDoc = foundDocs["docs"].filter((x)=>{return x['_id'] ===  mongoDoc['_id']  &&  removedIDs.indexOf(x['_id'] ) <0 })
                        if (savedDoc.length===0){ 
                            changed = true;
                        }else{ 
                            savedDoc = Array.isArray(savedDoc)?savedDoc[0]:savedDoc;
                            let recordFields      =  Object.getOwnPropertyNames(tempDoc)
                            let syncFields        =  recordFields.filter((x)=>{return (x.toLowerCase().indexOf('date')> -1 || x.toLowerCase().indexOf('time')> -1|| (tempSyncFields && tempSyncFields.indexOf(x.toLowerCase()) > -1))} )
                            //  if(syncFields.length > 0){ 
                            //     recordFields = syncFields
                            //}
                            // console.log(syncFields)
                            for(let prop of syncFields){
                                if(prop in tempDoc){
                                    //console.log(JSON.stringify(tempDoc[prop]))
                                        if (JSON.stringify(tempDoc[prop]) !== JSON.stringify(savedDoc[prop])){
                                            changed = true; 
                                            break
                                        }
                                }
                            }
                        }

                    if (changed){ 
                        updateItemCount += 1
                        if(savedDoc && savedDoc['_rev'] ){ 
                            tempDoc['_rev'] = savedDoc['_rev'] 
                        } 
                        results.push(tempDoc);
                        }
                    }
                )
            } else{
                results=docs;
            }
            //console.log(results)
            return ({'add':results, 'delete':removedIDSet, 'count': updateItemCount})
            }).then((results)=>{ 
              //  console.dir(results)
                if (options && Object.getOwnPropertyNames(options).length>0){
                    this.db.bulkDocs(results['delete'],options).catch((e)=>console.log(e));
                    this.db.bulkDocs(results['add'],options).catch((e)=>console.log(e));
                }else{
                    //console.log(results)
                    this.db.bulkDocs({docs:results['delete']}).catch((e)=>console.log(e));
                    this.db.bulkDocs({docs:results['add']}).catch((e)=>console.log(e));
                }
                
            return  results.count;
            }
            );
               
    }

    appendDocs(docs, options){ 
       let  results = { 'add':docs, 'delete':[], 'count': docs.length}
         
               return this.db.bulkDocs(results['add'],options).then((data)=>{
                   
                       return  results.count;
               
               }).catch((e)=>console.log(e));
                            
       }
   

    allDocs(opts){

        let options= {};

        options.include_docs  = opts && opts.include_docs?opts.include_docs:null;
        options.conflicts     = opts && opts.conflicts?opts.conflicts:null;
        options.attachments   = opts && opts.attachments?opts.attachments:null;
        options.binary        = opts && opts.binary?opts.binary: null;
        options.startKey      = opts && opts.startKey? opts.startKey: null;
        options.endKey        = opts && opts.endKey? opts.endKey: null;
        options.inclusive_end = opts && opts.inclusive_end? opts.inclusive_end: null;
        options.limit         = opts && opts.limit?opts.limit:null;
        options.skip          = opts && opts.skip? opts.skip: null;
        options.descending    = opts && opts.descending? opts.descending: null;
        options.key           = opts && opts.key? opts.key: null;
        options.keys          = opts && opts.keys? opts.keys: null;
        options.update_seq    = opts && opts.update_seq? opts.update_seq:null;

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        return this.db.allDocs(options).catch((e)=>{console.log(e)})



    }

    createIndex(opts){

        let options = {};

        options.name                    =  opts.name?   opts.name:null;
        options.fields                  =  opts.fields? opts.fields: null;
        options.ddoc                    =  opts.ddoc?   opts.ddoc: null;
        options.type                    =  opts.type?   opts.type: null;
        options.partial_filter_selector =  opts.partial_filter_selector? opts.partial_filter_selector: null;
        

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        return this.db.createIndex({index: options}).catch((e)=>{
            console.log(e)
        })


    }

    find(opts){
      //  console.log(`options: ${JSON.stringify(opts)}`)
        let  options           = {};
        options.selector       = opts && opts.selector? opts.selector: null;
        options.fields         = opts && opts.fields? opts.fields: null;
        options.sort           = opts && opts.sort?opts.sort: null;
        options.limit          = opts && opts.limit?opts.limit: null;
        options.skip           = opts && opts.skip? opts.skip: null;
        options.use_index      = opts && opts.use_index? opts.use_index: null;

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        let indexNameList = Object.getOwnPropertyNames(options.selector)
        let indexName     = '';
        if(Array.isArray(indexNameList)){
            indexName = indexNameList.join('-');
        }
       // console.log(`indexNameList :${indexNameList}`)
     if(indexNameList.length> 0)  {
      return  this.getIndexes().then((indexList)=>{
           let indexExists = false;
           for( let index  of  indexList["indexes"]){ 
            let pouchIndex =index["ddoc"]?index["ddoc"].replace('_design/',''):null
              if (pouchIndex && pouchIndex.toLowerCase()==indexName.toLowerCase()){
                    indexExists = true
                 break;
              }
            }
            return indexExists;
        }).then(async (indexed)=>{

            if(!indexed){

              return await this.db.createIndex({
                    index: {
                      fields: indexNameList,
                      ddoc: indexName,
                      name: indexName
                    }
                  }).then( ()=> {

                    options['use_index'] = indexName;
                    return this.db.find(options).catch((e)=> console.log(e));
                    
                  });

            }else{
                 options['use_index'] = indexName;
                console.log(`Running indexed (${indexName}) search...`);
                console.log(`Options: ${JSON.stringify(options)}`)
                return this.db.find(options).then((results)=>{ console.log(`Got results: ${JSON.stringify(results)}`); return results}).catch((e)=> console.log(e))
            }
           
        })
    }else{
        //console.log("running default find...")
        return this.db.find(options).catch((e)=> console.log(e))
    }

    }

    
    explain(opts){

        let  options           = {};
        options.selector       = opts && opts.selector? opts.selector: null;
        options.fields         = opts && opts.fields? opts.fields: null;
        options.sort           = opts && opts.sort?opts.sort: null;
        options.limit          = opts && opts.limit?opts.limit: null;
        options.skip           = opts && opts.skip? opts.skip: null;
        options.use_index      = opts && opts.use_index? opts.use_index: null;

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        return this.db.explain(options).catch((e)=> console.log(e))

    }

    getIndexes(){
       
         return this.db.getIndexes().catch((e)=>{
            console.log(e);
         })
    }
    deleteIndex(opts){

        return  this.db.deleteIndexes(opts).catch((e)=>{
            console.log(e);
         })
    }

    query(opts){

        let options               = {};
        options.fun               = opts && opts.fun? opts.fun: null;
        options.reduce            = opts && opts.reduce? opts.reduce: null;
        options.include_docs      = opts && opts.include_docs? opts.include_docs: null;
        options.conflicts         = opts && opts.conflicts? opts.conflicts: null;       
        options.attachments       = opts && opts.attachments? opts.attachments: null;
        options.binary            = opts && opts.binary? opts.binary: null;
        options.startkey          = opts && opts.startkey ? opts.startkey : null;
        options.inclusive_end     = opts && opts.inclusive_end? opts.inclusive_end: null;
        options.limit             = opts && opts.limit? opts.limit: null;
        options.skip              = opts && opts.skip? opts.skip: null;
        options.descending        = opts && opts.descending? opts.descending: null;
        options.key               = opts && opts.key? opts.key: null;
        options.group             = opts && opts.group? opts.group: null;
        options.group_level       = opts && opts.group_level? opts.group_level: null;
        options.stale             = opts && opts.stale? opts.stale: null;
        options.update_seq        = opts && opts.update_seq? opts.update_seq: null;

        Object.getOwnPropertyNames(options).forEach((x)=>{

            if(options[x]==null){

                delete options[x]
            }
        })

        return this.db.query(options).catch((e)=> console.log(e))

    }

    info(){
        return this.db.info().catch((e)=>{console.log(e)})
    }
    compact(opts){
        return this.db.compact(opts).catch((e)=>{console.log(e)})
    }
   bulkGet(opts){

     let  options        =  {};
     options.docs        =  opts.docs?opts.docs: null;
     options.revs        =  opts.revs?opts.revs: null;
     options.attachments =  opts.attachments? opts.attachments: null;
     options.binary      =  opts.binary?opts.binary: null;

   
     Object.getOwnPropertyNames(options).forEach((x)=>{

        if(options[x]==null){

            delete options[x]
        }
    })
   //console.dir(options.docs)
    return this.db.bulkGet({'docs':options.docs.map(x=> {
      return { id: x._id}
    })}).catch((e)=> console.log(e))

   }

   close(){

     return this.db.close().catch((e)=> console.log(e))

   }
    
}

//export default PunchBridge;
//module.exports =PunchBridge;