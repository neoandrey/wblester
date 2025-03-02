import NavDropdownItem from "./NavDropdownItem.js";
import { getProperty } from '../Common.js'
import { NavDivider } from './Navbar.js'

export default function NavDropdownItemList(props, mode=0) {

  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "NavDropdownItemList"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  let dropdownItemClass = getProperty(props, "dropdownItemClass", "nav-item dropdown")
  let href = getProperty(props, "href", "#")
  let iconClass = getProperty(props, "iconClass", "far fa-bell")
  let spanClass = getProperty(props, "spanClass", "badge badge-warning navbar-badge")
  let spanText = getProperty(props, "spanText", 0)
  let dropdownMenuClass = getProperty(props, "dropdownMenuClass", "dropdown-menu dropdown-menu-lg dropdown-menu-right")
  let dropdownHeaderClass = getProperty(props, "dropdownHeaderClass", "dropdown-item dropdown-header")
  let dropdownHeaderText = getProperty(props, "dropdownHeaderText", "Notifications")
  let footerText = getProperty(props, "footerText", "See All Messages")
  let navDropdownItems = getProperty(props, "navDropdownItems", [])

  const getDropdownItems = () => {
    return
    navDropdownItems.map((dropdownItem, key) => {
      dropdownItem = { ...dropdownItem, "id": `${id}-${key}` }
      return NavDropdownItem(dropdownItem)
    }).join(``)
  }

  const display = () => {
    let spanStr        = parseInt(spanText)>0? `<span class="${spanClass}">${spanText}</span>`:''
    let dropdownString = parseInt(spanText)>0?`<span class="${dropdownHeaderClass}">${spanText} ${dropdownHeaderText}</span>`+ NavDivider() + getDropdownItems() :'No new message'
    let footerString   = parseInt(spanText)>0? `<a href="#" class="dropdown-item dropdown-footer">${footerText}</a>`:''
    
    return (
      `<li id="${id}" class="${dropdownItemClass}">
      <a class="nav-link" data-toggle="dropdown" href="${href}">
      <i class="${iconClass}"></i>
       ${spanStr}
    </a>
    <div class="${dropdownMenuClass}">${dropdownString}
    ${footerString}
    </div>
      </li>`


    )
  }

  const update = () => {
    let spanStr        = parseInt(spanText)>0? `<span class="${spanClass}">${spanText}</span>`:''
    let dropdownString = parseInt(spanText)>0?`<span class="${dropdownHeaderClass}">${spanText} ${dropdownHeaderText}</span>`+ NavDivider() + getDropdownItems() :'No new message'
    let footerString   = parseInt(spanText)>0? `<a href="#" class="dropdown-item dropdown-footer">${footerText}</a>`:''
    return (
      `<a class="nav-link" data-toggle="dropdown" href="${href}">
          <i class="${iconClass}"></i>
           ${spanStr}
        </a>
        <div class="${dropdownMenuClass}">${dropdownString}
          ${footerString}
        </div>`
    )
  }
if (mode== 0){ 
    return display()
}else{
    return update()
}


}