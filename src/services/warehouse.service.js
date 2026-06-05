
const Warehouse=require('../models/Warehouse');
module.exports={
 listWarehouses:()=>Warehouse.find({}).lean(),
 getWarehouse:(id)=>Warehouse.findById(id).lean(),
 createWarehouse:(data)=>Warehouse.create(data),
 updateWarehouse:(id,data)=>Warehouse.findByIdAndUpdate(id,data,{new:true}),
 deleteWarehouse:(id)=>Warehouse.findByIdAndUpdate(id,{isActive:false,status:'inactive'},{new:true})
};
