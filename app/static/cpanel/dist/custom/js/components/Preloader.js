
import { getProperty } from './Common.js'
export default function Preloader(props) {
  const image = getProperty(props, "image", "static/logo50_small.png")
  return (`<div class="preloader flex-column justify-content-center align-items-center">
        <img id="preloader-image" class="animation__shake" src="${image}" alt="AdminLTELogo" height="60" width="60"></img>
      </div>`)

}