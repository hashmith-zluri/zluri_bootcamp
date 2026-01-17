const dbService = require("../services/db.service");

// Helper functions
const createErrorResponse = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message
  });
};

const createSuccessResponse = (res, data) => {
  return res.status(200).json({
    success: true,
    ...data
  });
};

const dbController = {
  getDbTypes: (req, res) => {
    return createSuccessResponse(res, { types: ["POSTGRES", "MONGO"] });
  },

  getDbInstances: async (req, res) => {
    const { type } = req.query;
    
    try {
      const instances = await dbService.getInstancesByType(type);
      const formattedInstances = instances.map(row => ({ 
        id: String(row.id), 
        name: row.name 
      }));
      
      return createSuccessResponse(res, { instances: formattedInstances });
    } catch (error) {
      return createErrorResponse(res, 500, error.message);
    }
  },

  getDatabasesByInstance: async (req, res) => {
    const { id } = req.params;
    
    try {
      const instance = await dbService.getInstanceById(id);
      
      if (!instance) {
        return createErrorResponse(res, 404, "Instance not found");
      }
      
      const supportedEngines = ["POSTGRES", "MONGO"];
      if (!supportedEngines.includes(instance.engine)) {
        return createErrorResponse(res, 400, `Unsupported database engine: ${instance.engine}`);
      }
      
      const databases = await dbService.getDatabasesByInstanceId(id);
      return createSuccessResponse(res, { databases });
      
    } catch (error) {
      console.error("Get databases by instance failed:", error.message);
      return createErrorResponse(res, 500, "Failed to fetch databases");
    }
  }
};

module.exports = dbController;
