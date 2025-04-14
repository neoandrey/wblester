const LT        =  "$lt";
const GT        =  "$gt";
const LTE       =  "$lte";
const GTE       =  "$gte";
const EQ        =  "$eq";
const NE        =  "$ne";
const EXISTS    =  "$exists";
const TYPE      =  "$type";
const IN        =  "$in";
const AND       =  "$and";
const NIN       =  "$nin";
const ALL       =  "$all";
const SIZE      =  "$size";
const OR        =  "$or";
const NOR       =  "$nor";
const NOT       =  "$not";
const MOD       =  "$mod";
const REGEX     =  "$regex";
const ELEMMATCH =  "$elemMatch";

class SelectElement{

  static  field;
  static  value;
  static  operator;

  constructor(field,operator, value){

    this.field     = field? field:null;
    this.operator  = operator?operator: null;
    this.value     = value?value:null

  }


}
export class Selector{

    selector = {};

    static get LT(){
        return LT;
    }
    static get GT(){
        return GT;
    }

    static get LTE(){
        return LTE;
    }

    static get GTE(){
        return GTE;
    }

    static get EQ(){
        return EQ;
    }

    static get NE(){
        return NE;
    }

    static get EXISTS(){
        return EXISTS;
    }

    static get TYPE(){
        return TYPE;
    }

    static get IN(){
        return IN;
    }

    static get AND(){
        return AND;
    }

    static get NIN(){
        return NIN;
    }

    static get ALL(){
        return ALL;
    }

    static get SIZE(){
        return SIZE;
    }

    static get OR(){
        return OR;
    }

    static get NOR(){
        return NOR;
    }

    static get NOT(){
        return NOT;
    }
    static get MOD(){
        return MOD;
    }

    static get REGEX(){
        return REGEX;
    }

    static get ELEMMATCH(){
        return ELEMMATCH;
    }

    lt(field, value){
		let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.LT] = value;
		return temp;
    }
   gt(field, value){
       	let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.GT] = value;
		return temp;
    }

   lte(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.LTE] = value;
		return temp;
    }

   gte(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.GTE] = value;
		return temp;
    }

   eq(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.EQ] = value;
		return temp;
    }

   ne(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NE] = value;
		return temp;
    }

   exists(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.EXISTS] = value;
		return temp;
    }

   type(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.TYPE] = value;
		return temp;
    }

   _in(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.IN] = value;
		return temp;
    }

   and(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.AND] = value;
		return temp;
    }

   nin(field, value){
		let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NIN] = value;
		return temp;
    }

   all(field, value){
        let  temp  				 = {}
        temp[field] 			 = {}
        temp[field][Selector.ALL] = value;
        return temp;
    }

   size(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.SIZE] = value;
		return temp;
    }

   or(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.OR] = value;
		return temp;
    }

   nor(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NOR] = value;
		return temp;
    }

   not(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.NOT] = value;
		return temp;
    }
   mod(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.MOD] = value;
		return temp;
    }

   regex(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.REGEX] = value;
		return temp;
    }

   elemMatch(field, value){
        let  temp  				 = {}
		temp[field] 			 = {}
		temp[field][Selector.ELEMMATCH] = value;
		return temp;
    }

    constructor(searchFilters){
        
        if(searchFilters){ 
        if(!Array.isArray(searchFilters) ){
            let tempArray = [];
            tempArray.push(searchFilters)
            searchFilters = tempArray

        }
        
        searchFilters.forEach((searchFilter)=>{
            
            let selector = new SelectElement(searchFilter.field,searchFilter.operator,searchFilter.value);
           
            switch(selector.operator){

                case null:
                    selector= Object.assign(this.selector,this.eq(searchFilter.field, searchFilter.value));
                break;
                case Selector.EQ:
                   
                    selector = Object.assign(this.selector,this.eq(searchFilter.field, searchFilter.value));
                break;
                case Selector.LT:
                    Object.assign(this.selector,this.lt(searchFilter.field, searchFilter.value));
                break;
                case Selector.GT:
                    Object.assign(this.selector,this.gt(searchFilter.field, searchFilter.value));
                break;
                case Selector.LTE:
                    Object.assign(this.selector,this.lte(searchFilter.field, searchFilter.value));
                break;
                case Selector.GTE:
                    Object.assign(this.selector,this.gte(searchFilter.field, searchFilter.value));
                break;
                case Selector.NE:
                    Object.assign(this.selector,this.ne(searchFilter.field, searchFilter.value));
                break;
                case Selector.EXISTS:
                    Object.assign(this.selector,this.exists(searchFilter.field, searchFilter.value));
                break;
                case Selector.TYPE:
                    Object.assign(this.selector,this.type(searchFilter.field, searchFilter.value));
                break;                 
                case Selector.IN:
                    Object.assign(this.selector,this._in(searchFilter.field, searchFilter.value));
                break;
                case Selector.NIN:
                    Object.assign(this.selector,this.nin(searchFilter.field, searchFilter.value));
                break;   
                case Selector.ALL:
                    Object.assign(this.selector,this.all(searchFilter.field, searchFilter.value));
                break; 
                case Selector.SIZE:
                    Object.assign(this.selector,this.size(searchFilter.field, searchFilter.value));
                break;   
                case Selector.OR:
                    Object.assign(this.selector,this.or(searchFilter.field, searchFilter.value));
                break;    
                case Selector.NOR:
                    Object.assign(this.selector,this.nor(searchFilter.field, searchFilter.value));
                break; 
                case Selector.NOT:
                    Object.assign(this.selector,this.not(searchFilter.field, searchFilter.value));
                break; 
                case Selector.MOD:
                    Object.assign(this.selector,this.mod(searchFilter.field, searchFilter.value));
                break;       
                case Selector.REGEX:
                    Object.assign(this.selector,this.regex(searchFilter.field, searchFilter.value));
                break;   
                case Selector.ELEMMATCH:
                    Object.assign(this.selector,this.elemMatch(searchFilter.field, searchFilter.value));
                break;  
            }

        })
    
    
         return this.selector;
        }
        else{
            return {}
        }

    }



}
