import { getProperty } from '../../Common.js'


export default function DashboardGraph(props,  mode = 0) {
   if (Object.keys(props).length == 0) {
      return ``
   }

   const name = "DashboardGraph"
   const id = getProperty(props, "id", `wblester-conformance-chart`)
   const actions = getProperty(props, "actions", {})

   let title = getProperty(props, "title", "WBLESTER Conformance Trend Chart")

   const setProperties = (props) => {

	title = getProperty(props, "title", "WBLESTER Conformance Trend Chart")
   }

   const update = () => {return display()}
   const display = () => {
      return (`<div class="card card-info w-100">
	  <div class="card-header">
		<h3 class="card-title">${title}</h3>
	  </div>
	  <div class="card-body">
		<div class="chart">
		  <canvas id="${id}" style="min-height: 250px; height: 250px; max-height: 250px;  min-width: 100%;"></canvas>
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