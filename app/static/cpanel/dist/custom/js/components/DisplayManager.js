/**
 *  
 * 
 * 
 * Components must have unique names so that their IDs are unique
 */


class DisplayManager {

    // static collectionDataMap                   =  null; // collection to data
    static componentPropMap         = null; // componentID to property map
    static componentHTMLIDMap       = null; // id to component
    static collectionComponentMap   = null; // collection to componentMap
    static collectionVersionMap     = null; // collection version
    static pageIDDisplayMap         = null; //  maps pageID to page componentDisplayMap
    static pageHistory              = null; // [] - pageID switch history
    static pageUpdateHistory        = null;
    static currentPageID            = null; // gives the current page id
   // static lastRunFunction          = null;
   // static lastObjectType           = null

    constructor() {

        //  DisplayManager.collectionDataMap       = {};
        DisplayManager.componentPropMap       = {};
        DisplayManager.componentHTMLIDMap     = {};
        DisplayManager.collectionComponentMap = {};
        DisplayManager.collectionVersionMap   = {};
        DisplayManager.pageIDDisplayMap       = {};
        DisplayManager.pageHistory            = [];
        DisplayManager.pageUpdateHistory      =  new Set();
        DisplayManager.componentNameMap = {};
        DisplayManager.currentTab = null;

    }

    static setCurrentPageID(pageID) {

        DisplayManager.currentPageID = pageID;
        DisplayManager.pageHistory.push(pageID);
        DisplayManager.pageIDDisplayMap[pageID] = {}

    }

    static getComponentID(component) {

        let componentName = component.name
        if (Object.keys(DisplayManager.componentHTMLIDMap).indexOf(componentName) > -1) {
            return DisplayManager.componentHTMLIDMap[componentName]
        } else {
            return null;
        }
    }


    static updateCollection(collection, data) {

        if (data) {

            if (Object.keys(DisplayManager.collectionComponentMap).indexOf(collection) > -1) {
                let componentID = DisplayManager.collectionComponentMap[collection];
                // DisplayManager.updateCollectionDataMap(collection, data)
                let props = DisplayManager.componentPropMap[componentID];
                props = { ...props, "tableData": data }
                DisplayManager.collectionVersionMap[collection.collectionName] += 1
                DisplayManager.updateComponentDisplay(componentID, props)
            } else {
                console.log(`No component has been mapped to ${collection}.`)
            }

        } else {
            console.log(`Data for ${collection} could not be updated`)
        }
    }

    static updateComponentProperties(component, newProps) {

        let componetID = DisplayManager.getComponentID(component)
        let props = DisplayManager.componentPropMap[componetID];
        Object.keys(newProps).forEach((property) => {
            props[property] = newProps[property]
        })
        DisplayManager.updateComponentDisplay(componetID, props)

    }
    /*
      static  updateCollectionDataMap(collection, data){
            DisplayManager.collectionDataMap[collection] = data;
        }
        */

    static updateComponentPropMap(component, prop) {
        let componentID = DisplayManager.getComponentID(component)
        DisplayManager.componentPropMap[componentID] = prop;
    }

    static addComponentDisplay(component, props) {

        let componentName = component.name
        let componentID = `${DisplayManager.currentPageID}-${componentName.toLowerCase()}`
        DisplayManager.componentHTMLIDMap[componentName] = componentID;
        let props2 = { ...props, "id": componentID }
        let html = component(props2);
        DisplayManager.pageIDDisplayMap[DisplayManager.currentPageID][componentID] = html;

        if (props && Object.keys(props).indexOf('collection') > -1) {
            let collection = props['collection']
            DisplayManager.collectionComponentMap[collection] = componentID
        }

    }

    static isHidden(el) {
        return (el.offsetParent === null)
    }

    static updateComponentDisplay(component, props) {

        let componentName = component.name
        //console.log(componentName)
       // console.dir(Object.keys(DisplayManager.componentHTMLIDMap))
        if (Object.keys(DisplayManager.componentHTMLIDMap).indexOf(componentName) > -1) {
           // console.log(`Getting componet html`)
            let html = component(props,1)
            //console.log(html)
            let componentID = DisplayManager.componentHTMLIDMap[componentName];
           // console.log(`ComponentID: ${componentID}`)
            DisplayManager.pageIDDisplayMap[DisplayManager.currentPageID][componentID] = html;
            let element = document.getElementById(componentID);
            if (element && !DisplayManager.isHidden(element)) {
            //    console.log('updating component HTML')
             //   console.log(element)
                $('#'+componentID).html(html.replaceAll('src="null"', 'src="/static/logo50.png"'))
            }else{

                console.log(`Unable to update html of: `)
                console.log(element)
            }


        } else {

            let id = `${DisplayManager.currentPageID}-${componentName.toLowerCase()}-1`
            DisplayManager.componentHTMLIDMap[component] = id;
            props = { ...props, "id": id }
            let html = component(props);
            DisplayManager.pageIDDisplayMap[DisplayManager.currentPageID][id] = html;
            $(`#${id}`).html(html)


        }
    }

    static display(navPage) {
        let currentPageDisplay = []
      //  Object.values(DisplayManager.pageIDDisplayMap).forEach((key) => {
        //    //console.log(key)
      //  })
        Object.values(DisplayManager.pageIDDisplayMap[DisplayManager.currentPageID]).forEach((componentHtml) => {
            currentPageDisplay.push(componentHtml)
        });
        // console.log(currentPageDisplay)
        // $.getScript('static/dist/css/adminlte.min.css', () => { });
        //$.getScript('/static/dist/css/ionicons.min.css?version=1.0.0.0', () => { });
        //$.getScript('static/plugins/jquery/jquery.min.js', () => { });
        //$.getScript('static/plugins/jquery-ui/jquery-ui.min.js', () => { });
        //$.getScript('static/plugins/bootstrap/js/bootstrap.bundle.min.js', () => { });
        //$.getScript('/static/dist/js/adminlte.js', () => { });
        //$.getScript('/static/plugins/jquery-ui/jquery-ui.min.js', () => { });
        $(`#${DisplayManager.currentPageID}`).html('')
        $(`#${DisplayManager.currentPageID}`).html(currentPageDisplay.join('').replaceAll('src="null"', 'src="/static/logo50.png"'));
        DisplayManager.pageUpdateHistory.add(navPage);


    }


}
export default DisplayManager;