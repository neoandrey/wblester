
import { getProperty } from '../Common.js';
export default function SidebarHeader(props, mode=0) {
     if (Object.keys(props).length == 0) {
          return ``
     }
     let text = getProperty(props, "text", "")
     const setProperties = (props) => {

          text = getProperty(props, "text", "")
     }
     const update = () => { return text }
     const display = () => { return (`<li class="nav-header">${text}</li>`) }

     if (mode== 0){ 
          return display()
      }else{
          return update()
      }
}