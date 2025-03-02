import { getProperty } from '../Common.js'
import { NavDivider } from './Navbar.js'

export default function NavDropdownItem(props, mode=0) {

  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "NavDropdownItem"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})


  let href = getProperty(props, "href", "#")
  let dropdownItemclass = getProperty(props, "dropdownItemclass", "dropdown-item")
  let iconClass = getProperty(props, "iconClass", "fas fa-envelope mr-2")
  let mainText = getProperty(props, "mainText", "4 new messages")
  let rightSpanClass = getProperty(props, "rightSpanClass", "float-right text-muted text-sm")
  let rightSpanText = getProperty(props, "rightSpanText", "3 mins")

  const setProperties = (props) => {

    href = getProperty(props, "href", "#")
    dropdownItemclass = getProperty(props, "dropdownItemclass", "dropdown-item")
    iconClass = getProperty(props, "iconClass", "fas fa-envelope mr-2")
    mainText = getProperty(props, "mainText", "4 new messages")
    rightSpanClass = getProperty(props, "rightSpanClass", "float-right text-muted text-sm")
    rightSpanText = getProperty(props, "rightSpanText", "3 mins")


  }
  const display = () => {
    return (`<a id="${id}"  href="${href}" class="${dropdownItemclass}">
        <i class="${iconClass}"></i>${mainText}
        <span class="${rightSpanClass}">${rightSpanText}</span>
      </a>
      ${NavDivider()}`

    )
  }


const update = () => {
  return (`
      <i class="${iconClass}"></i>${mainText}
      <span class="${rightSpanClass}">${rightSpanText}</span>

    ${NavDivider()}`

  )
}


  if (mode== 0){ 
    return display()
}else{
    return update()
}

}