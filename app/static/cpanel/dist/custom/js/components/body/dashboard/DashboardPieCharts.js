import { getProperty,getActionString } from '../../Common.js'

	export default function DashboardPieChart(props,mode=0) {
	  if (Object.keys(props).length == 0) {
		return ``
	  }

	const name = "DashboardPieChart"
	const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
	const actions = getProperty(props, "actions", {})
	  
	let cardClass = getProperty(props, "cardClass", `primary`)
	let cardTitle = getProperty(props, "cardTitle", `primary`)      
	let type = getProperty(props, "type", `primary`)


	const setProps =(props)=>{
		
			cardClass = getProperty(props, "cardClass", `primary`)
			cardTitle = getProperty(props, "cardTitle", `WBLESTER Stats`)      
			type = getProperty(props, "type", `spf`)
		
	}
	const update = () => {return display()}
	const display = () =>{ 
			return(`<div class="card card-${cardClass}">
				  <div class="card-header">
					<h3 class="card-title">${cardTitle}</h3>
				  </div>
				  <div class="card-body">
					<canvas id="${type}-piechart" style="min-height: 250px; height: 250px; max-height: 250px; max-width: 100%;min-width: 50%;"></canvas>
				  </div>
				</div>`);				
	}
	if (mode== 0){ 
		return display()
	}else{
		return update()
	}
  
}