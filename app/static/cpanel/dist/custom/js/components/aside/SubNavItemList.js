import { getProperty, getActionString } from '../Common.js';
//import SidebarNavItem from './SidebarNavItem';


function NavItem(props, mode=0) {

   if (Object.keys(props).length == 0) {
      return ``
   }

   const name = "NavItem"
   const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
   const actions = getProperty(props, "actions", {})
   let actionString = getActionString(actions, { "@id": id })
   actionString = actionString.length > 0 ? actionString : '';

   let navAnchorClass = getProperty(props, "navAnchorClass", "nav-link")
   let href = getProperty(props, "href", "")
   let text = getProperty(props, "text", "")
   let iconClass = getProperty(props, "itemIconClass", "")
   let subIconClass = getProperty(props, "subIconClass", "")
   let subNavItemList = getProperty(props, "subNavItemList", [])

   const update = () => {

      return display();

   }

   const display = () => {
      if (subNavItemList.length > 0) {

         let subNavItems = subNavItemList.map((navItem, key) => {

            const navAnchorClass2 = getProperty(navItem, "navAnchorClass", "nav-link")
            const href2 = getProperty(navItem, "href", "")
            const text2 = getProperty(navItem, "text", "")
            const iconClass = getProperty(props, "itemIconClass", "")
            return (
               `<li id="${id}-sub-${key}"  class="nav-item"> <a href="${href2}" class="${navAnchorClass2}">  <i class="${iconClass}"></i><p>${text2}</p> </a> </li>`
            )
         })
         // console.log(subNavItems)

         return (
            `<li id="${id}"   class="nav-item">
               <a href="${href}" class="${navAnchorClass}">
               <i class="${iconClass}"></i>
               <p>${text}</p>
               <i class="${subIconClass}"></i>
               </a>
               <ul class="nav nav-treeview">
               ${subNavItems.join('')}
               </ul>
            </li>`
         )

      } else {
         return (
            `<li class="nav-item">
                        <a id="${id}-link" href="${href}" class="${navAnchorClass}" ${actionString}>
                        <i class="${iconClass}"></i>
                        <p>${text}</p>
                        </a>
                     </li>`

         )
      }

   }
   if (mode== 0){ 
      return display()
  }else{
      return update()
  }
}

export default function SubNavItemList(itemList, parent) {

   // const  class  =  getProperty(props, "class", "nav nav-treeview")

   //console.log(`itemList: ${JSON.stringify(itemList)}`)
   const navItems = itemList.map((navItem, key) => {
      //   console.log(`navItem: ${JSON.stringify(navItem)}`)
      navItem = { ...navItem, "id": `${parent}-${key}` }
      return `${NavItem(navItem)}`
   })

   return `<ul class="nav nav-treeview">  ${navItems.join("")}</ul>`




}