import { getProperty } from '../Common.js'
export default function SidebarSearch(props = {}, mode=0) {
  if (Object.keys(props).length == 0) {
    return ``
  }
  const name = "SidebarSearch"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})

  const update = () => {
    return (
      `<div class="input-group" data-widget="sidebar-search">
            <input class="form-control form-control-sidebar" type="search" placeholder="Search" aria-label="Search">
            </input>
            <div class="input-group-append">
              <button class="btn btn-sidebar">
                <i class="fas fa-search fa-fw"></i>
              </button>
            </div>
          </div>`
    )
  }

  const display = () => {
    return (
      `<div class="form-inline"  id="${id}" >
          <div class="input-group" data-widget="sidebar-search">
            <input class="form-control form-control-sidebar" type="search" placeholder="Search" aria-label="Search">
            </input>
            <div class="input-group-append">
              <button class="btn btn-sidebar">
                <i class="fas fa-search fa-fw"></i>
              </button>
            </div>
          </div>
        </div>`
    )
  }
  if (mode== 0){ 
    return display()
}else{
    return update()
}
}