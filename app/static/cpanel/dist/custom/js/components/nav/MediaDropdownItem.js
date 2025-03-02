import { getProperty } from '../Common.js'
import { NavDivider } from './Navbar.js'

export default function MediaDropdownItem(props, mode=0) {
  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "MediaDropdownItem"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})
  let href = getProperty(props, "href", "#")
  let dropdownItemclass = getProperty(props, "dropdownItemclass", "dropdown-item")
  let image = getProperty(props, "image", "dist/img/user1-128x128.jpg")
  let imageClass = getProperty(props, "imageClass", "img-size-50 mr-3 img-circle")
  let mainText = getProperty(props, "mainText", " Brad Diesel")
  let subText = getProperty(props, "subText", "Call me whenever you can...")
  let iconSpanClass = getProperty(props, "iconSpanClass", "float-right text-sm text-danger")
  let bodyIconClass = getProperty(props, "bodyIconClass", "fas fa-star")
  let footerIconClass = getProperty(props, "footerIconClass", "far fa-clock mr-1")
  let footerText = getProperty(props, "footerText", "4 Hours Ago")

  const setProperties = (props) => {
    href = getProperty(props, "href", "#")
    dropdownItemclass = getProperty(props, "dropdownItemclass", "dropdown-item")
    image = getProperty(props, "image", "dist/img/user1-128x128.jpg")
    imageClass = getProperty(props, "imageClass", "img-size-50 mr-3 img-circle")
    mainText = getProperty(props, "mainText", " Brad Diesel")
    subText = getProperty(props, "subText", "Call me whenever you can...")
    iconSpanClass = getProperty(props, "iconSpanClass", "float-right text-sm text-danger")
    bodyIconClass = getProperty(props, "bodyIconClass", "fas fa-star")
    footerIconClass = getProperty(props, "footerIconClass", "far fa-clock mr-1")
    footerText = getProperty(props, "footerText", "4 Hours Ago")
  }

  const display = () => {
    return (
      `<a  id="${id}" href="${href}" class="${dropdownItemclass}">
    <div class="media">
      <img src="${image}" alt="User Avatar" class="${imageClass}"></img>
      <div class="media-body">
        <h3 class="dropdown-item-title">
          ${mainText}
          <span class="${iconSpanClass}"><i class="${bodyIconClass}"></i></span>
        </h3>
        <p class="text-sm">${subText}</p>
        <p class="text-sm text-muted"><i class="${footerIconClass}"></i>${footerText} </p>
      </div>
    </div>  
  </a>
  ${NavDivider()}
 `
    )

  }

  const update = () => {
    return (
      `
    <div class="media">
      <img src="${image}" alt="User Avatar" class="${imageClass}"></img>
      <div class="media-body">
        <h3 class="dropdown-item-title">
          ${mainText}
          <span class="${iconSpanClass}"><i class="${bodyIconClass}"></i></span>
        </h3>
        <p class="text-sm">${subText}</p>
        <p class="text-sm text-muted"><i class="${footerIconClass}"></i>${footerText} </p>
      </div>
    </div>  
  ${NavDivider()}
 `
    )

  }



  if (mode== 0){ 
    return display()
}else{
    return update()
}





}