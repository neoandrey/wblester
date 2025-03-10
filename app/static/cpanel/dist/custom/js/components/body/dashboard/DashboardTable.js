import { getProperty } from '../../Common.js'

export default function DashboardTable(props, mode = 0) {
  if (Object.keys(props).length == 0) {
    return ``
  }

  const name     = "DashboardTable"
  const id       = getProperty(props, "id", `${name.toLowerCase()}-node`)
  const actions  = getProperty(props, "actions", {})
  let statsClass = getProperty(props, "statsClass", "secondary")
  let tableClass = getProperty(props, "tableClass", "table-bordered table-striped")
  let statsTitle = getProperty(props, "statsTitle", "WBLesterc Report")
  let statsIcon  = getProperty(props, "statsIcon", "fas fa-bars")
  let tableData  = getProperty(props, "tableData", [])

  const getData = (data)=>{ 
    let tabData = []
    tabData.push(`<thead>`)
    for (let col of Object.keys(data[0])){ 
        tabData.push(`<th>${col}</th>`)
      }
      tabData.push(`</thead>`)
      tabData.push(`<tbody>`)
    for (let row of data){  
      tabData.push(`<tr>`);
      for (let field of Object.values(row)){
        tabData.push(`<td>${field}</td>`);
      }
      tabData.push(`</tr>`);
    }
    tabData.push(`</tbody>`)
    return tabData
  }
  const getTableData = () => {
      return tableData.length > 0?getData(tableData).join(''):'<thead></thead><tbody><tr id="loading-row"><td style="text-align:center"><img src="/static/cpanel/img/ajax-loaders/ajax-loader-6.gif" alt="" /></td></tr></tbody>';
  }

  const update= ()=>{
    return   display()
  }
   

  const display = () => {
    let tableData=  getTableData();
    return (`<div class="card card-${statsClass} w-100">
    <div class="card-header">
      <h3 class="card-title"><i class="${statsIcon}"></i>&nbsp;&nbsp;&nbsp; ${statsTitle}</h3>
    </div>
    <div class="card-body">
      <table id="${id}" class="table ${tableClass}">
        ${tableData}
      </table>
    </div>
  </div>`)
  }


  if (mode== 0){ 
    return display()
}else{
    return update()
}


}