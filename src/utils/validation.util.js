
function required(value, fieldName){
 if(value===undefined||value===null||value==='') throw new Error(fieldName+' is required');
}
function numberMin(value,min,fieldName){
 if(Number(value||0)<min) throw new Error(fieldName+' must be >= '+min);
}
module.exports={required,numberMin};
