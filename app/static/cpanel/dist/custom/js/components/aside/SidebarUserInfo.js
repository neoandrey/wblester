import { getProperty } from '../Common.js'

export default function SidebarUserInfo(props, mode=0) {

  if (Object.keys(props).length == 0) {
    return ``
  }

  const name = "SidebarUserInfo"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  let href = getProperty(props, "href", "#");
  let className = getProperty(props, "className", "user-panel mt-3 pb-3 mb-3 d-flex")
  let image = getProperty(props, "image", "dist/img/user2-160x160.jpg")
  let imageClass = getProperty(props, "imageClass", "img-circle elevation-2")
  let username = getProperty(props, "username", "Alexander Pierce")

  const setProperties = (props) => { 
  href = getProperty(props, "href", "#");
  className = getProperty(props, "className", "user-panel mt-3 pb-3 mb-3 d-flex")
  image = getProperty(props, "image", "dist/img/user2-160x160.jpg")
  imageClass = getProperty(props, "imageClass", "img-circle elevation-2")
  username = getProperty(props, "username", "Alexander Pierce")
  }

  
  const display = () => {

    return (
      `<div  id="${id}" class="${className}">
          <div class="image">
            <img src="${image}" class="${imageClass}" alt="User Image"></img>
          </div>
          <div class="info">
            <a href="${href}" class="d-block">${username}</a>
          </div>
        </div>`
    )
  } 

  const update = () => {

    return (
      `<div class="image">
            <img src="${image}" class="${imageClass}" alt="User Image"></img>
          </div>
          <div class="info">
            <a href="${href}" class="d-block">${username}</a>
          </div>`
    )
  } 
  if (mode== 0){ 
    return display()
  }else{
    return update()
  }
}