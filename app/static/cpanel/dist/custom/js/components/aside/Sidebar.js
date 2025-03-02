import { getProperty } from '../Common.js';
import SidebarLogo from './SidebarLogo.js';
import SidebarUserInfo from './SidebarUserInfo.js';
import SidebarSearch from './SidebarSearch.js';
import SidebarNav from './SidebarNav.js'


export default function Sidebar(props, mode=0) {
    if (Object.keys(props).length == 0) {
        return ``
    }

    const name = "Sidebar"
    const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
    const actions = getProperty(props, "actions", {})

    let asideClass = getProperty(props, "asideClass", "main-sidebar sidebar-dark-primary elevation-4");
    let sidebarLogo = getProperty(props, "sidebarLogo", {});
    let sidebarClass = getProperty(props, "sidebarClass", "sidebar")
    let sidebarUserInfo = getProperty(props, "sidebarUserInfo", {})
    let sidebarNav = getProperty(props, "sidebarNav", {})

    const display = () => {

        return (
     ` <aside id="${id}" class="${asideClass}">
        ${SidebarLogo(sidebarLogo)}  
        <div class="${sidebarClass}">
        ${SidebarNav(sidebarNav)}
        </div></aside>`
        )
    }

    const update = () => {
       
       let  subNavs = SidebarNav(sidebarNav);
      // console.log(subNavs)
        return (`
        ${SidebarLogo(sidebarLogo)}  
        <div class="${sidebarClass}">
         ${subNavs}
        </div>`)
    }

    if (mode== 0){ 
        return display()
    }else{
        return update()
    }
}