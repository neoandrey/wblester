
class RequestHandler {

  static versionMap = null;
  static dispatch = null;
  static isOnline = null;
  static fetchUrl = window.config.mongoBridgeURL;
  static punchBrigde = null;
  static dataSynchronizer = null;

  constructor() {

  }

  init(versionMap, dispatch, isOnline) {

    RequestHandler.versionMap = versionMap;
    RequestHandler.dispatch = dispatch;
    RequestHandler.isOnline = isOnline;
    RequestHandler.dataSynchronizer = window.dataSynchronizer;
  }

  showText(message) {
    alert(message)
  }

  isOnline() {
    return window.navigator.onLine;
  }

  syncCollection(collectionName) {
    let fetchRequests = []
    if (isOnline()) {
      config.syncInfo.filter((collection) => collection.collectionName === collectionName).map((collection) => {
        dataSynchronizer.sync(collection.collectionName, collection.matchingFields, collection.watchedFields).then((updateCount) => {

          if (updateCount > 0) {

            fetchRequests.push(getData(collection.collectionName, { 'selector': {} }));
            console.log(`${collection.collectionName} not udpated`);

          } else {
            console.log(`${collection.collectionName} not udpated`)
          }
        })

        Promise.all(fetchRequests).then(results => {
          if (results && results.collection && results.data) {
            DisplayManager.updateCollection(results.collection, results.data)
          }

        })

      });

    }
  }

  runRemoteGet(queryParams) {

    let fetchUrl = Object.keys(queryParams).indexOf('query') > -1 ? RequestHandler.fetchUrl + queryParams.collection + '/' + queryParams.query : RequestHandler.fetchUrl + queryParams.collection;
    if (RequestHandler.isOnline) {
      return fetch(fetchUrl, {
        mode: 'cors',
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }).catch((error) => {
        console.log(`Data Fetch Error: ${error}`)
      }).then(response => {
        // console.log(response)
        return response ? response.json() : null
      })
        .then((results) => {

          if (results) {
            // console.log(results)
            return results
          }
        }).then((count) => {
          console.log(`Update count: ${count}`)
          return count
        }).catch((error) => {
          console.log(error)
        })
    } else {
      alert("Cannot connect to server")
    }
  }

  runPost(queryParams) {

    let fetchUrl = Object.keys(queryParams).indexOf('query') > -1 ? RequestHandler.fetchUrl + queryParams.collection + '/' + queryParams.query : RequestHandler.fetchUrl + queryParams.collection;
    let data = Object.keys(queryParams).indexOf('data') > -1 ? JSON.stringify(data) : null
    if (null && RequestHandler.isOnline) {
      return fetch(fetchUrl, {
        mode: 'cors'
        , method: "POST"
        , headers: {
          "Content-Type": "application/json"
          , "Access-Control-Allow-Origin": "*"
        }
        , body: data
      }).catch((error) => {
        console.log(`Data Fetch Error: ${error}`)
      }).then(response => {
        // console.log(response)
        return response ? response.json() : null
      })
        .then((results) => {

          if (results) {
            // console.log(results)
            return results
          }
        }).then((count) => {
          console.log(`Update count: ${count}`)
          return count
        }).catch((error) => {
          console.log(error)
        })
    } else {
      alert("Cannot connect to server or invalid data format")
    }

  }


}
export default RequestHandler
