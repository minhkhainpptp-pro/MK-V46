
const service=require('../services/warehouse.service');
exports.list=async(req,res)=>res.json({ok:true,data:await service.listWarehouses()});
exports.get=async(req,res)=>res.json({ok:true,data:await service.getWarehouse(req.params.id)});
exports.create=async(req,res)=>res.json({ok:true,data:await service.createWarehouse(req.body)});
exports.update=async(req,res)=>res.json({ok:true,data:await service.updateWarehouse(req.params.id,req.body)});
exports.remove=async(req,res)=>res.json({ok:true,data:await service.deleteWarehouse(req.params.id)});
