import MediaDropdownItem from './MediaDropdownItem.js';
import { getProperty } from '../Common.js'

export default function MediaDropdownItemList(props, mode=0 ) {

  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "MediaDropdownItemList"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  let navListClassName = getProperty(props, "navListClassName", "nav-item dropdown")
  let navIconClassName = getProperty(props, "navIconClassName", "far fa-comments")
  let bagdeClassName = getProperty(props, "bagdeClassName", "badge badge-danger navbar-badge")
  let bagdeValue = getProperty(props, "bagdeValue", 3)
  let dropdownListClassName = getProperty(props, "dropdownListClassName", "dropdown-menu dropdown-menu-lg dropdown-menu-right")
  let footerText = getProperty(props, "footerText", "See All Messages")
  let mediaDropdownItems = getProperty(props, "mediaDropdownItems", []);


  const display = () => {
    return (
      `<li id="${id}"  class="${navListClassName}">
  <a class="nav-link" data-toggle="dropdown" href="#">
    <i class="${navIconClassName}"></i>
      <span class="${bagdeClassName}">${bagdeValue}</span>
  </a>
<div class="${dropdownListClassName}">
  
    ${mediaDropdownItems.map((dropdownItem, key) => {
        dropdownItem = { ...dropdownItem, "id": `${id}-${key}` }
        return MediaDropdownItem(dropdownItem)
      }).join(``)}
  
  <a href="#" class="dropdown-item dropdown-footer">${footerText}</a>
</div>

</li>`
    )

  }

  const update = () => {
    return (
      `<a class="nav-link" data-toggle="dropdown" href="#">
    <i class="${navIconClassName}"></i>
      <span class="${bagdeClassName}">${bagdeValue}</span>
  </a>
<div class="${dropdownListClassName}">
  
    ${mediaDropdownItems.map((dropdownItem, key) => {
        dropdownItem = { ...dropdownItem, "id": `${id}-${key}` }
        return MediaDropdownItem(dropdownItem)
      }).join(``)}
  
  <a href="#" class="dropdown-item dropdown-footer">${footerText}</a>
</div>`
    )

  }


  // console.log(`mediaDropdownItems: ${JSON.stringify(mediaDropdownItems)}`)


  if (mode== 0){ 
    return display()
}else{
    return update()
}

}