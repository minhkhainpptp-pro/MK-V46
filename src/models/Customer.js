const mongoose=require('mongoose');
const {createBaseSchema}=require('../core/baseSchema');
const schema=createBaseSchema({
 customerCode:String, customerName:String, address:String,
 routeCode:String, routeName:String,
 salesStaffCode:String, salesStaffName:String,
 deliveryStaffCode:String, deliveryStaffName:String
});
schema.index({customerCode:1},{unique:true});
module.exports=mongoose.models.Customer||mongoose.model('Customer',schema);