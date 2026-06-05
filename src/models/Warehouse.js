const mongoose=require('mongoose');
const {createBaseSchema}=require('../core/baseSchema');
const schema=createBaseSchema({
 warehouseCode:String,warehouseName:String,
 isActive:{type:Boolean,default:true}
});
schema.index({warehouseCode:1},{unique:true});
module.exports=mongoose.models.Warehouse||mongoose.model('Warehouse',schema);