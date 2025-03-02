import { getProperty } from '../Common.js';
import SidebarNavItems from './SidebarNavItems.js'

export default function SidebarNav(props, mode=0) {
  if (Object.keys(props).length == 0) {
    return ``
  }


  const name = "SidebarNav"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  let navClass = getProperty(props, "navClass", "mt-2")
  let menuClass = getProperty(props, "menuClass", "nav nav-pills nav-sidebar flex-column")
  let menuWidget = getProperty(props, "menuWidget", "treeview")
  let dataAccordion = getProperty(props, "dataAcordion", "false")
  let sidebarNavItems = getProperty(props, "sidebarNavItems", [])
  sidebarNavItems = { ...sidebarNavItems, "id": id }

  const setProperties = (props) => {
    navClass = getProperty(props, "navClass", "mt-2")
    menuClass = getProperty(props, "menuClass", "nav nav-pills nav-sidebar flex-column")
    menuWidget = getProperty(props, "menuWidget", "treeview")
    dataAccordion = getProperty(props, "dataAcordion", "false")
    sidebarNavItems = getProperty(props, "sidebarNavItems", [])
  }

  const display = () => {
   // console.log(sidebarNavItems)
    let   itemString = SidebarNavItems(sidebarNavItems)
   // console.log(itemString)
    return (
      
      `<nav id="${id}" class="${navClass}">
          <ul class="${menuClass}" data-widget="${menuWidget}" role="menu" data-accordion="${dataAccordion}">
           ${itemString}
          </ul>
           
          </nav>`

    )
  }

  const update = () => {
   let   itemString = SidebarNavItems(sidebarNavItems)
    return (
      `<ul class="${menuClass}" data-widget="${menuWidget}" role="menu" data-accordion="${dataAccordion}">
           ${itemString}
          </ul>`

    )
  }
  if (mode== 0){ 
    return display()
}else{
    return update()
}
}

