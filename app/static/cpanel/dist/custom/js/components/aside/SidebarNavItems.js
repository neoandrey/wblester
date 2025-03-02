import { getProperty } from '../Common.js';
import SidebarNavItem from './SidebarNavItem.js';
import SidebarHeader from './SidebarHeader.js';

export default function SidebarNavItems(props, mode=0) {

   if (Object.keys(props).length == 0) {
      return ``
   }

   // const  class  =  getProperty(props, "class", "nav nav-treeview")
   const name = "SidebarNavItems"
   const id = getProperty(props, "id", `${name.toLowerCase()}`)
   const actions = getProperty(props, "actions", {})

   let sidebarNavItemList = getProperty(props, "sidebarNavItemList", []);
   let sidebarHeaderList = getProperty(props, "sidebarHeaderList");


  
   const update =() =>{
      return display()
   }
   const display = () => {
      //console.log(sidebarNavItemList)
      let lastNavItemIndex = sidebarNavItemList.map((item) => item.position).sort((a, b) => b - a)[0];
      let itemHolder = [];

      for (let position = 0; position <= lastNavItemIndex; ++position) {
         itemHolder.push(position)
      }
      let sidebarItems = []
      itemHolder.map((position) => {
         //  console.log(position)
         let navItem = sidebarNavItemList.filter((navItem) => navItem.position === position)[0];
        // console.log(navItem)
         if (navItem && Object.keys(navItem).length > 0) {

            navItem = { ...navItem, 'id': `${id}-${position}` }
            sidebarItems.push(SidebarNavItem(navItem))
         } else {

            let navHeader = sidebarHeaderList.filter((navItem) => navItem.position === position)[0];
            //   console.log(navHeader)
            if (navHeader && Object.keys(navHeader).length > 0) {
               // let item = navHeader[0]
               navHeader = { ...navHeader, 'id': `${id}-${position}` }
               sidebarItems.push(SidebarHeader(navHeader))
            }

         }

      })

      //console.log(`sidebarNavItemList[0]:${JSON.stringify(sidebarNavItemList[0])}`)
      //return `${SidebarNavItem(sidebarNavItemList[0])}`
      return `${sidebarItems.join("")}`
   }
  
   
   if (mode== 0){ 
      return display()
  }else{
      return update()
  }


}