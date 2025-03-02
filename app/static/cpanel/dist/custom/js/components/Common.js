export function getProperty(properties,field, defaultValue){

    return  Object.keys(properties).indexOf(field)>-1?properties[field]:defaultValue;
      
}

export function getActionString(actions, properties){

    let funcString = actions.functionName;
    if(actions.parameters){ 
            Object.keys(actions.parameters).forEach((parameter=>{
               // console.log(parameter)
                funcString=funcString.replace(parameter, properties[parameter])
            }))
    }
     
    return actions.event+="=\"{"+funcString+"}\"" 
        
}