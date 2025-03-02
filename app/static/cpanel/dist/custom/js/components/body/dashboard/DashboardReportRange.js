
import { getProperty } from '../../Common.js'

export default function DashboardReportRange(props,  mode = 0) {

    const name = "DashboardReportRange";
    const id = getProperty(props, "id", `${name.toLowerCase()}-node`);
    const actions = getProperty(props, "actions", {})
    let reportStart = getProperty(props, "reportStart", new Date(new Date()-(new Date).getMonth()-1).toString())
    let reportEnd = getProperty(props, "reportEnd", (new Date()).toString())

    const update= ()=>{
    return   display()
    }
    
    const display = ()=> { 

            return (`<form id="${id}-form"><div class="row">
            <div class="form-group col-md-6">
            <div class="row">
            <div class="form-group col-md-6 ">
                    <label> Report Date Range:</label>
                    <div class="input-group" >
                    <button type="button" class="btn btn-default" id="daterange-btn">
                        <i class="far fa-calendar-alt"></i> Report Period
                        <i class="fas fa-caret-down"></i>
                    </button>
            </div>
            </div>
            <div class="form-group col-md-6 ">
                <label for="wblester-domain">Domain:</label>
                <div class="input-group" >
                            <select class="custom-select form-control-border border-width-2" id="wblester-domain">
                            <option>all</option>
                    </select>
                    </div>
            </div>
    </div>

            </div>
            <div class="input-group col-md-6">
        <div class="row">
                <div class="form-group col-md-6 ">
                    <label for="report-org-id">From:</label>
                    <input type="text" class="form-control" id="report-range-start" disabled value="${reportStart}">
                </div>
                <div class="form-group col-md-6 ">
                <label for="report-org-id">To:</label>
                <input type="text" class="form-control" id="report-range-end" disabled value="${reportEnd}">
            </div>
        </div>
        </div>
        </div>
            </div>
        </form> `
            )
    }
    if (mode == 0){ 
        return display()
    }else{
        return update()
    }

}