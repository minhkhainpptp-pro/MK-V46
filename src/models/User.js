const mongoose=require('mongoose');
const {createBaseSchema}=require('../core/baseSchema');
const schema=createBaseSchema({
 userCode:String,userName:String,username:String,password:String,
 roleCode:String,roleName:String,phone:String,email:String,
 isActive:{type:Boolean,default:true}
});
schema.index({userCode:1},{unique:true});
schema.index({username:1},{unique:true});
module.exports=mongoose.models.User||mongoose.model('User',schema);