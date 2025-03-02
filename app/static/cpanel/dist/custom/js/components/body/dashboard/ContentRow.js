
import { getProperty } from '../../Common.js'

import { DashboardPieCharts,DashboardTable,DashboardGraph} from '../../../lib.js'

export default function ContentRow(props, mode=0) {
 
   if (Object.keys(props).length == 0) {
      return ``
   }
   let rowData  = getProperty(props, "rowData", "");
   let charts   = getProperty(props, "dashboardPieCharts", []);
   let graphs   = getProperty(props, "dashboardGraphs", []);
   let tables   = getProperty(props, "dashboardTables", []);
   let rowClass = getProperty(props, "rowClass", "");
   let htmlText = getProperty(props, "htmlText", null);

   const getCharts = () => {
      return charts.map((element) => {
         let chart = DashboardPieCharts(element)
         return `<div class="col-md-4">` + chart + `</div>`
      })
   }


   const getGraphs = () => {
      return graphs.map((element) => {
         return  DashboardGraph(element)
      
       
      })
   }


   const getTables = () => {
      return tables.map((element) => {

         return DashboardTable(element)
      
      })
   }


   const getRowHtml = () => {
      let rowData = '';
      if (graphs.length > 0) {
         rowData =  getGraphs().join('')

      }
      else if (tables.length > 0) {
         rowData = getTables().join('')
      }
      else if (charts.length > 0) {
         rowData = getCharts()
         rowData = rowData.join('');
      }else if(htmlText){
         rowData = htmlText;
      }
      rowData = rowData.length>0? `<div class="row ${rowClass}">${rowData}</div>`:''
      //console.log(rowData)
      return rowData;
   }



   const update = () => {
      return display()
    }

   const display = () => {
     return getRowHtml()
   }

   if (mode== 0){ 
      return display()
  }else{
      return update()
  }
}