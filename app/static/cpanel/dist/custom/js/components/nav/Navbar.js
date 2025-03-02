
import MediaDropdownItemList from './MediaDropdownItemList.js'
import NavDropdownItemList from './NavDropdownItemList.js'
import NavbarSearch from './NavbarSearch.js'
import { getProperty,getActionString } from '../Common.js'


export function NavDivider() {
  return `<div class="dropdown-divider"></div>`
}


export default function Navbar(props, mode =0) {

  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "Navbar"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  const navbarClass = getProperty(props, "navbarClass", "main-header navbar navbar-expand navbar-white navbar-light")
  const navLinks = getProperty(props, "navLinks", [{ "name": "Home", "href": "index3.html" }, { "name": "Contact", "href": "#" }])
  const navDropdownItemList = getProperty(props, "NavDropdownItemList", [])
  const mediaDropdownItemList = getProperty(props, "MediaDropdownItemList", [])


  const display = () => {
    return (
      `<nav id="${id}" class="${navbarClass}">
    <ul class="navbar-nav">
      <li class="nav-item">
        <a class="nav-link" data-widget="pushmenu" href="#" role="button"><i class="fas fa-bars"></i></a>
      </li> ${navLinks.map((navLink) => {
        let actionString = getActionString(navLink.actions, {});
        let accessMethod = navLink.access ? navLink.access.method : null;
        let accessValue  = navLink.access ? navLink.access.value : null;
        actionString = actionString.length > 0 ? actionString : '';
        let accessLevel = eval(accessMethod)
        return accessMethod == null || accessLevel==accessValue?`<li  class="nav-item d-none d-sm-inline-block">
            <a href="${navLink.href}" class="nav-link" ${actionString}>${navLink.name}</a>
          </li>`:''
      }).join(``)
      }    
    </ul>
    <ul class="navbar-nav ml-auto">   
      ${MediaDropdownItemList(mediaDropdownItemList)}
      ${NavDropdownItemList(navDropdownItemList)}
      <li class="nav-item">
        <a class="nav-link" data-widget="fullscreen" href="#" role="button">
          <i class="fas fa-expand-arrows-alt"></i>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" id="logout-bttn" href="#" role="button">
          <i class="fas fa-power-off"></i>
        </a>
      </li>
    </ul>
  </nav>`



    )
  }

  const update = () => {
    return (
      ` <ul class="navbar-nav">
      <li class="nav-item">
        <a class="nav-link" data-widget="pushmenu" href="#" role="button"><i class="fas fa-bars"></i></a>
      </li> ${navLinks.map((navLink) => {
        let actionString = getActionString(navLink.actions, {} )
        actionString = actionString.length > 0 ? actionString : '';
        return `<li  class="nav-item d-none d-sm-inline-block">
            <a href="${navLink.href}" class="nav-link" ${actionString}>${navLink.name}</a>
          </li>`
      }).join(``)
      }    
    </ul>
    <ul class="navbar-nav ml-auto">   
      ${MediaDropdownItemList(mediaDropdownItemList)}
      ${NavDropdownItemList(navDropdownItemList)}
      <li class="nav-item">
        <a class="nav-link" data-widget="fullscreen" href="#" role="button">
          <i class="fas fa-expand-arrows-alt"></i>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" id="logout-bttn" href="#" role="button">
          <i class="fas fa-power-off"></i>
        </a>
      </li>
    </ul>`

    )
  }

  
  if (mode== 0){ 
    return display()
}else{
    return update()
}



}