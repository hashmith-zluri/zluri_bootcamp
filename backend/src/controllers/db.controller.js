const dbService = require("../services/db.service");

const dbController = {
  getDbTypes: (req, res) => {
    res.status(200).json({ success: true, types: ["POSTGRES", "MONGO"] });
  },

  getDbInstances: async (req, res) => {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type parameter is required",
      });
    }
    try {
      const instances = await dbService.getInstancesByType(type);
      res.status(200).json({
        success: true,
        instances: instances.map(row => ({ id: String(row.id), name: row.name }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getDatabasesByInstance: async (req, res) => {
    const { id } = req.params;
    try {
      // Get the instance details from our portal database
      const instance = await dbService.getInstanceById(id);
      
      if (!instance) {
        return res.status(404).json({ 
          success: false, 
          message: "Instance not found" 
        });
      }
      
      if (instance.engine === "POSTGRES" || instance.engine === "MONGO") {
        // Get databases for this instance from instance_databases table
        const databases = await dbService.getDatabasesByInstanceId(id);
        res.status(200).json({ success: true, databases });
        
      } else {
        res.status(400).json({ 
          success: false, 
          message: `Unsupported database engine: ${instance.engine}` 
        });
      }
    } catch (error) {
      console.error("Get databases by instance failed:", error.message);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch databases" 
      });
    }
  }
};

module.exports = dbController;
