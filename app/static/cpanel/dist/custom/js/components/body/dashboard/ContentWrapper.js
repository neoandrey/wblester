
import { getProperty } from '../../Common.js'

import {ContentRow,DashboardReportRange} from '../../../lib.js'

export default function ContentWrapper(props, mode = 0) {
   if (Object.keys(props).length == 0) {
      return ``
   }
   const name          = "ContentWrapper"
   const id            = getProperty(props, "id", `${name.toLowerCase()}-node`)
   const dashboardReportRange          = getProperty(props, "dashboardReportRange",{})
   const actions       = getProperty(props, "actions", {})
   const spaces        = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
   let contentRows     = getProperty(props, "contentRows", []);

   const update = () => {
      const  rows = contentRows.map((row) => {
        
         return  ContentRow(row)
      
      })
     let  content = Object.keys(dashboardReportRange).length== 0?rows.join(''): DashboardReportRange(dashboardReportRange)+rows.join('')
      return (`<div class="container-fluid" id="${id}-cfluid">${content} </div>`)
   }

   const display = () => {
      const  rows = contentRows.map((row) => {
         //console.log(row)
         return  ContentRow(row)
      
      })
     let  content =  Object.keys(dashboardReportRange).length== 0?rows.join(''):DashboardReportRange(dashboardReportRange)+rows.join('')
      return (`<section class="content" id="${id}"><div class="container-fluid">${content} </div></section>`)
   }

   if (mode== 0){ 
      return display()
  }else{
      return update()
  }

}

