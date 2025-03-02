import { getProperty } from '../../Common.js'

import { ContentWrapper} from '../../../lib.js'

export default function ContentHeader(props, mode=0) {
  if (Object.keys(props).length == 0) {
    return ``
  }


  const name = "ContentHeader"
  const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions = getProperty(props, "actions", {})
  const spaces = '';  //'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'

  let pageTitle = getProperty(props, "pageTitle", "WBLESTER Statistics")
  let parentPage = getProperty(props, "parentPage", "Dashboard")
  let contentWrapper = getProperty(props, "contentWrapper", "Dashboard")

  const setProperties = (props) => {
    pageTitle = getProperty(props, "pageTitle", "WBLESTER Statistics")
    parentPage = getProperty(props, "parentPage", "Dashboard")
    contentRows = getProperty(props, "contentRows", "Dashboard")
  }

  const update = () => {
    let cWrapper = ContentWrapper(contentWrapper)
    return (
    `
    <div class="content-header">
        <div class="container-fluid">
              <div class="row mb-2">
                      <div class="col-sm-6">
                          <h1 class="m-0 pull-right">${spaces} <span class="page-title">${pageTitle}</span></h1>
                      </div>
                        <div class="col-sm-6">
                          <ol class="breadcrumb float-sm-right">
                            <li class="breadcrumb-item"><a href="#" class="parent-page">${parentPage}</a></li>
                            <li class="breadcrumb-item active page-title" >${pageTitle}</li>
                          </ol>
                        </div>
              </div>
        </div>
    </div>
    ${cWrapper}
`)

  }
  const display = () => {
     let cWrapper = ContentWrapper(contentWrapper)
    return (
      `<div class="content-wrapper" id="${id}">
      <div class="content-header">
          <div class="container-fluid">
                <div class="row mb-2">
                        <div class="col-sm-6">
                            <h1 class="m-0 pull-right">${spaces}<span class="page-title">${pageTitle}</span></h1>
                        </div>
                          <div class="col-sm-6">
                            <ol class="breadcrumb float-sm-right">
                              <li class="breadcrumb-item"><a href="#" class="parent-page">${parentPage}</a></li>
                              <li class="breadcrumb-item active page-title">${pageTitle}</li>
                            </ol>
                          </div>
                </div>
          </div>
      </div>
      ${cWrapper}
    </div>`
    )
  }

  if (mode== 0){ 
    return display()
}else{
    return update()
}

}