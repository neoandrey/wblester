import { getProperty } from '../Common.js'
import { getActionString } from '../Common.js'


export default function SidebarLogo(props, mode=0) {
  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "SidebarLogo"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})


  let href = getProperty(props, "href", "index3.html");
  let className = getProperty(props, "className", "brand-link")
  let image = getProperty(props, "image", "static/dist/img/AdminLTELogo.png")
  let imageClass = getProperty(props, "imageClass", "brand-image img-circle elevation-3")
  let imageStyle = getProperty(props, "imageStyle", "opacity: .8")
  let spanClass = getProperty(props, "spanClass", "brand-text font-weight-light");
  let spanText = getProperty(props, "spanText", "AdminLTE 3")

  let actionString = getActionString(actions, { "@id": id, "@spanText": spanText })
  actionString     = actionString.length > 0 ? actionString : '';

  const display = () => {
    return (
      `<a  id="${id}"  href="${href}" class="${className}" ${actionString}>
        <img id="sidebar-logo"  src="${image}" alt="AdminLTE Logo" class="${imageClass}" style="${imageStyle}"></img>
        <span class="${spanClass}">${spanText}</span>
      </a>`
    )
  }

  const update = () => {
    return (
      `<img src="${image}" alt="AdminLTE Logo" class="${imageClass}" style="${imageStyle}"></img>
        <span class="${spanClass}">${spanText}</span>`
    )

  }
  
if (mode== 0){ 
    return display()
}else{
    return update()
}


}