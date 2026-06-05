const mongoose=require('mongoose');
const {createBaseSchema}=require('../core/baseSchema');
const schema=createBaseSchema({
 name:String, barcode:String, brand:String, category:String,
 baseUnit:String, conversionRate:Number,
 salePrice:Number, costPrice:Number,
 defaultWarehouse:String, isActive:{type:Boolean,default:true}
});
schema.index({code:1},{unique:true});
module.exports = mongoose.models.Product || mongoose.model('Product', schema, 'products');
