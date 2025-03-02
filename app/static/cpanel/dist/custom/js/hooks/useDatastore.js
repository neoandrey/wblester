import { useEffect, useState } from 'react';
import { PunchBridge }  from '../data/PunchBridge'
import { usePouchDB } from './usePouchDB'

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

async function getData(collection, latestVersion){
    getPouchConnection();
           /* let collectionSelect = new Selector([{ 
                 field: "collection"
                ,value:collection
                ,operator:Selector.EQ
            }]*/

    let collectionSelect = {} // new Selector() ;
    let recordData       = await punchBrigde.find({selector: collectionSelect});
    recordData           = Object.getOwnPropertyNames(recordData).map((x)=>x.toLowerCase()).indexOf('docs')>-1? recordData['docs']: recordData;
    //console.log(`recordData: ${JSON.stringify(recordData)}`)
    return {"name":collection, "data":recordData,"version":latestVersion}

}

  
export const useDatastore = (tempDataSet, callback)  =>
{

    const  [collectionDataset, setCollectionDataset] = useState();
    const  collectionVersionMap                      = usePouchDB();
    function getCollectionDataset(){
        return tempDataSet;
    }

   useEffect(()=>{
        async function dataBuffer(collectionName){
            return await getData(collectionName)
        }
        let tempDataSet   = getCollectionDataset();

        let promises    = [];

        //console.log("tempDataSet")
        //console.log(JSON.stringify(tempDataSet))

        Object.keys(tempDataSet).forEach( (collection)=>{
           // console.log(`collection: ${JSON.stringify(collection)}`)
            let collectionVersion = collection.version
            let latestVersion     = tempDataSet[collection];
                if(collectionVersion !==latestVersion){
                    promises.push(dataBuffer(collection, latestVersion))
                }
        })
        Promise.all(promises)
        .then(results => {

            setCollectionDataset(results)
            callback(results);

        })
         
         return ()=>{
            tempDataSet = null;
            promises    = null
         }
   }, [ collectionVersionMap,tempDataSet,callback ]);

   return collectionDataset;




}