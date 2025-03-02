import {  useEffect, useState, useRef } from 'react';
import PouchDB from 'pouchdb';
import { useOnlineStatus } from './useOnlineStatus'

const Configuration                 =  require('../config/Configuration')
const DataSynchronizer              =  require('../data/DataSynchronizer').DataSynchronizer
const config                        =  new Configuration()
const syncInterval                  =  config.syncInterval

const remoteUrl                     = `http://${config.pouchDBServer}:${config.pouchDBPort}/${config.pouchDBDatabase}`;
                 
let defaultVersionMap               = {}
const  browserDB                    = new PouchDB(config.pouchDBDatabase)
const  remoteDB                     = config.syncRemoteCouchdb?new PouchDB(remoteUrl):null;
const  dataSynchronizer             = new DataSynchronizer();
//config.syncInfo.forEach((collection)=>{ defaultVersionMap[collection.collectionName] =0})
export const usePouchDB= (versionMap,online)  =>
{
    
    const  isOnline                                             = useOnlineStatus(online);
    const  [collectionVersionMap, setCollectionVersionMap]      = useState(versionMap)

      useEffect(() => {

        const cancelInterval = setInterval(() => {
            let tempVersionMap    = collectionVersionMap && Object.keys(collectionVersionMap).length> 0? {...collectionVersionMap}: {...defaultVersionMap}
            let collectionUpdated = false
            //console.log(`syncInterval: ${syncInterval}`)
            if(isOnline){ 
                config.syncInfo.forEach((collection)=>{
                  dataSynchronizer.sync(collection.collectionName, collection.matchingFields,collection.watchedFields).then((updateCount)=>{

                    if(updateCount >0 ){

                        tempVersionMap[collection.collectionName]+=1
                        collectionUpdated =true

                    }
                  })
                  
                });

                 if(collectionUpdated){ 

                    setCollectionVersionMap(tempVersionMap)
                    tempVersionMap = null;

                  }
                 
                }
                
            }, syncInterval)
        return () => {
            clearTimeout(cancelInterval);
        };
    }, [isOnline, collectionVersionMap]);
      
    if(config.syncRemoteCouchdb){ 
            useEffect(() => {
                const canceller = browserDB
                    .sync(remoteDB, {
                        live: true,
                        retry: true,
                    });

                return () => {
                    canceller.cancel();
                };
            }, [browserDB, remoteDB]);
        }

  return collectionVersionMap;
};