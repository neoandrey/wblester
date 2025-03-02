import { useEffect, useState, useRef } from 'react';
import { PunchBridge }  from '../data/PunchBridge'

const Configuration                 =  require('../config/Configuration')

const config                        =  new Configuration()
let  punchBrigde                    =  new PunchBridge({host: config.pouchDBServer, port:config.pouchDBPort, database: config.pouchDBDatabase})

//config.syncInfo.forEach((collection)=>{ defaultVersionMap[collection.collectionName] =0})

async function getPouchConnection(){ 

     if(config.syncRemoteCouchdb){ 
         await punchBrigde.createDB({
             "fetch_url":`http://${config.pouchDBServer}:${config.pouchDBPort}/${config.pouchDBDatabase}`
             ,"auth_username": config.pouchDBUsername
             ,"auth_password": config.pouchDBPassword
             ,"name": config.pouchDBDatabase
         })
     }else {
         await punchBrigde.createDB({
             "name": config.pouchDBDatabase
         })
     }

}

async function getData(collection){
    getPouchConnection();
           /* let collectionSelect = new Selector([{ 
                 field: "collection"
                ,value:collection
                ,operator:Selector.EQ
            }]*/

    let collectionSelect =  {} // new Selector() ;
    let recordData       = await punchBrigde.find({selector: collectionSelect});
    recordData           = Object.getOwnPropertyNames(recordData).map((x)=>x.toLowerCase()).indexOf('docs')>-1? recordData['docs']: recordData;
    return {"name":collection, "data":recordData,"version":0}

}

  
let baseDataSet                  = config.syncInfo.map((collection)=>{
     
     return {
        "name": collection.collectionName
        ,"version":0
        ,"data":{} 
     }
                                
})

export const useSnapshot= (pouchDatabase)  =>{
    
    const  [collectionDataset, setCollectionDataset] = useState(baseDataSet);
    const  snapshotBuffer                            = useRef(collectionDataset)

    function getCollectionDataset(){
        return [...collectionDataset];
    }
    

    useEffect(()=>{
        let promises = [];
 

        for(let collectionInfo of getCollectionDataset()){
            promises.push(getData(collectionInfo.name))
        }

 Promise.all(promises)
    .then(results => {
        snapshotBuffer.current = results
        setCollectionDataset(results)
        results= null;
    })

       return ()=>{
        snapshotBuffer.current= null
        promises = null;
        }
    }, [pouchDatabase])

    return snapshotBuffer.current;
}